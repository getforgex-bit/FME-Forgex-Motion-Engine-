import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  CONTRACT_VERSION,
  checkAdapterResult,
  createConnectorRegistry,
  type AdapterJobResult,
  type CardAdvanced,
  type CardSimple,
  type ConnectorAdapter,
  type JobContext,
  type JobRequest,
  type ProbeResult,
} from '../../connectors/src/index.ts';
import { planRoute } from '../../router/src/index.ts';
import {
  classifyExecutionError,
  executeWithRecovery,
  type CacheStoreRecord,
} from '../src/index.ts';

const VALID_SHA = 'a'.repeat(64);
const instantSleep = async () => {};

function makeCardSimple(
  id: string,
  overrides: Partial<CardSimple> = {},
): CardSimple {
  return {
    id,
    name: id,
    version: '1.0.0',
    contractVersion: CONTRACT_VERSION,
    capabilities: ['render.3d', 'render.video'],
    accepts: ['fme/scene+json'],
    produces: ['video/mp4'],
    executor: 'cli',
    ...overrides,
  };
}

function makeCardAdvanced(
  pluginId: string,
  overrides: Partial<CardAdvanced> = {},
): CardAdvanced {
  return {
    pluginId,
    technical: { alpha: 'yes', keyframes: 'yes' },
    permissions: ['fs:write-out'],
    editability: 'native',
    licenseReview: 'approved',
    ...overrides,
  };
}

function makeOkResult(
  connectorId: string,
  ctx: JobContext,
  job: JobRequest,
  outputType = 'video/mp4',
): AdapterJobResult {
  const uri = `${ctx.workDir}/out.mp4`;
  return {
    jobId: ctx.jobId,
    status: 'ok',
    outputs: [{ uri, type: outputType }],
    provenance: [
      {
        uri,
        type: outputType,
        sha256: VALID_SHA,
        contentSha256: 'b'.repeat(64),
        pluginId: connectorId,
        pluginVersion: '1.0.0',
        engineVersion: '1.0.0',
        params: { ...job.requirements },
        startedAt: '2026-11-23T10:00:00.000Z',
        durationMs: 12,
      },
    ],
    diagnostics: [],
  };
}

function makeFailedResult(
  ctx: JobContext,
  code: string,
  message: string,
  status: 'failed' | 'cancelled' = 'failed',
): AdapterJobResult {
  return {
    jobId: ctx.jobId,
    status,
    outputs: [],
    provenance: [],
    diagnostics: [{ code, message }],
  };
}

function makeAdapter(
  id: string,
  runImpl: (
    job: JobRequest,
    ctx: JobContext,
    callIndex: number,
  ) => Promise<AdapterJobResult>,
  probeImpl?: () => Promise<ProbeResult>,
): ConnectorAdapter {
  let calls = 0;
  return {
    simple: makeCardSimple(id),
    advanced: makeCardAdvanced(id),
    probe:
      probeImpl ??
      (async () => ({
        available: true,
        engineVersion: '1.0.0',
        diagnostics: [],
      })),
    run: async (job, ctx) => {
      calls += 1;
      return runImpl(job, ctx, calls);
    },
  };
}

function createContextFactory(root = 'C:/work/recovery') {
  return (attempt: { attemptNumber: number; connectorId: string; suffix: string }): JobContext => ({
    jobId: `job-${attempt.attemptNumber}-${attempt.suffix}`,
    workDir: `${root}/${attempt.connectorId}/attempt-${attempt.attemptNumber}-${attempt.suffix}`,
    timeoutMs: 5000,
  });
}

