/**
 * Mapeo puro de una capa FME a la descripción de job del motor Revideo (sin motor, testeable).
 *
 * Reglas (documentadas porque el contrato v0.1 no las fija; POR VALIDAR por A0):
 * - `Keyframe.frame` es relativo al inicio de la capa.
 * - El `easing` de un fotograma clave gobierna el tramo que LLEGA a él desde el anterior
 *   (coherente con la fixture híbrida: `smooth` en 0→20 de opacidad, `hold` en 285 del volumen).
 * - Antes del primer fotograma clave se usa su valor; tras el último, el último valor; sin claves, `defaultValue`.
 * - Canales: x, y en píxeles desde el centro del lienzo; rotation en grados; scale y opacity adimensionales.
 */
import { depthScale, fnv1a32, mulberry32, parallaxFactor, revideoGradientOps } from '@fme/art-direction';
import type { Channel, Curve, Layer, Project } from '@fme/project';
import { guideOffsets } from './guide.ts';
import type { GuideData } from './guide.ts';

export type Tracks = { x: number[]; y: number[]; opacity: number[]; scale: number[]; rotation: number[] };

/** Operaciones por fotograma derivadas de los gradientes `expression` e `integration` (FDN-061). */
export type GradientTracks = {
  strokeWidth: number[];
  strokeOpacity: number[];
  jitterX: number[];
  jitterY: number[];
  shadowBlur: number[];
  shadowOffset: number[];
  shadowOpacity: number[];
};

export type EngineJob = {
  width: number;
  height: number;
  fps: number;
  frames: number;
  kind: 'text' | 'svg';
  text?: string;
  svg?: string;
  fontSize?: number;
  fontFamily?: string;
  fill?: string;
  tracks: Tracks;
  /** Solo si la capa tiene curva `expression` y/o `integration`; si no, el render es el de FDN-032 sin cambios. */
  gradients?: GradientTracks;
};

export class MappingError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'MappingError';
    this.code = code;
  }
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Valor de una curva en el fotograma `frame` (relativo a la capa). */
export function sampleCurve(curve: Curve | undefined, frame: number, fallback: number): number {
  if (!curve) return fallback;
  const keys = [...curve.keyframes].sort((a, b) => a.frame - b.frame);
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (!first || !last) return curve.defaultValue;
  if (frame <= first.frame) return first.value;
  if (frame >= last.frame) return last.value;
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i]!;
    if (frame > b.frame) continue;
    const a = keys[i - 1]!;
    const easing = b.easing ?? 'linear';
    if (easing === 'hold') return frame === b.frame ? b.value : a.value;
    const t = (frame - a.frame) / (b.frame - a.frame);
    return a.value + (b.value - a.value) * (easing === 'smooth' ? smooth(t) : t);
  }
  return last.value;
}

const DEFAULTS: Record<'x' | 'y' | 'opacity' | 'scale' | 'rotation', number> = { x: 0, y: 0, opacity: 1, scale: 1, rotation: 0 };

export function sampleTracks(layer: Layer): Tracks {
  const channels = layer.channels as Partial<Record<Channel, Curve>>;
  const track = (name: keyof typeof DEFAULTS): number[] =>
    Array.from({ length: layer.durationFrames }, (_, f) => sampleCurve(channels[name], f, DEFAULTS[name]));
  return { x: track('x'), y: track('y'), opacity: track('opacity'), scale: track('scale'), rotation: track('rotation') };
}

/**
 * Muestrea `expression` e `integration` (0–1; si falta una curva, 0 = sin efecto) y las traduce con
 * `revideoGradientOps` (tabla en el README de @fme/art-direction). El temblor usa una semilla determinista
 * por proyecto, capa y fotograma: mismo proyecto, mismos píxeles.
 */
export function sampleGradientTracks(layer: Layer, projectSeed: number): GradientTracks {
  const channels = layer.channels as Partial<Record<Channel, Curve>>;
  const t: GradientTracks = { strokeWidth: [], strokeOpacity: [], jitterX: [], jitterY: [], shadowBlur: [], shadowOffset: [], shadowOpacity: [] };
  for (let f = 0; f < layer.durationFrames; f++) {
    const ops = revideoGradientOps(sampleCurve(channels.expression, f, 0), sampleCurve(channels.integration, f, 0));
    const rng = mulberry32(fnv1a32(`${projectSeed}:${layer.id}:${f}`));
    t.strokeWidth.push(ops.strokeWidth);
    t.strokeOpacity.push(ops.strokeOpacity);
    t.jitterX.push((rng() * 2 - 1) * ops.jitterAmplitude);
    t.jitterY.push((rng() * 2 - 1) * ops.jitterAmplitude);
    t.shadowBlur.push(ops.shadowBlur);
    t.shadowOffset.push(ops.shadowOffset);
    t.shadowOpacity.push(ops.shadowOpacity);
  }
  return t;
}

