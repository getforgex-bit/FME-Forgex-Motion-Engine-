/**
 * Evaluación determinista de reglas de dirección artística y perfiles predefinidos (FDN-060).
 *
 * No utiliza IA ni aleatoriedad no controlada: usa FNV-1a 32-bit + Mulberry32
 * para producir microvariaciones coherentes y reproducibles.
 */
import type { Curve, Keyframe, Layer } from '@fme/project';
import {
  ART_DIRECTION_SCHEMA_VERSION,
  type AnimationPrinciple,
  type AnimationRule,
  type AppliedRuleSummary,
  type ArtDirectionEasing,
  type CoherenceConfig,
  type GradientChannel,
  type StyleProfile,
} from './schema.ts';

const SAMPLE_POSITIONS = [0, 0.15, 0.35, 0.55, 0.8, 1] as const;

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/** Hash FNV-1a de 32 bits puro y determinista sobre cadenas UTF-16. */
export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** PRNG Mulberry32 determinista para una semilla entera de 32 bits. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type LayerEvaluationContext = {
  projectSeed: number;
  sequenceId: string;
  sceneId: string;
  layer: Layer;
};

/** Crea un PRNG determinista único para `(seed, seedOffset, sequence, scene, layer, channel)`. */
export function createChannelRng(
  context: LayerEvaluationContext,
  seedOffset: number,
  channel: GradientChannel,
): () => number {
  const seedKey = [
    String(context.projectSeed),
    String(seedOffset),
    context.sequenceId,
    context.sceneId,
    context.layer.id,
    channel,
  ].join('|');
  return mulberry32(fnv1a32(seedKey));
}

/** Comprueba si una regla está habilitada y aplica a la capa indicada. */
export function ruleMatchesLayer(
  rule: AnimationRule,
  context: LayerEvaluationContext,
): boolean {
  if (rule.enabled === false) {
    return false;
  }
  const target = rule.target;
  if (target === undefined) {
    return true;
  }
  if (
    target.sequenceIds !== undefined &&
    !target.sequenceIds.includes(context.sequenceId)
  ) {
    return false;
  }
  if (
    target.sceneIds !== undefined &&
    !target.sceneIds.includes(context.sceneId)
  ) {
    return false;
  }
  if (
    target.layerIds !== undefined &&
    !target.layerIds.includes(context.layer.id)
  ) {
    return false;
  }
  if (
    target.layerKinds !== undefined &&
    !target.layerKinds.includes(context.layer.kind)
  ) {
    return false;
  }
  if (
    target.techniques !== undefined &&
    !target.techniques.some((tech) => context.layer.techniques.includes(tech))
  ) {
    return false;
  }
  return true;
}

/** Envolvente determinista normalizada `[-0.25, +0.25]` según el principio de animación (§8). */
function principleEnvelope(principle: AnimationPrinciple, t: number): number {
  switch (principle) {
    case 'anticipation':
      // Ligera retracción inicial seguida de impulso
      return t < 0.25
        ? -0.18 * Math.sin((t / 0.25) * Math.PI)
        : 0.2 * Math.sin(((t - 0.25) / 0.75) * Math.PI);
    case 'squash-stretch':
      return 0.18 * Math.sin(t * Math.PI * 2);
    case 'staging':
      return 0.16 * (1 - Math.abs(2 * t - 1));
    case 'arcs':
      return 0.2 * Math.sin(t * Math.PI);
    case 'slow-in-out': {
      const s = t * t * (3 - 2 * t);
      return (s - 0.5) * 0.24;
    }
    case 'follow-through':
      return t < 0.5 ? 0.08 * t : 0.22 * Math.sin(((t - 0.3) / 0.7) * Math.PI);
    case 'overlap':
      return 0.14 * Math.sin(t * Math.PI * 1.5);
    case 'exaggeration':
      return 0.25 * Math.sin(t * Math.PI);
    case 'acting':
      return 0.18 * (0.4 + 0.6 * Math.sin(t * Math.PI)) * (t > 0.1 ? 1 : 0.3);
    case 'secondary-motion':
      return 0.12 * Math.sin(t * Math.PI * 2.5);
    case 'visual-hierarchy':
      return (0.5 - t) * 0.16;
    case 'rhythm':
      return 0.15 * Math.sin(t * Math.PI * 3);
    case 'color':
      return 0.14 * t;
    case 'negative-space':
      return -0.12 * (1 - t);
  }
}