describe('@fme/recovery (FDN-072)', () => {
  test('clasifica deterministamente todas las categorías de fallo', () => {
    const baseCtx: JobContext = { jobId: 'j1', workDir: 'w1', timeoutMs: 1000 };

    assert.equal(
      classifyExecutionError(
        makeFailedResult(baseCtx, 'CUDA_ERR', 'CUDA out of memory while allocating texture'),
      ).category,
      'out-of-vram',
    );
    assert.equal(
      classifyExecutionError(
        makeFailedResult(baseCtx, 'WEBGPU', 'WebGPU device lost during render'),
      ).category,
      'out-of-vram',
    );
    assert.equal(
      classifyExecutionError(
        makeFailedResult(baseCtx, 'ENOMEM', 'JavaScript heap out of memory'),
      ).category,
      'out-of-ram',
    );
    assert.equal(
      classifyExecutionError(
        makeFailedResult(baseCtx, 'ETIMEDOUT', 'Process timed out after 5000ms'),
      ).category,
      'timeout',
    );
    assert.equal(
      classifyExecutionError(
        makeFailedResult(baseCtx, 'EBUSY', 'EPERM: resource busy or locked'),
      ).category,
      'transient',
    );
    assert.equal(
      classifyExecutionError(
        makeFailedResult(baseCtx, 'bad-requirements', 'Falta sceneId obligatorio'),
      ).category,
      'invalid-input',
    );
    assert.equal(
      classifyExecutionError(
        makeFailedResult(baseCtx, 'engine-missing', 'No se encontró blender.exe'),
      ).category,
      'engine-unavailable',
    );
    assert.equal(
      classifyExecutionError(
        makeFailedResult(baseCtx, 'CANCELLED', 'Cancelado por usuario', 'cancelled'),
      ).category,
      'cancelled',
    );
    assert.equal(
      classifyExecutionError(
        makeFailedResult(baseCtx, 'SIGSEGV', 'Process exited with non-zero exit code 139'),
      ).category,
      'engine-crash',
    );
    assert.equal(
      classifyExecutionError(
        makeFailedResult(baseCtx, 'WEIRD', 'Algo inesperado'),
      ).category,
      'unknown',
    );
  });

  test('falta de VRAM en preview reduce previewScale/samples, respeta inmutabilidad y valida checkAdapterResult', async () => {
    const registry = createConnectorRegistry();
    registry.register(makeCardSimple('adapter.gpu'), makeCardAdvanced('adapter.gpu'));
    const plan = planRoute(registry, {
      operation: 'render.3d',
      requiredCapabilities: ['render.3d'],
    });

    const seenRequirements: Array<Record<string, string | number | boolean>> = [];
    const gpuAdapter = makeAdapter('adapter.gpu', async (job, ctx, callIndex) => {
      seenRequirements.push({ ...job.requirements });
      if (callIndex === 1) {
        return makeFailedResult(ctx, 'OOM', 'CUDA out of memory at 4GB RTX 3050');
      }
      return makeOkResult('adapter.gpu', ctx, job);
    });

    const job: JobRequest = {
      projectId: 'proj-1',
      operation: 'render.3d',
      inputs: [{ uri: 'scene.json', type: 'fme/scene+json' }],
      requirements: { previewScale: 1, samples: 16 },
    };
    const cacheWrites: CacheStoreRecord[] = [];

    const outcome = await executeWithRecovery(
      plan,
      { 'adapter.gpu': gpuAdapter },
      job,
      createContextFactory(),
      {
        purpose: 'preview',
        sleep: instantSleep,
        onCacheStore: (entry) => {
          cacheWrites.push(entry);
        },
      },
    );

    assert.equal(outcome.outcome, 'ok');
    assert.equal(outcome.connectorId, 'adapter.gpu');
    assert.equal(outcome.degraded, true);
    assert.equal(outcome.attempts.length, 2);
    assert.deepEqual(seenRequirements[0], { previewScale: 1, samples: 16 });
    assert.deepEqual(seenRequirements[1], { previewScale: 0.5, samples: 8 });
    // Job original intacto
    assert.deepEqual(job.requirements, { previewScale: 1, samples: 16 });
    assert.deepEqual(checkAdapterResult(outcome.finalResult, gpuAdapter), []);
    assert.equal(cacheWrites.length, 1);
    assert.equal(cacheWrites[0]?.degraded, true);
  });

  test('falta de VRAM en final sin fallback NO reduce resolución ni muestras y escala al usuario', async () => {
    const registry = createConnectorRegistry();
    registry.register(makeCardSimple('adapter.gpu'), makeCardAdvanced('adapter.gpu'));
    const plan = planRoute(registry, {
      operation: 'render.3d',
      requiredCapabilities: ['render.3d'],
    });

    let calls = 0;
    const gpuAdapter = makeAdapter('adapter.gpu', async (_job, ctx) => {
      calls += 1;
      return makeFailedResult(ctx, 'out-of-vram', 'Insufficient GPU memory (4096 MB)');
    });

    const job: JobRequest = {
      projectId: 'proj-final',
      operation: 'render.3d',
      inputs: [{ uri: 'scene.json', type: 'fme/scene+json' }],
      requirements: { previewScale: 1, samples: 64 },
    };
    let cacheCalled = false;

    const outcome = await executeWithRecovery(
      plan,
      { 'adapter.gpu': gpuAdapter },
      job,
      createContextFactory(),
      {
        purpose: 'final',
        sleep: instantSleep,
        onCacheStore: () => {
          cacheCalled = true;
        },
      },
    );

    assert.equal(calls, 1);
    assert.equal(outcome.outcome, 'escalated');
    assert.equal(outcome.degraded, false);
    assert.equal(cacheCalled, false);
    assert.ok(outcome.constraintsReported.some((c) => c.includes('4096 MB')));
    assert.ok(outcome.suggestedActions.length >= 1);
  });

  test('reintento seguro ante transitorio y timeout usa workDir/jobId aislados y corta al agotar límite', async () => {
    const registry = createConnectorRegistry();
    registry.register(makeCardSimple('adapter.io'), makeCardAdvanced('adapter.io'));
    const plan = planRoute(registry, {
      operation: 'render.video',
      requiredCapabilities: ['render.video'],
    });

    const flakyAdapter = makeAdapter('adapter.io', async (job, ctx, callIndex) => {
      if (callIndex === 1) {
        return makeFailedResult(ctx, 'EBUSY', 'Archivo bloqueado temporalmente');
      }
      if (callIndex === 2) {
        return makeFailedResult(ctx, 'ETIMEDOUT', 'Process timed out');
      }
      return makeOkResult('adapter.io', ctx, job);
    });

    const job: JobRequest = {
      projectId: 'proj-retry',
      operation: 'render.video',
      inputs: [{ uri: 'scene.json', type: 'fme/scene+json' }],
      requirements: {},
    };

    const okOutcome = await executeWithRecovery(
      plan,
      { 'adapter.io': flakyAdapter },
      job,
      createContextFactory(),
      { maxTransientRetries: 2, sleep: instantSleep },
    );

    assert.equal(okOutcome.outcome, 'ok');
    assert.equal(okOutcome.attempts.length, 3);
    const workDirs = new Set(okOutcome.attempts.map((a) => a.workDir));
    const jobIds = new Set(okOutcome.attempts.map((a) => a.jobId));
    assert.equal(workDirs.size, 3);
    assert.equal(jobIds.size, 3);
    assert.deepEqual(checkAdapterResult(okOutcome.finalResult, flakyAdapter), []);

    // Corte acotado cuando todos los reintentos fallan
    const alwaysBusy = makeAdapter('adapter.io', async (_job, ctx) =>
      makeFailedResult(ctx, 'EPERM', 'EPERM persistent lock'),
    );
    const exhausted = await executeWithRecovery(
      plan,
      { 'adapter.io': alwaysBusy },
      job,
      createContextFactory(),
      { maxTransientRetries: 2, sleep: instantSleep },
    );
    assert.equal(exhausted.outcome, 'escalated');
    assert.equal(exhausted.attempts.length, 3); // 1 inicial + 2 reintentos
  });

  test('error determinista (invalid-input) hace 0 reintentos, 0 fallbacks y no toca caché', async () => {
    const registry = createConnectorRegistry();
    registry.register(makeCardSimple('adapter.a'), makeCardAdvanced('adapter.a'));
    registry.register(makeCardSimple('adapter.b'), makeCardAdvanced('adapter.b'));
    const plan = planRoute(registry, {
      operation: 'render.video',
      requiredCapabilities: ['render.video'],
    });

    let aCalls = 0;
    let bCalls = 0;
    let cacheCalled = false;

    const adapterA = makeAdapter('adapter.a', async (_job, ctx) => {
      aCalls += 1;
      return makeFailedResult(ctx, 'bad-requirements', 'Falta sceneId en requirements');
    });
    const adapterB = makeAdapter('adapter.b', async (job, ctx) => {
      bCalls += 1;
      return makeOkResult('adapter.b', ctx, job);
    });

    const outcome = await executeWithRecovery(
      plan,
      { 'adapter.a': adapterA, 'adapter.b': adapterB },
      {
        projectId: 'proj-bad',
        operation: 'render.video',
        inputs: [],
        requirements: {},
      },
      createContextFactory(),
      {
        sleep: instantSleep,
        onCacheStore: () => {
          cacheCalled = true;
        },
      },
    );

    assert.equal(outcome.outcome, 'escalated');
    assert.equal(aCalls, 1);
    assert.equal(bCalls, 0);
    assert.equal(cacheCalled, false);
    assert.equal(outcome.attempts[0]?.classification?.category, 'invalid-input');
  });

  test('conmuta a backend alternativo de RoutePlan verificando probe() y guarda solo éxito en caché', async () => {
    const registry = createConnectorRegistry();
    registry.register(
      makeCardSimple('adapter.1-primary'),
      makeCardAdvanced('adapter.1-primary'),
    );
    registry.register(
      makeCardSimple('adapter.2-broken-fb'),
      makeCardAdvanced('adapter.2-broken-fb'),
    );
    registry.register(
      makeCardSimple('adapter.3-healthy-fb'),
      makeCardAdvanced('adapter.3-healthy-fb'),
    );

    const plan = planRoute(registry, {
      operation: 'render.3d',
      requiredCapabilities: ['render.3d'],
      technical: { alpha: 'yes' },
    });
    assert.equal(plan.status, 'planned');
    assert.equal(plan.selected?.connectorId, 'adapter.1-primary');
    assert.deepEqual(
      plan.fallbacks.map((f) => f.connectorId),
      ['adapter.2-broken-fb', 'adapter.3-healthy-fb'],
    );

    let brokenFbRunCalls = 0;
    const primary = makeAdapter('adapter.1-primary', async (_job, ctx) =>
      makeFailedResult(ctx, 'SIGSEGV', 'Engine crash exit code 139'),
    );
    const brokenFallback = makeAdapter(
      'adapter.2-broken-fb',
      async (job, ctx) => {
        brokenFbRunCalls += 1;
        return makeOkResult('adapter.2-broken-fb', ctx, job);
      },
      async () => ({
        available: false,
        diagnostics: [{ code: 'engine-missing', message: 'Binario no instalado' }],
      }),
    );
    const healthyFallback = makeAdapter('adapter.3-healthy-fb', async (job, ctx) =>
      makeOkResult('adapter.3-healthy-fb', ctx, job),
    );

    const cacheWrites: CacheStoreRecord[] = [];
    const adapters = new Map<string, ConnectorAdapter>([
      ['adapter.1-primary', primary],
      ['adapter.2-broken-fb', brokenFallback],
      ['adapter.3-healthy-fb', healthyFallback],
    ]);

    const outcome = await executeWithRecovery(
      plan,
      adapters,
      {
        projectId: 'proj-fb',
        operation: 'render.3d',
        inputs: [{ uri: 'scene.json', type: 'fme/scene+json' }],
        requirements: { sceneId: 'main' },
      },
      createContextFactory(),
      {
        purpose: 'final',
        sleep: instantSleep,
        onCacheStore: (entry) => {
          cacheWrites.push(entry);
        },
      },
    );

    assert.equal(brokenFbRunCalls, 0);
    assert.equal(outcome.outcome, 'ok');
    assert.equal(outcome.connectorId, 'adapter.3-healthy-fb');
    assert.equal(outcome.degraded, false);
    assert.equal(outcome.attempts.length, 2);
    assert.deepEqual(
      checkAdapterResult(outcome.finalResult, healthyFallback),
      [],
    );
    assert.equal(cacheWrites.length, 1);
    assert.equal(cacheWrites[0]?.connectorId, 'adapter.3-healthy-fb');
    assert.ok(
      outcome.constraintsReported.some((c) => c.includes('adapter.2-broken-fb')),
    );
  });

  test('subdivide por frameRange en final cuando allowSubdivision=true ante VRAM insuficiente', async () => {
    const registry = createConnectorRegistry();
    registry.register(makeCardSimple('adapter.3d'), makeCardAdvanced('adapter.3d'));
    const plan = planRoute(registry, {
      operation: 'render.3d',
      requiredCapabilities: ['render.3d'],
    });

    const seenRanges: string[] = [];
    const adapter3d = makeAdapter('adapter.3d', async (job, ctx) => {
      const range = String(job.requirements.frameRange);
      seenRanges.push(range);
      if (range === '0-89') {
        return makeFailedResult(ctx, 'out-of-vram', 'VRAM 4GB insuficiente para 90 frames juntos');
      }
      return makeOkResult('adapter.3d', ctx, job);
    });

    const cacheWrites: CacheStoreRecord[] = [];
    const outcome = await executeWithRecovery(
      plan,
      { 'adapter.3d': adapter3d },
      {
        projectId: 'proj-subdiv',
        operation: 'render.3d',
        inputs: [{ uri: 'scene.json', type: 'fme/scene+json' }],
        requirements: { frameRange: '0-89' },
      },
      createContextFactory(),
      {
        purpose: 'final',
        allowSubdivision: true,
        sleep: instantSleep,
        onCacheStore: (entry) => {
          cacheWrites.push(entry);
        },
      },
    );

    assert.equal(outcome.outcome, 'ok');
    assert.equal(outcome.degraded, false);
    assert.deepEqual(seenRanges, ['0-89', '0-44', '45-89']);
    assert.equal(outcome.finalResult.outputs.length, 2);
    assert.equal(outcome.finalResult.provenance.length, 2);
    assert.deepEqual(checkAdapterResult(outcome.finalResult, adapter3d), []);
    assert.equal(cacheWrites.length, 1);

    // También escala limpio si el RoutePlan venía rechazado
    const rejectedPlan = planRoute(registry, {
      operation: 'unknown.op',
      requiredCapabilities: ['inexistente'],
    });
    const escalated = await executeWithRecovery(
      rejectedPlan,
      { 'adapter.3d': adapter3d },
      {
        projectId: 'proj-rej',
        operation: 'unknown.op',
        inputs: [],
        requirements: {},
      },
      createContextFactory(),
    );
    assert.equal(escalated.outcome, 'escalated');
    assert.equal(escalated.attempts.length, 0);
  });
});
