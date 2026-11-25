/**
 * Núcleo del enrutador inteligente en 8 pasos (FDN-050, §3 de arquitectura.md).
 *
 * Evalúa tarjetas simples primero, inspecciona secciones avanzadas estrictamente bajo demanda,
 * aplica restricciones duras sin compensación por puntuación y nunca asume compatibilidad
 * ante valores `'unknown'` o ausentes.
 */
import type {
  AdvancedSection,
  CardAdvanced,
  CardSimple,
  Executor,
  TechnicalExpectation,
} from '@fme/connectors';
import type {
  CandidateScoreBreakdown,
  FallbackStrategy,
  LimitRequirement,
  RankedCandidate,
  RejectionRecord,
  RouteError,
  RouteMetrics,
  RouteMode,
  RouteOptions,
  RoutePlan,
  RoutePolicy,
  RouteRejectionCode,
  RouteStepName,
  RouteStepTrace,
  RouteTask,
  RouterRegistry,
  WorkflowRoutePlan,
  WorkflowTaskPlan,
} from './types.js';

type NormalizedTask = {
  operation: string;
  requiredCapabilities: string[];
  requiredAccepts: string[];
  requiredProduces: string[];
  technicalRequirements: Array<[string, TechnicalExpectation]>;
  requiredEditability?: readonly CardAdvanced['editability'][];
  requiredLimits: Array<[string, LimitRequirement]>;
  policy: RoutePolicy;
  availableSet?: ReadonlySet<string>;
};

type CandidateContext = {
  card: CardSimple;
  inspectedHasAdvanced?: boolean;
  inspectedSections?: Partial<Pick<CardAdvanced, AdvancedSection>>;
};

const EDITABILITY_SCORE: Record<CardAdvanced['editability'], number> = {
  native: 20,
  linked: 12,
  baked: 4,
  unknown: 0,
};

const EXECUTOR_SCORE: Record<Executor, number> = {
  library: 6,
  cli: 5,
  api: 4,
  mcp: 3,
};

function makeRejection(
  connectorId: string,
  step: RouteStepName,
  code: RouteRejectionCode,
  reason: string,
  violatedConstraint?: string,
): RejectionRecord {
  return {
    connectorId,
    step,
    code,
    reason,
    ...(violatedConstraint !== undefined ? { violatedConstraint } : {}),
  };
}

function normalizeTask(task: RouteTask): NormalizedTask {
  return {
    operation: task.operation,
    requiredCapabilities: [...(task.requiredCapabilities ?? [])],
    requiredAccepts: [...(task.requiredAccepts ?? [])],
    requiredProduces: [...(task.requiredProduces ?? [])],
    technicalRequirements: Object.entries(task.technical ?? {}),
    ...(task.requiredEditability !== undefined
      ? { requiredEditability: [...task.requiredEditability] }
      : {}),
    requiredLimits: Object.entries(task.requiredLimits ?? {}),
    policy: task.policy ?? {},
    ...(task.availableConnectorIds !== undefined
      ? { availableSet: new Set(task.availableConnectorIds) }
      : {}),
  };
}

function resolveSectionsNeeded(normalized: NormalizedTask): AdvancedSection[] {
  const sections: AdvancedSection[] = [];
  if (normalized.technicalRequirements.length > 0) {
    sections.push('technical');
  }
  if (normalized.requiredLimits.length > 0) {
    sections.push('limits');
  }
  if (
    normalized.policy.allowedPermissions !== undefined ||
    normalized.policy.deniedPermissions !== undefined
  ) {
    sections.push('permissions');
  }
  if (normalized.requiredEditability !== undefined) {
    sections.push('editability');
  }
  if (
    normalized.policy.checkLicense === true ||
    normalized.policy.requireApprovedLicense === true
  ) {
    sections.push('licenseReview');
  }
  return sections;
}

