/**
 * Orquestador de ejecución con recuperación ante errores (FDN-072).
 *
 * Ejecuta sobre `RoutePlan` de @fme/router: aplica reintentos seguros acotados,
 * degradación de VRAM en 'preview', subdivisión por segmentos sin pérdida en 'final',
 * conmutación verificada vía `probe()` a los `fallbacks` y escalado explícito sin
 * mutar el `JobRequest` original ni contaminar la caché ante errores.
 */
import type {
  AdapterJobResult,
  ConnectorAdapter,
  JobRequest,
} from '@fme/connectors';
import type { RoutePlan } from '@fme/router';
import { classifyExecutionError } from './classify.ts';
import {
  decideRecoveryAction,
  parseFrameRangeSpec,
  splitFrameRange,
  type PolicyRuntimeState,
} from './policy.ts';
import type {
  AdapterMap,
  AttemptContextFactory,
  AttemptMitigation,
  ErrorClassification,
  ExecutionAttempt,
  RecoveryExecutionResult,
  RecoveryOptions,
} from './types.ts';

function cloneJob(
  job: JobRequest,
  requirementsOverride?: Record<string, string | number | boolean>,
): JobRequest {
  return {
    projectId: job.projectId,
    operation: job.operation,
    inputs: job.inputs.map((item) => ({ uri: item.uri, type: item.type })),
    requirements:
      requirementsOverride !== undefined
        ? { ...requirementsOverride }
        : { ...job.requirements },
    ...(job.seed !== undefined ? { seed: job.seed } : {}),
  };
}

function getAdapter(
  adapters: AdapterMap,
  connectorId: string,
): ConnectorAdapter | undefined {
  if (typeof (adapters as ReadonlyMap<string, ConnectorAdapter>).get === 'function') {
    return (adapters as ReadonlyMap<string, ConnectorAdapter>).get(connectorId);
  }
  return (adapters as Readonly<Record<string, ConnectorAdapter>>)[connectorId];
}

function defaultSleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSingleAttempt(
  adapter: ConnectorAdapter,
  job: JobRequest,
  connectorId: string,
  suffix: string,
  attempts: ExecutionAttempt[],
  createContext: AttemptContextFactory,
  mitigation?: AttemptMitigation,
): Promise<{
  ok: boolean;
  result?: AdapterJobResult;
  classification?: ErrorClassification;
  errorMessage?: string;
}> {
  const attemptNumber = attempts.length + 1;
  const ctx = createContext({ attemptNumber, connectorId, suffix });
  const started = Date.now();

  try {
    const result = await adapter.run(job, ctx);
    const durationMs = Date.now() - started;

    if (result.status === 'ok') {
      attempts.push({
        attemptNumber,
        connectorId,
        jobId: ctx.jobId,
        workDir: ctx.workDir,
        status: result.status,
        durationMs,
        ...(mitigation !== undefined ? { mitigation } : {}),
        result,
      });
      return { ok: true, result };
    }

    const classification = classifyExecutionError(result);
    attempts.push({
      attemptNumber,
      connectorId,
      jobId: ctx.jobId,
      workDir: ctx.workDir,
      status: result.status,
      durationMs,
      classification,
      ...(mitigation !== undefined ? { mitigation } : {}),
      result,
    });
    return { ok: false, result, classification };
  } catch (err) {
    const durationMs = Date.now() - started;
    const errorMessage = err instanceof Error ? err.message : String(err);
    const classification = classifyExecutionError(err);
    attempts.push({
      attemptNumber,
      connectorId,
      jobId: ctx.jobId,
      workDir: ctx.workDir,
      status: 'threw',
      durationMs,
      classification,
      ...(mitigation !== undefined ? { mitigation } : {}),
      errorMessage,
    });
    return { ok: false, classification, errorMessage };
  }
}

async function runSubdividedSegments(
  adapter: ConnectorAdapter,
  baseJob: JobRequest,
  connectorId: string,
  segmentCount: number,
  attempts: ExecutionAttempt[],
  createContext: AttemptContextFactory,
  parentMitigation: AttemptMitigation,
): Promise<{
  ok: boolean;
  mergedResult?: AdapterJobResult;
  lastResult?: AdapterJobResult;
  classification?: ErrorClassification;
}> {
  const spec = parseFrameRangeSpec(baseJob.requirements);
  if (spec === null) {
    return { ok: false };
  }

  const segments = splitFrameRange(spec, segmentCount);
  const outputs: AdapterJobResult['outputs'] = [];
  const provenance: AdapterJobResult['provenance'] = [];
  const diagnostics: AdapterJobResult['diagnostics'] = [];
  let lastJobId = '';

  for (const segment of segments) {
    const segRequirements: Record<string, string | number | boolean> = {
      ...baseJob.requirements,
      frameRange: segment.formattedRange,
      segmentStartFrame: segment.startFrame,
      segmentEndFrame: segment.endFrame,
      segmentIndex: segment.index,
      segmentCount: segment.count,
    };
    const segJob = cloneJob(baseJob, segRequirements);
    const segOutcome = await runSingleAttempt(
      adapter,
      segJob,
      connectorId,
      `seg-${segment.index + 1}-of-${segment.count}`,
      attempts,
      createContext,
      segment.index === 0 ? parentMitigation : undefined,
    );

    if (!segOutcome.ok || segOutcome.result === undefined) {
      return {
        ok: false,
        ...(segOutcome.result !== undefined
          ? { lastResult: segOutcome.result }
          : {}),
        ...(segOutcome.classification !== undefined
          ? { classification: segOutcome.classification }
          : {}),
      };
    }

    lastJobId = segOutcome.result.jobId;
    outputs.push(...segOutcome.result.outputs);
    provenance.push(...segOutcome.result.provenance);
    diagnostics.push(...segOutcome.result.diagnostics);
  }

  return {
    ok: true,
    mergedResult: {
      jobId: lastJobId,
      status: 'ok',
      outputs,
      provenance,
      diagnostics,
    },
  };
}

