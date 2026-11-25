/**
 * Esquemas Zod 4 y tipos de @fme/art-direction (FDN-060).
 *
 * Modela perfiles de estilo, reglas de dirección de animación (§8 de vision.md),
 * gradientes continuos (`expression` e `integration`, §7) y el plan estético resultante.
 */
import { z } from 'zod';
import type { Curve, Layer, Technique } from '@fme/project';

export const ART_DIRECTION_SCHEMA_VERSION = 1 as const;

export const STYLE_FAMILIES = [
  'ink',
  'sketch',
  'cartoon',
  'editorial',
  'minimal-geometric',
  'painterly',
  'custom',
] as const;

export const ANIMATION_PRINCIPLES = [
  'squash-stretch',
  'anticipation',
  'staging',
  'arcs',
  'slow-in-out',
  'follow-through',
  'overlap',
  'exaggeration',
  'acting',
  'secondary-motion',
  'visual-hierarchy',
  'rhythm',
  'color',
  'negative-space',
] as const;

export const GRADIENT_CHANNELS = ['expression', 'integration'] as const;

const TECHNIQUES: readonly [Technique, ...Technique[]] = [
  '2d',
  '3d',
  '2.5d',
  '2d-guided-by-3d',
  '3d-with-2d',
];

const LAYER_KINDS: readonly [Layer['kind'], ...Layer['kind'][]] = [
  'video',
  'audio',
  'image',
  'svg',
  'drawing',
  'model3d',
  'text',
  'group',
];

const EASINGS = ['linear', 'smooth', 'hold'] as const;

const unitFloat = z.number().finite().min(0).max(1);
const nonEmptyId = z.string().min(1);

export const styleFamilySchema = z.enum(STYLE_FAMILIES);
export type StyleFamily = z.infer<typeof styleFamilySchema>;

export const animationPrincipleSchema = z.enum(ANIMATION_PRINCIPLES);
export type AnimationPrinciple = z.infer<typeof animationPrincipleSchema>;

export const gradientChannelSchema = z.enum(GRADIENT_CHANNELS);
export type GradientChannel = z.infer<typeof gradientChannelSchema>;

export const easingSchema = z.enum(EASINGS);
export type ArtDirectionEasing = z.infer<typeof easingSchema>;

export const ruleTargetSchema = z.strictObject({
  sequenceIds: z.array(nonEmptyId).optional(),
  sceneIds: z.array(nonEmptyId).optional(),
  layerIds: z.array(nonEmptyId).optional(),
  layerKinds: z.array(z.enum(LAYER_KINDS)).optional(),
  techniques: z.array(z.enum(TECHNIQUES)).optional(),
});
export type RuleTarget = z.infer<typeof ruleTargetSchema>;

export const animationRuleSchema = z.strictObject({
  id: nonEmptyId,
  principle: animationPrincipleSchema,
  channel: gradientChannelSchema,
  intensity: unitFloat,
  easing: easingSchema.optional(),
  target: ruleTargetSchema.optional(),
  enabled: z.boolean().optional(),
});
export type AnimationRule = z.infer<typeof animationRuleSchema>;

export const coherenceConfigSchema = z.strictObject({
  seedOffset: z.number().int(),
  temporalCorrelation: unitFloat,
  maxVariation: unitFloat,
});
export type CoherenceConfig = z.infer<typeof coherenceConfigSchema>;

export const styleProfileSchema = z.strictObject({
  schemaVersion: z.literal(ART_DIRECTION_SCHEMA_VERSION),
  id: nonEmptyId,
  name: z.string().min(1),
  family: styleFamilySchema,
  expressionAnchor: unitFloat,
  integrationAnchor: unitFloat,
  preferredTechniques: z.array(z.enum(TECHNIQUES)),
  coherence: coherenceConfigSchema,
  rules: z.array(animationRuleSchema),
  notes: z.string().optional(),
});
export type StyleProfile = z.infer<typeof styleProfileSchema>;

export const normalizedKeyframeSchema = z.strictObject({
  frame: z.number().int().nonnegative(),
  value: unitFloat,
  easing: easingSchema.optional(),
});

export const normalizedCurveSchema = z.strictObject({
  defaultValue: unitFloat,
  keyframes: z.array(normalizedKeyframeSchema),
});