export function findLayer(project: Project, layerId: string): Layer {
  for (const seq of project.sequences) for (const scene of seq.scenes) for (const layer of scene.layers) if (layer.id === layerId) return layer;
  throw new MappingError('layer-not-found', `No existe la capa «${layerId}» en el proyecto`);
}

/** `text`, `fontSize` y `fill` son sobrescrituras explícitas (requirements); si faltan se usa `layer.text` (ADR-0012). */
export type MapOptions = {
  text?: string; svgMarkup?: string; fontSize?: number; fill?: string;
  /** Técnica `2.5d`: profundidad del plano (≥ 0). Exige `layer.techniques` con `2.5d`. */
  depth?: number;
  /** Técnica `2d-guided-by-3d`: guía validada y su capa 3D (`layer.guide3DLayerId`). */
  guide?: GuideData;
  guideLayer?: Layer;
};

/** Construye el job del motor. `svgMarkup` lo lee el adaptador del asset (aquí no se toca el disco). */
export function buildEngineJob(project: Project, layer: Layer, options: MapOptions = {}): EngineJob {
  if (layer.kind !== 'text' && layer.kind !== 'svg' && !(layer.kind === 'drawing' && options.svgMarkup !== undefined)) {
    throw new MappingError('unsupported-layer', `Solo se renderizan capas text o svg; «${layer.id}» es ${layer.kind}`);
  }
  if (project.fps.num !== 30 || project.fps.den !== 1) {
    throw new MappingError('unsupported-fps', `El motor Revideo está fijado a 30 FPS; el proyecto usa ${project.fps.num}/${project.fps.den}`);
  }
  if (layer.durationFrames < 1) throw new MappingError('bad-layer', 'La capa no tiene fotogramas');
  const isText = layer.kind === 'text';
  if (!isText && options.svgMarkup === undefined) throw new MappingError('missing-asset', 'Falta el contenido SVG de la capa');
  const job: EngineJob = {
    width: project.width, height: project.height, fps: 30, frames: layer.durationFrames,
    kind: isText ? 'text' : 'svg',
    tracks: sampleTracks(layer),
  };
  // Técnicas compuestas (FDN-063). Primero el parallax (atenúa el movimiento propio de la capa) y luego la guía (suma).
  if (options.depth !== undefined) {
    if (!layer.techniques.includes('2.5d')) throw new MappingError('technique-missing', `«${layer.id}» no declara la técnica 2.5d; no se aplica depth.`);
    const k = parallaxFactor(options.depth);
    const s2 = depthScale(options.depth);
    job.tracks.x = job.tracks.x.map((v) => v * k);
    job.tracks.y = job.tracks.y.map((v) => v * k);
    job.tracks.scale = job.tracks.scale.map((v) => v * s2);
  }
  if (options.guide !== undefined) {
    if (!layer.techniques.includes('2d-guided-by-3d') || layer.guide3DLayerId === undefined) {
      throw new MappingError('technique-missing', `«${layer.id}» necesita la técnica 2d-guided-by-3d y guide3DLayerId para usar una guía.`);
    }
    if (!options.guideLayer || options.guideLayer.id !== layer.guide3DLayerId) throw new MappingError('guide-layer-not-found', `No se encontró la capa guía «${layer.guide3DLayerId}».`);
    const g = guideOffsets(options.guide, layer.startFrame, options.guideLayer.startFrame, layer.durationFrames, project.width, project.height);
    job.tracks.x = job.tracks.x.map((v, f) => v + g.x[f]!);
    job.tracks.y = job.tracks.y.map((v, f) => v + g.y[f]!);
    job.tracks.scale = job.tracks.scale.map((v, f) => v * g.scale[f]!);
  }
  if (layer.channels.expression || layer.channels.integration) job.gradients = sampleGradientTracks(layer, project.seed);
  if (isText) {
    // Precedencia: sobrescritura explícita > layer.text (ADR-0012) > nombre del proyecto (solo capas v1 sin texto).
    job.text = options.text ?? layer.text?.content ?? project.name;
    const fontSize = options.fontSize ?? layer.text?.fontSize;
    const fill = options.fill ?? layer.text?.color;
    if (fontSize !== undefined) job.fontSize = fontSize;
    if (fill !== undefined) job.fill = fill;
    if (layer.text?.fontFamily !== undefined) job.fontFamily = layer.text.fontFamily;
  } else {
    job.svg = options.svgMarkup!;
  }
  return job;
}
