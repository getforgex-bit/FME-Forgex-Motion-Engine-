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
import type { Channel, Curve, Layer, Project } from '@fme/project';

export type Tracks = { x: number[]; y: number[]; opacity: number[]; scale: number[]; rotation: number[] };

export type EngineJob = {
  width: number;
  height: number;
  fps: number;
  frames: number;
  kind: 'text' | 'svg';
  text?: string;
  svg?: string;
  fontSize?: number;
  fill?: string;
  tracks: Tracks;
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

export function findLayer(project: Project, layerId: string): Layer {
  for (const seq of project.sequences) for (const scene of seq.scenes) for (const layer of scene.layers) if (layer.id === layerId) return layer;
  throw new MappingError('layer-not-found', `No existe la capa «${layerId}» en el proyecto`);
}

export type MapOptions = { text?: string; svgMarkup?: string; fontSize?: number; fill?: string };

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
  if (isText) job.text = options.text ?? project.name;
  else job.svg = options.svgMarkup!;
  if (options.fontSize !== undefined) job.fontSize = options.fontSize;
  if (options.fill !== undefined) job.fill = options.fill;
  return job;
}