function filterSimpleCandidate(
  card: CardSimple,
  normalized: NormalizedTask,
  mode: RouteMode,
  manualConnectorId: string | undefined,
  excludedSet: ReadonlySet<string>,
  allowedExecutorsSet: ReadonlySet<Executor> | undefined,
): RejectionRecord | null {
  if (mode === 'manual' && card.id !== manualConnectorId) {
    return makeRejection(
      card.id,
      'filter-hard-simple',
      'NOT_SELECTED_IN_MANUAL_MODE',
      `Descartado porque el modo manual exige el conector "${manualConnectorId ?? ''}".`,
      'manualConnectorId',
    );
  }

  if (excludedSet.has(card.id)) {
    return makeRejection(
      card.id,
      'filter-hard-simple',
      'EXCLUDED_BY_POLICY',
      `Conector "${card.id}" excluido explícitamente por opciones híbridas/política.`,
      'excludedConnectorIds',
    );
  }

  if (
    allowedExecutorsSet !== undefined &&
    !allowedExecutorsSet.has(card.executor)
  ) {
    return makeRejection(
      card.id,
      'filter-hard-simple',
      'EXECUTOR_NOT_ALLOWED',
      `Ejecutor "${card.executor}" no está permitido por allowedExecutors.`,
      `executor:${card.executor}`,
    );
  }

  for (const cap of normalized.requiredCapabilities) {
    if (!card.capabilities.includes(cap)) {
      return makeRejection(
        card.id,
        'filter-hard-simple',
        'MISSING_CAPABILITY',
        `Falta la capacidad requerida "${cap}" en la tarjeta simple.`,
        `capability:${cap}`,
      );
    }
  }

  for (const accept of normalized.requiredAccepts) {
    if (!card.accepts.includes(accept)) {
      return makeRejection(
        card.id,
        'filter-hard-simple',
        'UNSUPPORTED_INPUT_FORMAT',
        `No acepta el formato de entrada requerido "${accept}".`,
        `accepts:${accept}`,
      );
    }
  }

  for (const produce of normalized.requiredProduces) {
    if (!card.produces.includes(produce)) {
      return makeRejection(
        card.id,
        'filter-hard-simple',
        'UNSUPPORTED_OUTPUT_FORMAT',
        `No produce el formato de salida requerido "${produce}".`,
        `produces:${produce}`,
      );
    }
  }

  return null;
}

function validateTechnicalSection(
  candidate: CandidateContext,
  requirements: readonly (readonly [string, TechnicalExpectation])[],
): RejectionRecord | null {
  if (requirements.length === 0) {
    return null;
  }

  if (
    candidate.inspectedHasAdvanced !== true ||
    candidate.inspectedSections?.technical === undefined
  ) {
    const firstKey = requirements[0]?.[0] ?? 'technical';
    return makeRejection(
      candidate.card.id,
      'inspect-advanced',
      'UNVERIFIED_TECHNICAL_REQUIREMENT',
      `El conector "${candidate.card.id}" no tiene sección "technical" verificada para "${firstKey}"; requiere prueba o verificación.`,
      `technical:${firstKey}`,
    );
  }

  const technical = candidate.inspectedSections.technical;
  for (const [key, expected] of requirements) {
    const actual = technical[key] ?? 'unknown';
    if (actual === 'unknown') {
      return makeRejection(
        candidate.card.id,
        'inspect-advanced',
        'UNVERIFIED_TECHNICAL_REQUIREMENT',
        `Requisito técnico "${key}" es "unknown" (o ausente) en "${candidate.card.id}"; requiere inspección/prueba antes de aprobar.`,
        `technical:${key}`,
      );
    }
    if (actual !== expected) {
      return makeRejection(
        candidate.card.id,
        'inspect-advanced',
        'TECHNICAL_REQUIREMENT_FAILED',
        `Requisito técnico "${key}" vale "${actual}" y se exigía "${expected}".`,
        `technical:${key}`,
      );
    }
  }

  return null;
}