function buildSampleFrames(durationFrames: number): number[] {
  const safeDuration = Math.max(0, Math.trunc(durationFrames));
  const frames: number[] = [];
  let previous = -1;

  for (const pos of SAMPLE_POSITIONS) {
    const candidate = Math.min(
      safeDuration,
      Math.max(0, Math.round(pos * safeDuration)),
    );
    if (candidate > previous) {
      frames.push(candidate);
      previous = candidate;
    }
  }

  return frames;
}

function computeCoherentOffsets(
  count: number,
  coherence: CoherenceConfig,
  rng: () => number,
): number[] {
  if (count === 0) {
    return [];
  }
  if (coherence.maxVariation === 0) {
    return new Array<number>(count).fill(0);
  }

  const offsets: number[] = [];
  let previous = 0;

  for (let i = 0; i < count; i += 1) {
    const raw = (rng() * 2 - 1) * coherence.maxVariation;
    const blended =
      i === 0
        ? raw
        : previous * coherence.temporalCorrelation +
          raw * (1 - coherence.temporalCorrelation);
    const bounded = Math.max(
      -coherence.maxVariation,
      Math.min(coherence.maxVariation, blended),
    );
    offsets.push(bounded);
    previous = bounded;
  }

  return offsets;
}

function resolveChannelEasing(rules: readonly AnimationRule[]): ArtDirectionEasing {
  if (rules.length === 0) {
    return 'linear';
  }
  let dominant = rules[0];
  for (const rule of rules) {
    if (dominant === undefined || rule.intensity > dominant.intensity) {
      dominant = rule;
    }
  }
  return dominant?.easing ?? 'smooth';
}

export type EvaluatedChannelResult = {
  curve: Curve;
  appliedRules: AppliedRuleSummary[];
};

/**
 * Evalúa de forma determinista un canal de gradiente (`expression` o `integration`)
 * sobre una capa concreta, generando keyframes enteros crecientes y valores en `[0, 1]`.
 */
export function evaluateLayerChannel(
  context: LayerEvaluationContext,
  profile: StyleProfile,
  channel: GradientChannel,
): EvaluatedChannelResult {
  const anchor =
    channel === 'expression'
      ? profile.expressionAnchor
      : profile.integrationAnchor;

  const matchedRules = profile.rules.filter(
    (rule) => rule.channel === channel && ruleMatchesLayer(rule, context),
  );

  const safeDuration = Math.max(0, Math.trunc(context.layer.durationFrames));
  const frames = buildSampleFrames(safeDuration);
  const rng = createChannelRng(context, profile.coherence.seedOffset, channel);
  const microOffsets = computeCoherentOffsets(
    frames.length,
    profile.coherence,
    rng,
  );
  const easing = resolveChannelEasing(matchedRules);

  const keyframes: Keyframe[] = frames.map((frame, index) => {
    const t = safeDuration === 0 ? 0 : frame / safeDuration;
    let ruleDelta = 0;
    for (const rule of matchedRules) {
      ruleDelta += rule.intensity * principleEnvelope(rule.principle, t);
    }
    const micro = microOffsets[index] ?? 0;
    const value = round6(clamp01(anchor + ruleDelta + micro));
    return {
      frame,
      value,
      easing,
    };
  });

  const defaultValue = keyframes[0]?.value ?? round6(clamp01(anchor));

  const appliedRules: AppliedRuleSummary[] = matchedRules.map((rule) => ({
    ruleId: rule.id,
    principle: rule.principle,
    channel: rule.channel,
    intensity: rule.intensity,
    easing: rule.easing ?? easing,
    rationale: `Regla "${rule.id}" (${rule.principle}) aplicada en canal ${rule.channel} con intensidad ${rule.intensity} sobre capa "${context.layer.id}".`,
  }));

  return {
    curve: {
      defaultValue,
      keyframes,
    },
    appliedRules,
  };
}

