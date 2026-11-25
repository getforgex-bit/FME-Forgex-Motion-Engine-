/**
 * Tipos públicos de @fme/recovery (FDN-072).
 *
 * Modela categorías de fallo, políticas de degradación/subdivisión VRAM
 * (modo 'preview' frente a 'final'), trazabilidad de intentos y escalado seguro.
 */
import type {
  AdapterJobResult,
  ConnectorAdapter,
  JobContext,
  JobRequest,
} from '@fme/connectors';

export type ExecutionFailureCategory =
  | 'out-of-vram'
  | 'out-of-ram'
  | 'timeout'
  | 'transient'
  | 'invalid-input'
  | 'unsupported-capability'
  | 'engine-unavailable'
  | 'cancelled'
  | 'engine-crash'
  | 'unknown';

export type ExecutionPurpose = 'preview' | 'final';

export type ErrorClassification = {
  category: ExecutionFailureCategory;
  retryable: boolean;
  degradable: boolean;
  fallbackEligible: boolean;
  reason: string;
  matchedCodes: string[];
};

export type AttemptMitigation = {
  type:
    | 'retry-safe'
    | 'reduce-preview-scale'
    | 'reduce-samples'
    | 'subdivide-segments'
    | 'fallback-connector';
  detail: string;
  appliedRequirements?: Record<string, string | number | boolean>;
};

export type ExecutionAttempt = {
  attemptNumber: number;
  connectorId: string;
  jobId: string;
  workDir: string;
  status: AdapterJobResult['status'] | 'threw';
  durationMs: number;
  classification?: ErrorClassification;
  mitigation?: AttemptMitigation;
  result?: AdapterJobResult;
  errorMessage?: string;
};

export type RecoveryAction =
  | 'retry'
  | 'degrade-preview'
  | 'subdivide'
  | 'fallback'
  | 'escalate-user';

export type RecoveryDecision = {
  action: RecoveryAction;
  reason: string;
  nextRequirements?: Record<string, string | number | boolean>;
  mitigations?: AttemptMitigation[];
  segmentCount?: number;
  constraintMessage?: string;
  suggestedActions?: string[];
};

export type AttemptContextInput = {
  attemptNumber: number;
  connectorId: string;
  suffix: string;
};

export type AttemptContextFactory = (attempt: AttemptContextInput) => JobContext;

export type AdapterMap =
  | ReadonlyMap<string, ConnectorAdapter>
  | Readonly<Record<string, ConnectorAdapter>>;

export type CacheStoreRecord = {
  connectorId: string;
  job: JobRequest;
  result: AdapterJobResult;
  degraded: boolean;
};

export type RecoveryOptions = {
  /** 'preview' permite reducir escala/muestras ante VRAM; 'final' prohíbe degradar calidad. */
  purpose?: ExecutionPurpose;
  maxTransientRetries?: number;
  maxVramDegradations?: number;
  /** Límite de referencia VRAM en MB (defecto 4096 para RTX 3050). */
  vramLimitMB?: number;
  allowSubdivision?: boolean;
  probeFallbackBeforeRun?: boolean;
  baseBackoffMs?: number;
  sleep?: (ms: number) => Promise<void>;
  minPreviewScale?: number;
  minSamples?: number;
  maxSegments?: number;
  onCacheStore?: (entry: CacheStoreRecord) => void | Promise<void>;
};

export type RecoveryOkResult = {
  outcome: 'ok';
  finalResult: AdapterJobResult;
  connectorId: string;
  degraded: boolean;
  attempts: ExecutionAttempt[];
  appliedMitigations: AttemptMitigation[];
  constraintsReported: string[];
};

export type RecoveryEscalatedResult = {
  outcome: 'escalated';
  finalResult: AdapterJobResult | null;
  connectorId: string | null;
  degraded: boolean;
  attempts: ExecutionAttempt[];
  appliedMitigations: AttemptMitigation[];
  constraintsReported: string[];
  suggestedActions: string[];
  reason: string;
};

export type RecoveryExecutionResult =
  | RecoveryOkResult
  | RecoveryEscalatedResult;