function validatePolicyAndAvailability(
  candidate: CandidateContext,
  normalized: NormalizedTask,
): RejectionRecord | null {
  const id = candidate.card.id;

  if (
    normalized.availableSet !== undefined &&
    !normalized.availableSet.has(id)
  ) {
    return makeRejection(
      id,
      'check-policy-availability',
      'CONNECTOR_UNAVAILABLE',
      `El conector "${id}" no está disponible en el entorno actual.`,
      'availableConnectorIds',
    );
  }

  const policy = normalized.policy;
  if (
    policy.allowedPermissions !== undefined ||
    policy.deniedPermissions !== undefined
  ) {
    const permissions = candidate.inspectedSections?.permissions;
    if (candidate.inspectedHasAdvanced !== true || permissions === undefined) {
      return makeRejection(
        id,
        'check-policy-availability',
        'UNVERIFIED_PERMISSIONS',
        `No se pudieron verificar los permisos de "${id}" sin tarjeta avanzada.`,
        'permissions',
      );
    }

    if (policy.deniedPermissions !== undefined) {
      const deniedSet = new Set(policy.deniedPermissions);
      for (const perm of permissions) {
        if (deniedSet.has(perm)) {
          return makeRejection(
            id,
            'check-policy-availability',
            'DENIED_PERMISSION',
            `El permiso "${perm}" requerido por "${id}" está denegado por la política.`,
            `permission:${perm}`,
          );
        }
      }
    }

    if (policy.allowedPermissions !== undefined) {
      const allowedSet = new Set(policy.allowedPermissions);
      for (const perm of permissions) {
        if (!allowedSet.has(perm)) {
          return makeRejection(
            id,
            'check-policy-availability',
            'PERMISSION_NOT_ALLOWED',
            `El permiso "${perm}" requerido por "${id}" no está en allowedPermissions.`,
            `permission:${perm}`,
          );
        }
      }
    }
  }

  if (policy.checkLicense === true || policy.requireApprovedLicense === true) {
    const license = candidate.inspectedSections?.licenseReview;
    if (candidate.inspectedHasAdvanced !== true || license === undefined) {
      return makeRejection(
        id,
        'check-policy-availability',
        'UNVERIFIED_LICENSE',
        `No se pudo verificar el estado de licencia de "${id}".`,
        'licenseReview',
      );
    }
    if (license === 'blocked') {
      return makeRejection(
        id,
        'check-policy-availability',
        'BLOCKED_LICENSE',
        `La licencia de "${id}" está marcada como "blocked".`,
        'licenseReview:blocked',
      );
    }
    if (policy.requireApprovedLicense === true && license !== 'approved') {
      return makeRejection(
        id,
        'check-policy-availability',
        'UNAPPROVED_LICENSE',
        `La política exige licencia "approved" y "${id}" tiene "${license}".`,
        `licenseReview:${license}`,
      );
    }
  }

  if (normalized.requiredEditability !== undefined) {
    const editability = candidate.inspectedSections?.editability;
    if (candidate.inspectedHasAdvanced !== true || editability === undefined) {
      return makeRejection(
        id,
        'check-policy-availability',
        'UNVERIFIED_EDITABILITY',
        `No se pudo verificar la editabilidad de "${id}".`,
        'editability',
      );
    }
    if (!normalized.requiredEditability.includes(editability)) {
      return makeRejection(
        id,
        'check-policy-availability',
        'INSUFFICIENT_EDITABILITY',
        `La editabilidad "${editability}" de "${id}" no satisface lo requerido (${normalized.requiredEditability.join(', ')}).`,
        `editability:${editability}`,
      );
    }
  }

  if (normalized.requiredLimits.length > 0) {
    const limits = candidate.inspectedSections?.limits;
    if (candidate.inspectedHasAdvanced !== true || limits === undefined) {
      const firstLimit = normalized.requiredLimits[0]?.[0] ?? 'limits';
      return makeRejection(
        id,
        'check-policy-availability',
        'UNVERIFIED_LIMIT_REQUIREMENT',
        `No existen límites verificados para "${firstLimit}" en "${id}".`,
        `limits:${firstLimit}`,
      );
    }

    for (const [key, requirement] of normalized.requiredLimits) {
      const actual = limits[key];
      if (actual === undefined) {
        return makeRejection(
          id,
          'check-policy-availability',
          'UNVERIFIED_LIMIT_REQUIREMENT',
          `Falta el límite "${key}" en la tarjeta avanzada de "${id}".`,
          `limits:${key}`,
        );
      }

      if (typeof requirement === 'string' || typeof requirement === 'number') {
        if (actual !== requirement) {
          return makeRejection(
            id,
            'check-policy-availability',
            'LIMIT_EXCEEDED',
            `El límite "${key}" vale "${String(actual)}" y se exigía "${String(requirement)}".`,
            `limits:${key}`,
          );
        }
        continue;
      }

      if (
        requirement.equals !== undefined &&
        actual !== requirement.equals
      ) {
        return makeRejection(
          id,
          'check-policy-availability',
          'LIMIT_EXCEEDED',
          `El límite "${key}" vale "${String(actual)}" y se exigía "${String(requirement.equals)}".`,
          `limits:${key}`,
        );
      }

      if (requirement.min !== undefined) {
        if (typeof actual !== 'number' || actual < requirement.min) {
          return makeRejection(
            id,
            'check-policy-availability',
            'LIMIT_EXCEEDED',
            `El límite "${key}" (${String(actual)}) es inferior al mínimo ${requirement.min}.`,
            `limits:${key}`,
          );
        }
      }

      if (requirement.max !== undefined) {
        if (typeof actual !== 'number' || actual > requirement.max) {
          return makeRejection(
            id,
            'check-policy-availability',
            'LIMIT_EXCEEDED',
            `El límite "${key}" (${String(actual)}) supera el máximo ${requirement.max}.`,
            `limits:${key}`,
          );
        }
      }
    }
  }

  return null;
}