export const appliedRuleSummarySchema = z.strictObject({
  ruleId: nonEmptyId,
  principle: animationPrincipleSchema,
  channel: gradientChannelSchema,
  intensity: unitFloat,
  easing: easingSchema,
  rationale: z.string().min(1),
});
export type AppliedRuleSummary = z.infer<typeof appliedRuleSummarySchema>;

export const layerArtPlanSchema = z.strictObject({
  layerId: nonEmptyId,
  layerKind: z.enum(LAYER_KINDS),
  techniques: z.array(z.enum(TECHNIQUES)),
  expression: normalizedCurveSchema,
  integration: normalizedCurveSchema,
  appliedRules: z.array(appliedRuleSummarySchema),
  rationale: z.array(z.string().min(1)),
});
export type LayerArtPlan = Omit<
  z.infer<typeof layerArtPlanSchema>,
  'expression' | 'integration'
> & {
  expression: Curve;
  integration: Curve;
};

export const sceneArtPlanSchema = z.strictObject({
  sceneId: nonEmptyId,
  durationFrames: z.number().int().nonnegative(),
  layers: z.array(layerArtPlanSchema),
});
export type SceneArtPlan = Omit<z.infer<typeof sceneArtPlanSchema>, 'layers'> & {
  layers: LayerArtPlan[];
};

export const sequenceArtPlanSchema = z.strictObject({
  sequenceId: nonEmptyId,
  scenes: z.array(sceneArtPlanSchema),
});
export type SequenceArtPlan = Omit<
  z.infer<typeof sequenceArtPlanSchema>,
  'scenes'
> & {
  scenes: SceneArtPlan[];
};

export const artDirectionPlanSchema = z.strictObject({
  schemaVersion: z.literal(ART_DIRECTION_SCHEMA_VERSION),
  projectId: nonEmptyId,
  profileId: nonEmptyId,
  profileName: z.string().min(1),
  family: styleFamilySchema,
  seed: z.number().int(),
  sequences: z.array(sequenceArtPlanSchema),
});
export type ArtDirectionPlan = Omit<
  z.infer<typeof artDirectionPlanSchema>,
  'sequences'
> & {
  sequences: SequenceArtPlan[];
};

export type ArtDirectionValidationIssue = {
  path: string;
  message: string;
  code: string;
};

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ArtDirectionValidationIssue[] };

function formatPath(path: ReadonlyArray<PropertyKey>): string {
  let out = '';
  for (const seg of path) {
    out +=
      typeof seg === 'number'
        ? `[${seg}]`
        : out === ''
          ? String(seg)
          : `.${String(seg)}`;
  }
  return out === '' ? '$' : out;
}

function checkSchemaVersion(input: unknown): ArtDirectionValidationIssue | null {
  if (
    typeof input === 'object' &&
    input !== null &&
    !Array.isArray(input) &&
    'schemaVersion' in input
  ) {
    const found = (input as { schemaVersion: unknown }).schemaVersion;
    if (found !== ART_DIRECTION_SCHEMA_VERSION) {
      return {
        path: 'schemaVersion',
        code: 'unknown-schema-version',
        message: `schemaVersion ${JSON.stringify(found)} no soportado; esta versión entiende ${ART_DIRECTION_SCHEMA_VERSION}`,
      };
    }
  }
  return null;
}

function parseWithSchema<T>(
  schema: z.ZodType<unknown>,
  input: unknown,
): ParseResult<T> {
  const versionIssue = checkSchemaVersion(input);
  if (versionIssue !== null) {
    return { ok: false, issues: [versionIssue] };
  }
  const result = schema.safeParse(input);
  if (result.success) {
    return { ok: true, value: result.data as T };
  }
  return {
    ok: false,
    issues: result.error.issues.map((issue) => ({
      path: formatPath(issue.path),
      code: issue.code,
      message: issue.message,
    })),
  };
}

/** Valida en runtime un `StyleProfile` de dirección artística. */
export function parseStyleProfile(input: unknown): ParseResult<StyleProfile> {
  return parseWithSchema<StyleProfile>(styleProfileSchema, input);
}

/** Valida en runtime un `ArtDirectionPlan`. */
export function parseArtDirectionPlan(
  input: unknown,
): ParseResult<ArtDirectionPlan> {
  return parseWithSchema<ArtDirectionPlan>(artDirectionPlanSchema, input);
}

/** JSON Schema publicable de `StyleProfile`, generado desde Zod 4. */
export const styleProfileJsonSchema: Record<string, unknown> = z.toJSONSchema(
  styleProfileSchema,
) as Record<string, unknown>;
