/**
 * @fme/recovery: recuperación determinista ante VRAM, reintento seguro y fallback (FDN-072).
 */

export type {
  ExecutionFailureCategory,
  ExecutionPurpose,
  ErrorClassification,
  AttemptMitigation,
  ExecutionAttempt,
  RecoveryAction,
  RecoveryDecision,
  AttemptContextInput,
  AttemptContextFactory,
  AdapterMap,
  CacheStoreRecord,
  RecoveryOptions,
  RecoveryOkResult,
  RecoveryEscalatedResult,
  RecoveryExecutionResult,
} from './types.ts';

export { classifyExecutionError } from './classify.ts';

export {
  parseFrameRangeSpec,
  splitFrameRange,
  decideRecoveryAction,
} from './policy.ts';
export type {
  PolicyRuntimeState,
  FrameRangeSpec,
  FrameSegment,
} from './policy.ts';

export { executeWithRecovery } from './executor.ts';