function scoreCandidate(
  candidate: CandidateContext,
  normalized: NormalizedTask,
  preferredSet: ReadonlySet<string>,
): RankedCandidate {
  const card = candidate.card;
  const reasons: string[] = [];

  const capCount = normalized.requiredCapabilities.length;
  const capabilityCoverage = capCount > 0 ? capCount * 20 : 10;
  reasons.push(
    capCount > 0
      ? `Cubre ${capCount}/${capCount} capacidades requeridas (+${capabilityCoverage}).`
      : `Sin capacidades obligatorias restringidas (+${capabilityCoverage}).`,
  );

  const formatCount =
    normalized.requiredAccepts.length + normalized.requiredProduces.length;
  const formatCoverage = formatCount > 0 ? formatCount * 10 : 5;
  reasons.push(
    formatCount > 0
      ? `Compatible con ${formatCount} formatos requeridos (+${formatCoverage}).`
      : `Sin formatos restringidos (+${formatCoverage}).`,
  );

  const editability = candidate.inspectedSections?.editability;
  const editabilityScore =
    editability !== undefined ? EDITABILITY_SCORE[editability] : 0;
  if (editability !== undefined) {
    reasons.push(`Editabilidad "${editability}" (+${editabilityScore}).`);
  }

  const hybridPreference = preferredSet.has(card.id) ? 50 : 0;
  if (hybridPreference > 0) {
    reasons.push(`Priorizado por preferencia híbrida (+${hybridPreference}).`);
  }

  const executorPreference = EXECUTOR_SCORE[card.executor];
  reasons.push(`Ejecutor "${card.executor}" (+${executorPreference}).`);

  const totalScore =
    capabilityCoverage +
    formatCoverage +
    editabilityScore +
    hybridPreference +
    executorPreference;

  return {
    connectorId: card.id,
    card,
    score: {
      connectorId: card.id,
      totalScore,
      factors: {
        capabilityCoverage,
        formatCoverage,
        editabilityScore,
        hybridPreference,
        executorPreference,
      },
      reasons,
    },
  };
}

