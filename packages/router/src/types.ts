/**
 * Tipos públicos de @fme/router (FDN-050).
 *
 * Modela las entradas, pasos de decisión, métricas de consumo de tarjetas,
 * rechazos por restricciones duras y planes de ejecución del enrutador de 8 pasos.
 */
import type {
  AdvancedSection,
  CardAdvanced,
  CardSimple,
  ConnectorRegistry,
  Executor,
  TechnicalExpectation,
} from '@fme/connectors';

/** Subconjunto mínimo de `ConnectorRegistry` consumido por el router. */
export type RouterRegistry = Pick<
  ConnectorRegistry,
  'listSimple' | 'inspect' | 'has' | 'size'
>;

/** Modos operativos del enrutador inteligente (§3 de arquitectura.md). */
export type RouteMode = 'auto' | 'manual' | 'hybrid';

/** Secuencia ordenada de 8 pasos del enrutador (§3 de arquitectura.md). */
export const ROUTE_STEP_NAMES = [
  'translate-requirements',
  'discover-simple',
  'filter-hard-simple',
  'inspect-advanced',
  'check-policy-availability',
  'score-and-select',
  'execution-plan',
  'fallback-strategy',
] as const;

export type RouteStepName = (typeof ROUTE_STEP_NAMES)[number];

/** Restricción declarativa sobre límites en `CardAdvanced.limits`. */
export type LimitRequirement =
  | {
      min?: number;
      max?: number;
      equals?: string | number;
    }
  | string
  | number;

/** Restricciones de permisos y revisión de licencia. */
export type RoutePolicy = {
  allowedPermissions?: readonly string[];
  deniedPermissions?: readonly string[];
  checkLicense?: boolean;
  requireApprovedLicense?: boolean;
};

/** Descripción de una tarea a enrutar sin acoplamiento a un backend concreto. */
export type RouteTask = {
  id?: string;
  operation: string;
  requiredCapabilities?: readonly string[];
  requiredAccepts?: readonly string[];
  requiredProduces?: readonly string[];
  technical?: Readonly<Record<string, TechnicalExpectation>>;
  requiredEditability?: readonly CardAdvanced['editability'][];
  requiredLimits?: Readonly<Record<string, LimitRequirement>>;
  policy?: RoutePolicy;
  availableConnectorIds?: readonly string[];
};

/** Opciones de modo, fijado manual o preferencias híbridas. */
export type RouteOptions = {
  mode?: RouteMode;
  manualConnectorId?: string;
  preferredConnectorIds?: readonly string[];
  excludedConnectorIds?: readonly string[];
  allowedExecutors?: readonly Executor[];
  pinnedByOperation?: Readonly<Record<string, string>>;
};

export type RouteRejectionCode =
  | 'INVALID_MANUAL_MODE'
  | 'CONNECTOR_NOT_FOUND'
  | 'EXCLUDED_BY_POLICY'
  | 'NOT_SELECTED_IN_MANUAL_MODE'
  | 'EXECUTOR_NOT_ALLOWED'
  | 'MISSING_CAPABILITY'
  | 'UNSUPPORTED_INPUT_FORMAT'
  | 'UNSUPPORTED_OUTPUT_FORMAT'
  | 'UNVERIFIED_TECHNICAL_REQUIREMENT'
  | 'TECHNICAL_REQUIREMENT_FAILED'
  | 'DENIED_PERMISSION'
  | 'PERMISSION_NOT_ALLOWED'
  | 'UNVERIFIED_PERMISSIONS'
  | 'BLOCKED_LICENSE'
  | 'UNAPPROVED_LICENSE'
  | 'UNVERIFIED_LICENSE'
  | 'INSUFFICIENT_EDITABILITY'
  | 'UNVERIFIED_EDITABILITY'
  | 'LIMIT_EXCEEDED'
  | 'UNVERIFIED_LIMIT_REQUIREMENT'
  | 'CONNECTOR_UNAVAILABLE';

export type RejectionRecord = {
  connectorId: string;
  step: RouteStepName;
  code: RouteRejectionCode;
  reason: string;
  violatedConstraint?: string;
};

export type CandidateScoreBreakdown = {
  connectorId: string;
  totalScore: number;
  factors: {
    capabilityCoverage: number;
    formatCoverage: number;
    editabilityScore: number;
    hybridPreference: number;
    executorPreference: number;
  };
  reasons: string[];
};

export type RankedCandidate = {
  connectorId: string;
  card: CardSimple;
  score: CandidateScoreBreakdown;
};

export type RouteStepTrace = {
  step: RouteStepName;
  status: 'ok' | 'rejected' | 'skipped';
  summary: string;
  candidatesRemaining: number;
  details?: Record<string, unknown>;
};

export type RouteMetrics = {
  simpleCardsRead: number;
  advancedInspections: number;
  advancedSectionsRequested: number;
  inspectedByConnector: Record<string, AdvancedSection[]>;
};

export type FallbackStrategy = {
  retryable: boolean;
  alternativeConnectorIds: string[];
  onFailureAction: 'fallback-connector' | 'retry-safe' | 'escalate-user';
  rationale: string;
};

export type RouteError = {
  code: RouteRejectionCode;
  message: string;
  connectorId?: string;
  violatedConstraint?: string;
};

export type RoutePlan = {
  status: 'planned' | 'rejected';
  mode: RouteMode;
  operation: string;
  selected: RankedCandidate | null;
  fallbacks: RankedCandidate[];
  rejections: RejectionRecord[];
  justification: string;
  metrics: RouteMetrics;
  steps: RouteStepTrace[];
  fallbackStrategy: FallbackStrategy;
  error?: RouteError;
};

export type WorkflowTaskPlan = {
  taskIndex: number;
  task: RouteTask;
  modeUsed: RouteMode;
  plan: RoutePlan;
};

export type WorkflowRoutePlan = {
  status: 'planned' | 'partial' | 'rejected';
  tasks: WorkflowTaskPlan[];
  metrics: {
    totalSimpleCardsRead: number;
    totalAdvancedInspections: number;
    totalAdvancedSectionsRequested: number;
  };
  justification: string;
};