/** Tres perfiles predefinidos listos para usar en FME (§7 y §8 de vision.md). */
export const STYLE_PRESETS: Readonly<{
  minimalGeometric: StyleProfile;
  editorialHandmade: StyleProfile;
  cinematicHybrid: StyleProfile;
}> = {
  minimalGeometric: {
    schemaVersion: ART_DIRECTION_SCHEMA_VERSION,
    id: 'preset.minimal-geometric',
    name: 'Minimalismo geométrico',
    family: 'minimal-geometric',
    expressionAnchor: 0.2,
    integrationAnchor: 0.35,
    preferredTechniques: ['2d'],
    coherence: {
      seedOffset: 101,
      temporalCorrelation: 0.85,
      maxVariation: 0.03,
    },
    rules: [
      {
        id: 'mg-hierarchy',
        principle: 'visual-hierarchy',
        channel: 'expression',
        intensity: 0.25,
        easing: 'smooth',
      },
      {
        id: 'mg-slow-in-out',
        principle: 'slow-in-out',
        channel: 'integration',
        intensity: 0.3,
        easing: 'smooth',
      },
      {
        id: 'mg-negative-space',
        principle: 'negative-space',
        channel: 'expression',
        intensity: 0.2,
        easing: 'linear',
      },
    ],
    notes: 'Ancla baja de expresión: formas limpias, tipografía y motion design funcional.',
  },
  editorialHandmade: {
    schemaVersion: ART_DIRECTION_SCHEMA_VERSION,
    id: 'preset.editorial-handmade',
    name: 'Editorial artesanal',
    family: 'editorial',
    expressionAnchor: 0.55,
    integrationAnchor: 0.6,
    preferredTechniques: ['2d', '2d-guided-by-3d'],
    coherence: {
      seedOffset: 202,
      temporalCorrelation: 0.72,
      maxVariation: 0.08,
    },
    rules: [
      {
        id: 'ed-anticipation',
        principle: 'anticipation',
        channel: 'expression',
        intensity: 0.45,
        easing: 'smooth',
      },
      {
        id: 'ed-arcs',
        principle: 'arcs',
        channel: 'expression',
        intensity: 0.35,
        easing: 'smooth',
      },
      {
        id: 'ed-follow-through',
        principle: 'follow-through',
        channel: 'integration',
        intensity: 0.4,
        easing: 'smooth',
      },
      {
        id: 'ed-rhythm',
        principle: 'rhythm',
        channel: 'integration',
        intensity: 0.25,
        easing: 'smooth',
      },
    ],
    notes: 'Ilustración expresiva con anticipación, arcos y coherencia temporal moderada.',
  },
  cinematicHybrid: {
    schemaVersion: ART_DIRECTION_SCHEMA_VERSION,
    id: 'preset.cinematic-hybrid',
    name: 'Cinematográfico híbrido 2D/3D',
    family: 'painterly',
    expressionAnchor: 0.8,
    integrationAnchor: 0.85,
    preferredTechniques: ['3d-with-2d', '2d-guided-by-3d', '2.5d'],
    coherence: {
      seedOffset: 303,
      temporalCorrelation: 0.8,
      maxVariation: 0.06,
    },
    rules: [
      {
        id: 'ch-staging',
        principle: 'staging',
        channel: 'expression',
        intensity: 0.4,
        easing: 'smooth',
      },
      {
        id: 'ch-acting',
        principle: 'acting',
        channel: 'expression',
        intensity: 0.35,
        easing: 'smooth',
      },
      {
        id: 'ch-overlap',
        principle: 'overlap',
        channel: 'integration',
        intensity: 0.35,
        easing: 'smooth',
      },
      {
        id: 'ch-color',
        principle: 'color',
        channel: 'integration',
        intensity: 0.25,
        easing: 'smooth',
      },
    ],
    notes: 'Integración profunda entre escena 3D y trazo 2D con puesta en escena narrativa.',
  },
};
