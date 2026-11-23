/**
 * @fme/project: Mitad B, el proyecto universal.
 *
 * Estado: PROPUESTO. Transcripción del Anexo A de la especificación v0.1 (§22),
 * más `ExternalProjectRef` y `RenderArtifact` de la tabla de entidades (§7.1).
 * No es una API publicada: falta la validación en runtime, las migraciones y la serialización (Fase 2).
 *
 * Reglas (§7):
 * - El tiempo se expresa en fotogramas enteros con un FPS racional explícito (evita la deriva).
 * - Los assets se guardan en un catálogo separado y las capas los referencian por id.
 * - El esquema NO depende de campos internos de FreeCut, Revideo ni Blender.
 */

/** Cinco técnicas de animación combinables (§03). */
export type Technique = '2d' | '3d' | '2.5d' | '2d-guided-by-3d' | '3d-with-2d';

export type Keyframe = {
  /** Fotograma entero, relativo al inicio de la capa o escena. */
  frame: number;
  value: number;
  easing?: 'linear' | 'smooth' | 'hold';
};

export type Curve = { defaultValue: number; keyframes: Keyframe[] };

export type AssetType = 'video' | 'audio' | 'image' | 'svg' | 'drawing' | 'model3d';

export type Asset = {
  id: string;
  type: AssetType;
  uri: string;
  hash?: string;
  licenseId?: string;
};

/** Canales animables mínimos. `expression` e `integration` son los dos gradientes (§04), normalizados 0–1. */
export type Channel =
  | 'x'
  | 'y'
  | 'rotation'
  | 'scale'
  | 'opacity'
  | 'expression'
  | 'integration'
  | 'volume';

/** Referencia editable a un documento nativo de otra herramienta (§7.1). */
export type ExternalProjectRef = {
  pluginId: string;
  uri: string;
  /** Versión del motor que produjo o puede reabrir el documento (POR VALIDAR por adaptador). */
  engineVersion?: string;
  /** Id del RenderArtifact derivado de este documento, si existe. */
  renderArtifactId?: string;
};

export type Layer = {
  id: string;
  kind: AssetType | 'text' | 'group';
  assetId?: string;
  startFrame: number;
  durationFrames: number;
  sourceInFrame?: number;
  zIndex: number;
  techniques: Technique[];
  guide3DLayerId?: string;
  channels: Partial<Record<Channel, Curve>>;
  externalProject?: ExternalProjectRef;
};

export type Scene = { id: string; durationFrames: number; layers: Layer[] };

export type Sequence = { id: string; scenes: Scene[] };

/** Archivo generado con su procedencia (§7.1, §2.4 trazabilidad). */
export type RenderArtifact = {
  id: string;
  uri: string;
  /** MIME o tipo FME, p. ej. 'video/mp4' o 'image/png-sequence'. */
  type: string;
  /** Hash de las dependencias (proyecto, segmento, assets y versiones de adaptadores) usado como clave de caché (§13.4). */
  dependencyHash: string;
  producedBy: { pluginId: string; pluginVersion: string };
  seed?: number;
  config?: Record<string, string | number | boolean>;
};

/** FPS racional, p. ej. { num: 30000, den: 1001 } = 29,97 FPS. */
export type Fps = { num: number; den: number };

export const SCHEMA_VERSION = 1 as const;

export type Project = {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  name: string;
  fps: Fps;
  width: number;
  height: number;
  seed: number;
  assets: Asset[];
  sequences: Sequence[];
};

// API pública (re-exportaciones añadidas por A0 al integrar FDN-021 y FDN-022).
export { projectSchema, projectJsonSchema, parseProject, formatPath } from './schema.ts';
export type { ParseProjectResult, ValidationIssue, ProjectFromSchema } from './schema.ts';
export { serialize, deserialize } from './serialize.ts';
export type { DeserializeResult } from './serialize.ts';
export { framesToSeconds, secondsToFrames, rescaleFrames, framesToTimecode, timecodeToFrames } from './time.ts';
export type { FrameRounding } from './time.ts';
export { migrateToCurrent } from './migrate.ts';