function compareRankedCandidates(a: RankedCandidate, b: RankedCandidate): number {
  if (b.score.totalScore !== a.score.totalScore) {
    return b.score.totalScore - a.score.totalScore;
  }
  if (a.connectorId < b.connectorId) return -1;
  if (a.connectorId > b.connectorId) return 1;
  return 0;
}

const STEP_DEPTH: Record<RouteStepName, number> = {
  'translate-requirements': 1,
  'discover-simple': 2,
  'filter-hard-simple': 3,
  'inspect-advanced': 4,
  'check-policy-availability': 5,
  'score-and-select': 6,
  'execution-plan': 7,
  'fallback-strategy': 8,
};

function buildErrorForRejection(
  mode: RouteMode,
  manualConnectorId: string | undefined,
  rejections: readonly RejectionRecord[],
): RouteError {
  if (mode === 'manual') {
    if (manualConnectorId === undefined || manualConnectorId.trim().length === 0) {
      return {
        code: 'INVALID_MANUAL_MODE',
        message: 'El modo manual requiere especificar manualConnectorId.',
        violatedConstraint: 'manualConnectorId',
      };
    }
    const targetRejection = rejections.find(
      (r) => r.connectorId === manualConnectorId,
    );
    if (targetRejection !== undefined) {
      return {
        code: targetRejection.code,
        message: targetRejection.reason,
        connectorId: targetRejection.connectorId,
        ...(targetRejection.violatedConstraint !== undefined
          ? { violatedConstraint: targetRejection.violatedConstraint }
          : {}),
      };
    }
  }

  // Priorizar el rechazo del candidato que llegó más lejos en los 8 pasos
  let primary: RejectionRecord | undefined;
  for (const candidate of rejections) {
    if (candidate.code === 'NOT_SELECTED_IN_MANUAL_MODE') {
      continue;
    }
    if (
      primary === undefined ||
      STEP_DEPTH[candidate.step] > STEP_DEPTH[primary.step]
    ) {
      primary = candidate;
    }
  }
  primary ??= rejections[0];

  if (primary !== undefined) {
    return {
      code: primary.code,
      message: primary.reason,
      connectorId: primary.connectorId,
      ...(primary.violatedConstraint !== undefined
        ? { violatedConstraint: primary.violatedConstraint }
        : {}),
    };
  }

  return {
    code: 'CONNECTOR_NOT_FOUND',
    message: 'No hay conectores registrados para satisfacer la tarea.',
  };
}

function buildFallbackStrategy(
  selected: RankedCandidate | null,
  fallbacks: readonly RankedCandidate[],
): FallbackStrategy {
  if (selected === null) {
    return {
      retryable: false,
      alternativeConnectorIds: [],
      onFailureAction: 'escalate-user',
      rationale:
        'Ningún conector superó las restricciones duras; escalar al usuario o ampliar registro/verificaciones.',
    };
  }
  if (fallbacks.length > 0) {
    const ids = fallbacks.map((f) => f.connectorId);
    return {
      retryable: true,
      alternativeConnectorIds: ids,
      onFailureAction: 'fallback-connector',
      rationale: `Si "${selected.connectorId}" falla en ejecución, reintentar de forma segura o conmutar a: ${ids.join(', ')}.`,
    };
  }
  return {
    retryable: true,
    alternativeConnectorIds: [],
    onFailureAction: 'retry-safe',
    rationale: `Sin sustitutos compatibles para "${selected.connectorId}"; permitir reintento seguro o escalar si persiste el fallo.`,
  };
}

/**
 * Ejecuta la secuencia completa de 8 pasos para planificar una tarea sobre `registry`
 * sin ejecutar trabajos ni mutar el registro.
 */