/**
 * Ejecuta un trabajo sobre el `RoutePlan` de @fme/router aplicando la política
 * de recuperación, degradación controlada, subdivisión y fallback verificado.
 */
export async function executeWithRecovery(
  plan: RoutePlan,
  adapters: AdapterMap,
  job: JobRequest,
  createContext: AttemptContextFactory,
  options: RecoveryOptions = {},
): Promise<RecoveryExecutionResult> {
  const sleep = options.sleep ?? defaultSleep;
  const probeFallbackBeforeRun = options.probeFallbackBeforeRun ?? true;
  const baseBackoffMs = options.baseBackoffMs ?? 10;

  if (plan.status !== 'planned' || plan.selected === null) {
    const constraint = plan.error?.message ?? plan.justification;
    return {
      outcome: 'escalated',
      finalResult: null,
      connectorId: null,
      degraded: false,
      attempts: [],
      appliedMitigations: [],
      constraintsReported: [constraint],
      suggestedActions: [
        'Revisar restricciones duras del RoutePlan o registrar un conector compatible.',
      ],
      reason: plan.justification,
    };
  }

  const attempts: ExecutionAttempt[] = [];
  const appliedMitigations: AttemptMitigation[] = [];
  const constraintsReported: string[] = [];
  let suggestedActions: string[] = [];
  let degraded = false;
  let lastResult: AdapterJobResult | null = null;
  let lastConnectorId: string | null = null;
  let lastReason = '';

  const fallbackIds = plan.fallbacks.map((f) => f.connectorId);
  const primaryId = plan.selected.connectorId;
  const primaryAdapter = getAdapter(adapters, primaryId);

  let tryFallbacks = false;

  if (primaryAdapter === undefined) {
    lastReason = `No existe instancia de ConnectorAdapter para el conector primario "${primaryId}".`;
    constraintsReported.push(lastReason);
    tryFallbacks = fallbackIds.length > 0;
  } else {
    let currentJob = cloneJob(job);
    const policyState: PolicyRuntimeState = {
      transientRetriesUsed: 0,
      vramDegradationsUsed: 0,
      subdivisionsUsed: 0,
      currentSegmentCount: 1,
      hasRemainingFallbacks: fallbackIds.length > 0,
    };

    let nextMitigation: AttemptMitigation | undefined;
    let suffix = 'primary';

    while (true) {
      const outcome = await runSingleAttempt(
        primaryAdapter,
        currentJob,
        primaryId,
        suffix,
        attempts,
        createContext,
        nextMitigation,
      );
      lastConnectorId = primaryId;
      if (outcome.result !== undefined) {
        lastResult = outcome.result;
      }

      if (outcome.ok && outcome.result !== undefined) {
        if (options.onCacheStore !== undefined) {
          await options.onCacheStore({
            connectorId: primaryId,
            job: currentJob,
            result: outcome.result,
            degraded,
          });
        }
        return {
          outcome: 'ok',
          finalResult: outcome.result,
          connectorId: primaryId,
          degraded,
          attempts,
          appliedMitigations,
          constraintsReported,
        };
      }

      const classification =
        outcome.classification ??
        classifyExecutionError(
          outcome.result ?? new Error('Error desconocido en adaptador.'),
        );

      const decision = decideRecoveryAction(
        classification,
        currentJob,
        policyState,
        options,
      );
      lastReason = decision.reason;

      if (decision.action === 'retry') {
        policyState.transientRetriesUsed += 1;
        await sleep(baseBackoffMs * policyState.transientRetriesUsed);
        const mitigation = decision.mitigations?.[0];
        if (mitigation !== undefined) {
          appliedMitigations.push(mitigation);
          nextMitigation = mitigation;
        }
        suffix = `retry-${policyState.transientRetriesUsed}`;
        continue;
      }

      if (decision.action === 'degrade-preview' && decision.nextRequirements !== undefined) {
        policyState.vramDegradationsUsed += 1;
        degraded = true;
        currentJob = cloneJob(job, decision.nextRequirements);
        if (decision.mitigations !== undefined) {
          appliedMitigations.push(...decision.mitigations);
          nextMitigation = decision.mitigations[0];
        }
        suffix = `preview-degrade-${policyState.vramDegradationsUsed}`;
        continue;
      }

      if (decision.action === 'subdivide' && decision.segmentCount !== undefined) {
        policyState.subdivisionsUsed += 1;
        policyState.currentSegmentCount = decision.segmentCount;
        const subMitigation: AttemptMitigation = decision.mitigations?.[0] ?? {
          type: 'subdivide-segments',
          detail: `Subdivisión en ${decision.segmentCount} segmentos.`,
        };
        appliedMitigations.push(subMitigation);

        const subOutcome = await runSubdividedSegments(
          primaryAdapter,
          currentJob,
          primaryId,
          decision.segmentCount,
          attempts,
          createContext,
          subMitigation,
        );
        if (subOutcome.lastResult !== undefined) {
          lastResult = subOutcome.lastResult;
        }

        if (subOutcome.ok && subOutcome.mergedResult !== undefined) {
          if (options.onCacheStore !== undefined) {
            await options.onCacheStore({
              connectorId: primaryId,
              job: currentJob,
              result: subOutcome.mergedResult,
              degraded,
            });
          }
          return {
            outcome: 'ok',
            finalResult: subOutcome.mergedResult,
            connectorId: primaryId,
            degraded,
            attempts,
            appliedMitigations,
            constraintsReported,
          };
        }

        const subClass = subOutcome.classification ?? classification;
        const postSubDecision = decideRecoveryAction(
          subClass,
          currentJob,
          policyState,
          options,
        );
        lastReason = postSubDecision.reason;
        if (postSubDecision.action === 'subdivide' && postSubDecision.segmentCount !== undefined) {
          // Sigue al siguiente nivel de subdivisión si el rango lo permite
          continue;
        }
        if (postSubDecision.action === 'fallback') {
          tryFallbacks = true;
          break;
        }
        if (postSubDecision.constraintMessage !== undefined) {
          constraintsReported.push(postSubDecision.constraintMessage);
        }
        if (postSubDecision.suggestedActions !== undefined) {
          suggestedActions = postSubDecision.suggestedActions;
        }
        break;
      }

      if (decision.action === 'fallback') {
        tryFallbacks = true;
        break;
      }

      if (decision.constraintMessage !== undefined) {
        constraintsReported.push(decision.constraintMessage);
      }
      if (decision.suggestedActions !== undefined) {
        suggestedActions = decision.suggestedActions;
      }
      break;
    }
  }

  if (tryFallbacks) {
    for (const fallbackId of fallbackIds) {
      const fbAdapter = getAdapter(adapters, fallbackId);
      if (fbAdapter === undefined) {
        constraintsReported.push(
          `Fallback "${fallbackId}" no tiene instancia de ConnectorAdapter registrada.`,
        );
        continue;
      }

      if (probeFallbackBeforeRun) {
        const probeResult = await fbAdapter.probe();
        if (!probeResult.available) {
          const diagMsg =
            probeResult.diagnostics.map((d) => d.message).join('; ') ||
            'probe() devolvió available=false';
          constraintsReported.push(
            `Fallback "${fallbackId}" omitido tras probe(): ${diagMsg}`,
          );
          continue;
        }
      }

      const fallbackMitigation: AttemptMitigation = {
        type: 'fallback-connector',
        detail: `Conmutado desde "${primaryId}" al backend alternativo "${fallbackId}".`,
      };
      const fbJob = cloneJob(job);
      const fbOutcome = await runSingleAttempt(
        fbAdapter,
        fbJob,
        fallbackId,
        `fallback-${fallbackId}`,
        attempts,
        createContext,
        fallbackMitigation,
      );
      lastConnectorId = fallbackId;
      if (fbOutcome.result !== undefined) {
        lastResult = fbOutcome.result;
      }

      if (fbOutcome.ok && fbOutcome.result !== undefined) {
        appliedMitigations.push(fallbackMitigation);
        if (options.onCacheStore !== undefined) {
          await options.onCacheStore({
            connectorId: fallbackId,
            job: fbJob,
            result: fbOutcome.result,
            degraded: false,
          });
        }
        return {
          outcome: 'ok',
          finalResult: fbOutcome.result,
          connectorId: fallbackId,
          degraded: false,
          attempts,
          appliedMitigations,
          constraintsReported,
        };
      }

      const fbReason =
        fbOutcome.classification?.reason ??
        fbOutcome.result?.diagnostics[0]?.message ??
        fbOutcome.errorMessage ??
        'fallo en fallback';
      constraintsReported.push(`Fallback "${fallbackId}" falló: ${fbReason}`);
      lastReason = fbReason;
    }
  }

  if (constraintsReported.length === 0 && lastReason.length > 0) {
    constraintsReported.push(lastReason);
  }
  if (suggestedActions.length === 0) {
    suggestedActions = [
      'Revisar restricciones de hardware/VRAM o registrar un backend alternativo disponible.',
    ];
  }

  return {
    outcome: 'escalated',
    finalResult: lastResult,
    connectorId: lastConnectorId,
    degraded,
    attempts,
    appliedMitigations,
    constraintsReported,
    suggestedActions,
    reason: lastReason || 'No fue posible completar el trabajo tras aplicar recuperación.',
  };
}
