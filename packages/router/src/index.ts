/**
 * @fme/router: enrutador inteligente de 8 pasos sobre @fme/connectors (FDN-050).
 */

export { ROUTE_STEP_NAMES } from './types.ts';
export type {
  RouterRegistry,
  RouteMode,
  RouteStepName,
  LimitRequirement,
  RoutePolicy,
  RouteTask,
  RouteOptions,
  RouteRejectionCode,
  RejectionRecord,
  CandidateScoreBreakdown,
  RankedCandidate,
  RouteStepTrace,
  RouteMetrics,
  FallbackStrategy,
  RouteError,
  RoutePlan,
  WorkflowTaskPlan,
  WorkflowRoutePlan,
} from './types.ts';

export { planRoute, planWorkflow } from './router.ts';