export function planRoute(
  registry: RouterRegistry,
  task: RouteTask,
  options: RouteOptions = {},
): RoutePlan {
  const mode: RouteMode = options.mode ?? 'auto';
  const pinnedForTask =
    (task.id !== undefined ? options.pinnedByOperation?.[task.id] : undefined) ??
    options.pinnedByOperation?.[task.operation];
  const effectiveMode: RouteMode =
    pinnedForTask !== undefined && mode !== 'manual' ? 'manual' : mode;
  const manualConnectorId =
    effectiveMode === 'manual'
      ? options.manualConnectorId ?? pinnedForTask
      : undefined;

  const normalized = normalizeTask(task);
  const excludedSet = new Set(options.excludedConnectorIds ?? []);
  const preferredSet = new Set(options.preferredConnectorIds ?? []);
  const allowedExecutorsSet =
    options.allowedExecutors !== undefined
      ? new Set(options.allowedExecutors)
      : undefined;

  const rejections: RejectionRecord[] = [];
  const steps: RouteStepTrace[] = [];
  const metrics: RouteMetrics = {
    simpleCardsRead: 0,
    advancedInspections: 0,
    advancedSectionsRequested: 0,
    inspectedByConnector: {},
  };

  // Paso 1: translate-requirements
  const sectionsNeeded = resolveSectionsNeeded(normalized);
  steps.push({
    step: 'translate-requirements',
    status: 'ok',
    summary: `Operación "${normalized.operation}" traducida (${normalized.requiredCapabilities.length} capacidades, ${normalized.technicalRequirements.length} requisitos técnicos, ${sectionsNeeded.length} secciones avanzadas necesarias).`,
    candidatesRemaining: 0,
    details: {
      mode: effectiveMode,
      sectionsNeeded,
    },
  });

  // Paso 2: discover-simple
  const discovered = registry.listSimple();
  metrics.simpleCardsRead = discovered.length;
  let candidates: CandidateContext[] = discovered.map((entry) => ({
    card: entry.card,
  }));

  steps.push({
    step: 'discover-simple',
    status: candidates.length > 0 ? 'ok' : 'rejected',
    summary: `Leídas ${metrics.simpleCardsRead} tarjetas simples desde el registro.`,
    candidatesRemaining: candidates.length,
  });

  // Paso 3: filter-hard-simple
  if (
    effectiveMode === 'manual' &&
    (manualConnectorId === undefined || manualConnectorId.trim().length === 0)
  ) {
    rejections.push(
      makeRejection(
        '',
        'filter-hard-simple',
        'INVALID_MANUAL_MODE',
        'El modo manual requiere especificar manualConnectorId.',
        'manualConnectorId',
      ),
    );
    candidates = [];
  } else {
    if (
      effectiveMode === 'manual' &&
      manualConnectorId !== undefined &&
      !candidates.some((c) => c.card.id === manualConnectorId)
    ) {
      rejections.push(
        makeRejection(
          manualConnectorId,
          'filter-hard-simple',
          'CONNECTOR_NOT_FOUND',
          `El conector manual "${manualConnectorId}" no existe en el registro.`,
          'manualConnectorId',
        ),
      );
    }

    const simpleSurvivors: CandidateContext[] = [];
    for (const candidate of candidates) {
      const rejection = filterSimpleCandidate(
        candidate.card,
        normalized,
        effectiveMode,
        manualConnectorId,
        excludedSet,
        allowedExecutorsSet,
      );
      if (rejection !== null) {
        rejections.push(rejection);
      } else {
        simpleSurvivors.push(candidate);
      }
    }
    candidates = simpleSurvivors;
  }

  steps.push({
    step: 'filter-hard-simple',
    status: candidates.length > 0 ? 'ok' : 'rejected',
    summary:
      candidates.length > 0
        ? `${candidates.length} candidato(s) superan el filtrado de tarjeta simple.`
        : 'Ningún candidato superó el filtrado de tarjeta simple.',
    candidatesRemaining: candidates.length,
  });

  // Paso 4: inspect-advanced
  if (candidates.length === 0) {
    steps.push({
      step: 'inspect-advanced',
      status: 'skipped',
      summary: 'Omitido: no quedan candidatos tras el filtrado simple.',
      candidatesRemaining: 0,
    });
  } else if (sectionsNeeded.length === 0) {
    steps.push({
      step: 'inspect-advanced',
      status: 'ok',
      summary:
        'Sin inspección avanzada necesaria: la tarjeta simple basta para todos los requisitos.',
      candidatesRemaining: candidates.length,
    });
  } else {
    const technicalSurvivors: CandidateContext[] = [];
    for (const candidate of candidates) {
      const inspected = registry.inspect(candidate.card.id, sectionsNeeded);
      metrics.advancedInspections += 1;
      metrics.advancedSectionsRequested += sectionsNeeded.length;
      metrics.inspectedByConnector[candidate.card.id] = [...sectionsNeeded];

      candidate.inspectedHasAdvanced = inspected.hasAdvanced;
      candidate.inspectedSections = inspected.sections;

      const techRejection = validateTechnicalSection(
        candidate,
        normalized.technicalRequirements,
      );
      if (techRejection !== null) {
        rejections.push(techRejection);
      } else {
        technicalSurvivors.push(candidate);
      }
    }
    candidates = technicalSurvivors;

    steps.push({
      step: 'inspect-advanced',
      status: candidates.length > 0 ? 'ok' : 'rejected',
      summary: `Inspeccionadas secciones [${sectionsNeeded.join(', ')}] en ${metrics.advancedInspections} candidato(s); quedan ${candidates.length}.`,
      candidatesRemaining: candidates.length,
      details: {
        sectionsRequested: sectionsNeeded,
        advancedSectionsRequested: metrics.advancedSectionsRequested,
      },
    });
  }

  // Paso 5: check-policy-availability
  if (candidates.length === 0) {
    steps.push({
      step: 'check-policy-availability',
      status: 'skipped',
      summary: 'Omitido: sin candidatos pendientes de validar.',
      candidatesRemaining: 0,
    });
  } else {
    const policySurvivors: CandidateContext[] = [];
    for (const candidate of candidates) {
      const policyRejection = validatePolicyAndAvailability(
        candidate,
        normalized,
      );
      if (policyRejection !== null) {
        rejections.push(policyRejection);
      } else {
        policySurvivors.push(candidate);
      }
    }
    candidates = policySurvivors;

    steps.push({
      step: 'check-policy-availability',
      status: candidates.length > 0 ? 'ok' : 'rejected',
      summary:
        candidates.length > 0
          ? `${candidates.length} candidato(s) cumplen disponibilidad, permisos, licencia, editabilidad y límites.`
          : 'Todos los candidatos restantes incumplieron restricciones duras de política/disponibilidad.',
      candidatesRemaining: candidates.length,
    });
  }

  // Paso 6: score-and-select
  let ranked: RankedCandidate[] = [];
  if (candidates.length === 0) {
    steps.push({
      step: 'score-and-select',
      status: 'skipped',
      summary: 'Omitido: no hay candidatos compatibles para puntuar.',
      candidatesRemaining: 0,
    });
  } else {
    ranked = candidates
      .map((c) => scoreCandidate(c, normalized, preferredSet))
      .sort(compareRankedCandidates);

    steps.push({
      step: 'score-and-select',
      status: 'ok',
      summary: `Seleccionado "${ranked[0]?.connectorId ?? ''}" (puntuación ${ranked[0]?.score.totalScore ?? 0}) con ${Math.max(0, ranked.length - 1)} alternativa(s).`,
      candidatesRemaining: ranked.length,
    });
  }

  const selected = ranked[0] ?? null;
  const fallbacks = ranked.slice(1);

  // Paso 7: execution-plan
  const status: RoutePlan['status'] = selected !== null ? 'planned' : 'rejected';
  const error =
    selected === null
      ? buildErrorForRejection(effectiveMode, manualConnectorId, rejections)
      : undefined;

  const justification =
    selected !== null
      ? `Seleccionado "${selected.connectorId}" (${selected.card.name} v${selected.card.version}) en modo ${effectiveMode} para "${normalized.operation}" con puntuación ${selected.score.totalScore}. ${selected.score.reasons.join(' ')}`
      : `Ruta rechazada en modo ${effectiveMode} para "${normalized.operation}": ${error?.message ?? 'sin candidatos válidos.'}`;

  steps.push({
    step: 'execution-plan',
    status: status === 'planned' ? 'ok' : 'rejected',
    summary:
      status === 'planned'
        ? `Plan preparado para "${selected?.connectorId ?? ''}" sin ejecutar trabajos.`
        : `Plan rechazado: ${error?.code ?? 'REJECTED'}.`,
    candidatesRemaining: ranked.length,
  });

  // Paso 8: fallback-strategy
  const fallbackStrategy = buildFallbackStrategy(selected, fallbacks);
  steps.push({
    step: 'fallback-strategy',
    status: status === 'planned' ? 'ok' : 'rejected',
    summary: `Estrategia ante fallo: ${fallbackStrategy.onFailureAction} (${fallbackStrategy.alternativeConnectorIds.length} alternativa(s)).`,
    candidatesRemaining: ranked.length,
  });

  return {
    status,
    mode: effectiveMode,
    operation: normalized.operation,
    selected,
    fallbacks,
    rejections,
    justification,
    metrics,
    steps,
    fallbackStrategy,
    ...(error !== undefined ? { error } : {}),
  };
}

