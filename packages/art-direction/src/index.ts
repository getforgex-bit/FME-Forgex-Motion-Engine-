/**
 * @fme/art-direction: Mitad A, dirección artística determinista (FDN-060).
 *
 * Modela perfiles de estilo, reglas de animación (§8), gradientes `expression`
 * e `integration` (§7) y su aplicación no destructiva sobre `@fme/project`.
 */

export {
  ART_DIRECTION_SCHEMA_VERSION,
  STYLE_FAMILIES,
  ANIMATION_PRINCIPLES,
  GRADIENT_CHANNELS,
  styleFamilySchema,
  animationPrincipleSchema,
  gradientChannelSchema,
  easingSchema,
  ruleTargetSchema,
  animationRuleSchema,
  coherenceConfigSchema,
  styleProfileSchema,
  normalizedKeyframeSchema,
  normalizedCurveSchema,
  appliedRuleSummarySchema,
  layerArtPlanSchema,
  sceneArtPlanSchema,
  sequenceArtPlanSchema,
  artDirectionPlanSchema,
  parseStyleProfile,
  parseArtDirectionPlan,
  styleProfileJsonSchema,
} from './schema.ts';
export type {
  StyleFamily,
  AnimationPrinciple,
  GradientChannel,
  ArtDirectionEasing,
  RuleTarget,
  AnimationRule,
  CoherenceConfig,
  StyleProfile,
  AppliedRuleSummary,
  LayerArtPlan,
  SceneArtPlan,
  SequenceArtPlan,
  ArtDirectionPlan,
  ArtDirectionValidationIssue,
  ParseResult,
} from './schema.ts';

export {
  fnv1a32,
  mulberry32,
  createChannelRng,
  ruleMatchesLayer,
  evaluateLayerChannel,
  STYLE_PRESETS,
} from './rules.ts';
export type {
  LayerEvaluationContext,
  EvaluatedChannelResult,
} from './rules.ts';

export {
  ArtDirectionValidationError,
  buildArtDirectionPlan,
  applyArtDirection,
} from './apply.ts';
export type { ApplyArtDirectionOptions } from './apply.ts';