/**
 * Planifica un flujo multi-tarea soportando modo híbrido con pasos fijados manualmente
 * (`pinnedByOperation` por `task.id` o `task.operation`) y selección automática en el resto.
 */
export function planWorkflow(
  registry: RouterRegistry,
  tasks: readonly RouteTask[],
  options: RouteOptions = {},
): WorkflowRoutePlan {
  const plannedTasks: WorkflowTaskPlan[] = [];
  let totalSimpleCardsRead = 0;
  let totalAdvancedInspections = 0;
  let totalAdvancedSectionsRequested = 0;
  let plannedCount = 0;

  for (let i = 0; i < tasks.length; i += 1) {
    const task = tasks[i];
    if (task === undefined) {
      continue;
    }
    const pinnedId =
      (task.id !== undefined ? options.pinnedByOperation?.[task.id] : undefined) ??
      options.pinnedByOperation?.[task.operation];

    const taskMode: RouteMode =
      pinnedId !== undefined
        ? 'manual'
        : options.mode === 'manual'
          ? 'manual'
          : options.mode ?? 'auto';

    const taskOptions: RouteOptions = {
      ...options,
      mode: taskMode,
      ...(pinnedId !== undefined ? { manualConnectorId: pinnedId } : {}),
    };

    const plan = planRoute(registry, task, taskOptions);
    if (plan.status === 'planned') {
      plannedCount += 1;
    }

    totalSimpleCardsRead += plan.metrics.simpleCardsRead;
    totalAdvancedInspections += plan.metrics.advancedInspections;
    totalAdvancedSectionsRequested += plan.metrics.advancedSectionsRequested;

    plannedTasks.push({
      taskIndex: i,
      task,
      modeUsed: plan.mode,
      plan,
    });
  }

  const workflowStatus: WorkflowRoutePlan['status'] =
    plannedTasks.length > 0 && plannedCount === plannedTasks.length
      ? 'planned'
      : plannedCount > 0
        ? 'partial'
        : 'rejected';

  return {
    status: workflowStatus,
    tasks: plannedTasks,
    metrics: {
      totalSimpleCardsRead,
      totalAdvancedInspections,
      totalAdvancedSectionsRequested,
    },
    justification: `Flujo de ${plannedTasks.length} tarea(s): ${plannedCount} planificada(s), ${plannedTasks.length - plannedCount} rechazada(s).`,
  };
}
