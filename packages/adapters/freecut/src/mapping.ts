/**
 * Mapeo determinista de una escena de `@fme/project` (v1 migrado o v2) a la especificación
 * de job del motor CLI de FreeCut (`runtime/engines/freecut/cli.mjs`), tanto para
 * `edit.export` (FDN-041), composición multipista `edit.compose` (FDN-042a) y
 * pistas de audio / sincronía 48 kHz (FDN-074a).
 */
import { statSync, realpathSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Layer, Project, Scene } from '@fme/project';
import { DEFAULT_AUDIO_SAMPLE_RATE } from './audio-sync.ts';

export type FreeCutMediaLayer = {
  id: string;
  kind: 'video' | 'audio' | 'image';
  mediaPath: string;
  startFrame: number;
  durationFrames: number;
  sourceInFrame: number;
  zIndex: number;
  /** Ganancia lineal FME (`>= 0`, `1.0` = 0 dB); `cli.mjs` la convierte a dB para FreeCut. */
  volume?: number;
  opacity?: number;
  preserveAlpha?: boolean;
  blendMode?: string;
  width?: number;
  height?: number;
  mimeType?: string;
};

export type FreeCutTextLayer = {
  id: string;
  kind: 'text';
  text: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  startFrame: number;
  durationFrames: number;
  zIndex: number;
};

export type FreeCutLayerSpec = FreeCutMediaLayer | FreeCutTextLayer;

export type FreeCutEngineJob = {
  projectId: string;
  projectName: string;
  sceneId: string;
  width: number;
  height: number;
  fps: number;
  audioSampleRate: number;
  durationFrames: number;
  layers: FreeCutLayerSpec[];
};

export class MappingError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'MappingError';
    this.code = code;
  }
}

export function findScene(project: Project, sceneId: string): Scene {
  for (const sequence of project.sequences) {
    for (const scene of sequence.scenes) {
      if (scene.id === sceneId) return scene;
    }
  }
  throw new MappingError('scene-not-found', `No existe la escena «${sceneId}» en el proyecto.`);
}

function resolveContainedAssetPath(projectDir: string, uri: string, layerId: string): string {
  if (!uri || isAbsolute(uri) || /^[a-zA-Z]:/.test(uri) || uri.startsWith('file:')) {
    throw new MappingError(
      'asset-outside-project',
      `El asset de la capa «${layerId}» debe ser una ruta relativa al proyecto: ${uri}`,
    );
  }
  let baseReal: string;
  try {
    baseReal = realpathSync(projectDir);
  } catch {
    throw new MappingError('bad-input', `No se puede resolver la carpeta del proyecto: ${projectDir}`);
  }

  const candidate = resolve(baseReal, uri);
  if (candidate !== baseReal && !candidate.startsWith(baseReal + sep)) {
    throw new MappingError(
      'asset-outside-project',
      `El asset ${uri} queda fuera de la carpeta del proyecto.`,
    );
  }

  let realAsset: string;
  try {
    realAsset = realpathSync(candidate);
  } catch {
    throw new MappingError('missing-asset', `No existe el archivo de asset: ${uri}`);
  }

  if (!realAsset.startsWith(baseReal + sep)) {
    throw new MappingError(
      'asset-outside-project',
      `El asset ${uri} apunta fuera de la carpeta del proyecto.`,
    );
  }

  let isFile = false;
  try {
    isFile = statSync(realAsset).isFile();
  } catch {
    isFile = false;
  }
  if (!isFile) {
    throw new MappingError('missing-asset', `El asset ${uri} no es un archivo regular.`);
  }

  return realAsset;
}

function toFsPath(uri: string): string {
  return uri.startsWith('file:') ? fileURLToPath(uri) : uri;
}

function isInsideRoot(realPath: string, realRoot: string): boolean {
  return realPath === realRoot || realPath.startsWith(realRoot + sep);
}

function hasParentTraversal(rawUri: string): boolean {
  return rawUri.split(/[\\/]+/).some((seg) => seg === '..');
}

function resolveExternalInputPath(
  rawUri: string,
  projectDir: string,
  layerId: string,
  allowedRoots?: readonly string[],
): string {
  if (!rawUri) {
    throw new MappingError('missing-asset', `Ruta vacía para la capa «${layerId}».`);
  }

  const fsPath = toFsPath(rawUri);
  if (!isAbsolute(fsPath) && !/^[a-zA-Z]:/.test(fsPath)) {
    return resolveContainedAssetPath(projectDir, fsPath, layerId);
  }

  if (hasParentTraversal(fsPath)) {
    throw new MappingError(
      'asset-outside-project',
      `La ruta de entrada para «${layerId}» no puede contener traversal "..": ${rawUri}`,
    );
  }

  let realInput: string;
  try {
    realInput = realpathSync(fsPath);
  } catch {
    throw new MappingError('missing-asset', `No existe el artefacto de entrada para «${layerId}»: ${rawUri}`);
  }

  if (allowedRoots !== undefined && allowedRoots.length > 0) {
    const insideAllowed = allowedRoots.some((root) => {
      try {
        return isInsideRoot(realInput, realpathSync(root));
      } catch {
        return false;
      }
    });
    if (!insideAllowed) {
      throw new MappingError(
        'asset-outside-project',
        `El artefacto de entrada para «${layerId}» queda fuera de las raíces permitidas: ${rawUri}`,
      );
    }
  }

  let isFile = false;
  try {
    isFile = statSync(realInput).isFile();
  } catch {
    isFile = false;
  }
  if (!isFile) {
    throw new MappingError('missing-asset', `El artefacto de entrada para «${layerId}» no es un archivo regular: ${rawUri}`);
  }

  return realInput;
}

function validateLayerTiming(layer: Layer): void {
  if (!Number.isInteger(layer.startFrame) || layer.startFrame < 0) {
    throw new MappingError('bad-layer', `La capa «${layer.id}» tiene startFrame inválido: ${layer.startFrame}`);
  }
  if (!Number.isInteger(layer.durationFrames) || layer.durationFrames < 1) {
    throw new MappingError('bad-layer', `La capa «${layer.id}» debe tener durationFrames >= 1.`);
  }
  if (
    layer.sourceInFrame !== undefined &&
    (!Number.isInteger(layer.sourceInFrame) || layer.sourceInFrame < 0)
  ) {
    throw new MappingError(
      'bad-layer',
      `La capa «${layer.id}» tiene sourceInFrame inválido: ${layer.sourceInFrame}`,
    );
  }
}

export function resolveAudioSampleRate(audioSampleRate: number | undefined): number {
  const rate = audioSampleRate ?? DEFAULT_AUDIO_SAMPLE_RATE;
  if (!Number.isInteger(rate) || rate !== DEFAULT_AUDIO_SAMPLE_RATE) {
    throw new MappingError(
      'bad-requirements',
      `audioSampleRate no soportado por FreeCut MP4 (${String(rate)}); el pipeline nativo fija ${DEFAULT_AUDIO_SAMPLE_RATE} Hz.`,
    );
  }
  return rate;
}

function validateProjectAndScene(project: Project, sceneId: string): { fps: number; scene: Scene } {
  if (!sceneId) {
    throw new MappingError('bad-requirements', 'requirements.sceneId (string) es obligatorio.');
  }

  const fps = project.fps.num / project.fps.den;
  if (!Number.isFinite(fps) || fps < 1 || fps > 240) {
    throw new MappingError(
      'unsupported-fps',
      `FPS fuera de rango soportado por FreeCut (1..240): ${project.fps.num}/${project.fps.den}`,
    );
  }

  const scene = findScene(project, sceneId);
  if (!Number.isInteger(scene.durationFrames) || scene.durationFrames < 1) {
    throw new MappingError('bad-scene', `La escena «${sceneId}» debe tener durationFrames >= 1.`);
  }
  if (scene.layers.length === 0) {
    throw new MappingError('bad-scene', `La escena «${sceneId}» no contiene capas.`);
  }
  return { fps, scene };
}

function buildTextLayerSpec(layer: Layer, fallbackName: string): FreeCutTextLayer {
  return {
    id: layer.id,
    kind: 'text',
    text: layer.text?.content ?? fallbackName,
    startFrame: layer.startFrame,
    durationFrames: layer.durationFrames,
    zIndex: layer.zIndex,
    ...(layer.text?.fontFamily !== undefined ? { fontFamily: layer.text.fontFamily } : {}),
    ...(layer.text?.fontSize !== undefined ? { fontSize: layer.text.fontSize } : {}),
    ...(layer.text?.color !== undefined ? { color: layer.text.color } : {}),
  };
}

function inferMimeType(filePath: string, declaredType?: string): string {
  if (declaredType && declaredType !== 'application/octet-stream') {
    const lower = declaredType.toLowerCase();
    return lower === 'audio/x-wav' || lower === 'audio/wave' ? 'audio/wav' : lower;
  }
  const ext = extname(filePath).toLowerCase();
  switch (ext) {
    case '.mp4':
    case '.m4v':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.mov':
      return 'video/quicktime';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.wav':
      return 'audio/wav';
    case '.mp3':
      return 'audio/mpeg';
    case '.aac':
    case '.m4a':
      return 'audio/aac';
    default:
      return declaredType?.toLowerCase() ?? 'application/octet-stream';
  }
}

function inferMediaKindFromMime(
  mimeType: string,
  layer: Layer,
): 'video' | 'audio' | 'image' | 'png-sequence' {
  const lower = mimeType.toLowerCase();
  if (lower === 'image/png-sequence') return 'png-sequence';
  if (lower.startsWith('video/')) return 'video';
  if (lower.startsWith('audio/')) return 'audio';
  if (lower.startsWith('image/')) return 'image';
  if (layer.kind === 'video' || layer.kind === 'audio' || layer.kind === 'image') {
    return layer.kind;
  }
  throw new MappingError(
    'unsupported-layer',
    `No se puede determinar el tipo de medio FreeCut para la capa «${layer.id}» con tipo "${mimeType}".`,
  );
}

function unsupportedSequenceMessage(layerId: string, uri: string): string {
  return (
    `FreeCut no admite entradas de secuencia PNG RGBA («image/png-sequence») para la capa «${layerId}» (${uri}). ` +
    'Alternativa recomendada: convertir la secuencia PNG RGBA a MOV ProRes 4444 (yuva444p12le) o WebM VP9 (yuva420p), ' +
    'o precomponer previamente el overlay con FFmpeg (-filter_complex overlay).'
  );
}

function isPngSequenceArtifact(artifact: ComposeInputArtifact): boolean {
  if (artifact.type.toLowerCase() === 'image/png-sequence') return true;
  return /%\d*d|\.png\*|\*\.png/i.test(artifact.uri);
}

function readLayerOpacity(layer: Layer): number | undefined {
  const val = layer.channels.opacity?.defaultValue;
  if (typeof val !== 'number' || !Number.isFinite(val)) return undefined;
  return Math.max(0, Math.min(1, val));
}

function readLayerVolume(layer: Layer): number | undefined {
  const val = layer.channels.volume?.defaultValue;
  if (val === undefined) return undefined;
  if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) {
    throw new MappingError(
      'bad-layer',
      `La capa «${layer.id}» tiene volume inválido: ${String(val)} (debe ser número finito >= 0).`,
    );
  }
  return val;
}

export type BuildFreeCutJobOptions = {
  sceneId: string;
  projectDir: string;
  audioSampleRate?: number;
};

/** Mapea un `Project` FME y su `sceneId` a un `FreeCutEngineJob` determinista validando assets y rutas. */
export function buildFreeCutJob(project: Project, options: BuildFreeCutJobOptions): FreeCutEngineJob {
  const { sceneId, projectDir } = options;
  const audioSampleRate = resolveAudioSampleRate(options.audioSampleRate);
  const { fps, scene } = validateProjectAndScene(project, sceneId);

  const mapped: FreeCutLayerSpec[] = [];
  for (const layer of scene.layers) {
    validateLayerTiming(layer);

    if (layer.kind === 'text') {
      mapped.push(buildTextLayerSpec(layer, project.name));
      continue;
    }

    if (layer.kind === 'video' || layer.kind === 'audio' || layer.kind === 'image') {
      const asset = project.assets.find((entry) => entry.id === layer.assetId);
      if (!asset) {
        throw new MappingError(
          'missing-asset',
          `La capa «${layer.id}» no referencia un asset existente (${String(layer.assetId)}).`,
        );
      }
      if (asset.type !== layer.kind) {
        throw new MappingError(
          'bad-layer',
          `El asset «${asset.id}» es de tipo ${asset.type}, incompatible con la capa ${layer.kind}.`,
        );
      }
      const mediaPath = resolveContainedAssetPath(projectDir, asset.uri, layer.id);
      const volume =
        layer.kind === 'audio' || layer.kind === 'video' ? readLayerVolume(layer) : undefined;
      mapped.push({
        id: layer.id,
        kind: layer.kind,
        mediaPath,
        startFrame: layer.startFrame,
        durationFrames: layer.durationFrames,
        sourceInFrame: layer.sourceInFrame ?? 0,
        zIndex: layer.zIndex,
        ...(volume !== undefined ? { volume } : {}),
      });
      continue;
    }

    throw new MappingError(
      'unsupported-layer',
      `Tipo de capa no soportado directamente por FreeCut: «${layer.id}» (${layer.kind}).`,
    );
  }

  const hasVisualLayer = mapped.some((l) => l.kind !== 'audio');
  if (!hasVisualLayer) {
    throw new MappingError(
      'unsupported-scene',
      `La escena «${sceneId}» no contiene capas visuales (video/image/text) para exportar MP4.`,
    );
  }

  mapped.sort(
    (a, b) => a.zIndex - b.zIndex || a.startFrame - b.startFrame || a.id.localeCompare(b.id),
  );

  return {
    projectId: project.id,
    projectName: project.name,
    sceneId: scene.id,
    width: project.width,
    height: project.height,
    fps,
    audioSampleRate,
    durationFrames: scene.durationFrames,
    layers: mapped,
  };
}

export type ComposeInputArtifact = {
  uri: string;
  type: string;
  layerId?: string;
};

export type BuildFreeCutComposeJobOptions = {
  sceneId: string;
  projectDir: string;
  audioSampleRate?: number;
  /** Artefactos externos suministrados en `job.inputs.slice(1)` (overlays, pistas WAV, renders previos). */
  inputs?: readonly ComposeInputArtifact[];
  /** Mapa explícito `layerId -> uri` (p. ej. desde `requirements['input.<layerId>']` o `requirements.layerInputs`). */
  layerInputMap?: Readonly<Record<string, string>>;
  /** Raíces permitidas para validar entradas externas. Si se omite, se valida contra `projectDir` + `dirname` de `inputs[]`. */
  allowedInputRoots?: readonly string[];
};

function stemOf(uri: string): string {
  const base = basename(uri.replace(/\\/g, '/'));
  const dot = base.lastIndexOf('.');
  return (dot > 0 ? base.slice(0, dot) : base).toLowerCase();
}

function matchComposeInputForLayer(
  layer: Layer,
  project: Project,
  inputs: readonly ComposeInputArtifact[],
  usedIndices: Set<number>,
  layerInputMap: Readonly<Record<string, string>> | undefined,
): ComposeInputArtifact | undefined {
  // 1. Asignación explícita en layerInputMap (requirements['input.<layerId>'] o layerInputs)
  const explicitUri = layerInputMap?.[layer.id];
  if (explicitUri !== undefined) {
    const idx = inputs.findIndex((inp) => inp.uri === explicitUri);
    if (idx !== -1) {
      usedIndices.add(idx);
      return inputs[idx];
    }
    return { uri: explicitUri, type: inferMimeType(explicitUri), layerId: layer.id };
  }

  // 2. Campo `layerId` explícito en el input
  const byLayerIdIdx = inputs.findIndex(
    (inp, idx) => !usedIndices.has(idx) && inp.layerId === layer.id,
  );
  if (byLayerIdIdx !== -1) {
    usedIndices.add(byLayerIdIdx);
    return inputs[byLayerIdIdx];
  }

  // 3. Coincidencia por URI de asset o renderArtifactId/uri de externalProject
  const asset = layer.assetId
    ? project.assets.find((entry) => entry.id === layer.assetId)
    : undefined;
  const byUriIdx = inputs.findIndex((inp, idx) => {
    if (usedIndices.has(idx)) return false;
    if (asset && inp.uri === asset.uri) return true;
    if (layer.externalProject?.uri && inp.uri === layer.externalProject.uri) return true;
    return false;
  });
  if (byUriIdx !== -1) {
    usedIndices.add(byUriIdx);
    return inputs[byUriIdx];
  }

  // 4. Coincidencia por nombre base de layer.id, externalProject.renderArtifactId o asset.id
  const candidates = new Set<string>([layer.id.toLowerCase()]);
  if (layer.assetId) candidates.add(layer.assetId.toLowerCase());
  if (layer.externalProject?.renderArtifactId) {
    candidates.add(layer.externalProject.renderArtifactId.toLowerCase());
  }
  const byStemIdx = inputs.findIndex(
    (inp, idx) => !usedIndices.has(idx) && candidates.has(stemOf(inp.uri)),
  );
  if (byStemIdx !== -1) {
    usedIndices.add(byStemIdx);
    return inputs[byStemIdx];
  }

  return undefined;
}

/**
 * Mapea una escena multipista para `edit.compose` (FDN-042a / FDN-074a).
 */
export function buildFreeCutComposeJob(
  project: Project,
  options: BuildFreeCutComposeJobOptions,
): FreeCutEngineJob {
  const { sceneId, projectDir } = options;
  const audioSampleRate = resolveAudioSampleRate(options.audioSampleRate);
  const { fps, scene } = validateProjectAndScene(project, sceneId);
  const inputs = options.inputs ?? [];
  const usedIndices = new Set<number>();

  const effectiveAllowedRoots: string[] =
    options.allowedInputRoots !== undefined
      ? [...options.allowedInputRoots]
      : [projectDir];

  if (options.allowedInputRoots === undefined) {
    for (const inp of inputs) {
      const fsPath = toFsPath(inp.uri);
      if (isAbsolute(fsPath) && !hasParentTraversal(fsPath)) {
        try {
          effectiveAllowedRoots.push(dirname(realpathSync(fsPath)));
        } catch {
          // Se validará al resolver la capa correspondiente
        }
      }
    }
  }

  const orderedLayers = [...scene.layers].sort(
    (a, b) => a.zIndex - b.zIndex || a.startFrame - b.startFrame || a.id.localeCompare(b.id),
  );
  const matchedArtifactByLayerId = new Map<string, ComposeInputArtifact>();

  for (const layer of orderedLayers) {
    validateLayerTiming(layer);
    if (layer.kind === 'text') continue;
    const direct = matchComposeInputForLayer(
      layer,
      project,
      inputs,
      usedIndices,
      options.layerInputMap,
    );
    if (direct !== undefined) {
      matchedArtifactByLayerId.set(layer.id, direct);
    }
  }

  for (const layer of orderedLayers) {
    if (
      layer.kind !== 'svg' &&
      layer.kind !== 'drawing' &&
      layer.kind !== 'model3d'
    ) {
      continue;
    }
    if (matchedArtifactByLayerId.has(layer.id)) continue;
    const nextFreeIdx = inputs.findIndex((_, idx) => !usedIndices.has(idx));
    if (nextFreeIdx !== -1) {
      usedIndices.add(nextFreeIdx);
      const artifact = inputs[nextFreeIdx];
      if (artifact !== undefined) {
        matchedArtifactByLayerId.set(layer.id, artifact);
      }
    }
  }

  const mapped: FreeCutLayerSpec[] = [];
  for (const layer of orderedLayers) {
    if (layer.kind === 'text') {
      mapped.push(buildTextLayerSpec(layer, project.name));
      continue;
    }

    const delivered = matchedArtifactByLayerId.get(layer.id);
    if (delivered !== undefined) {
      if (isPngSequenceArtifact(delivered)) {
        throw new MappingError(
          'unsupported-alpha',
          unsupportedSequenceMessage(layer.id, delivered.uri),
        );
      }

      const mediaPath = resolveExternalInputPath(
        delivered.uri,
        projectDir,
        layer.id,
        effectiveAllowedRoots,
      );
      const mimeType = inferMimeType(mediaPath, delivered.type);
      const kind = inferMediaKindFromMime(mimeType, layer);
      if (kind === 'png-sequence') {
        throw new MappingError(
          'unsupported-alpha',
          unsupportedSequenceMessage(layer.id, delivered.uri),
        );
      }

      const volume =
        kind === 'audio' || kind === 'video' ? readLayerVolume(layer) : undefined;
      const explicitOpacity = kind === 'audio' ? undefined : readLayerOpacity(layer);
      const isImageOverlay = kind === 'image' && layer.zIndex > 0;
      const preserveAlpha =
        kind === 'image' && mimeType === 'image/png' && (layer.zIndex > 0 || explicitOpacity === 1);
      const opacity =
        preserveAlpha && (explicitOpacity === undefined || explicitOpacity >= 1)
          ? 0.999
          : explicitOpacity;

      mapped.push({
        id: layer.id,
        kind,
        mediaPath,
        startFrame: layer.startFrame,
        durationFrames: layer.durationFrames,
        sourceInFrame: layer.sourceInFrame ?? 0,
        zIndex: layer.zIndex,
        mimeType,
        ...(volume !== undefined ? { volume } : {}),
        ...(isImageOverlay || preserveAlpha ? { preserveAlpha: true } : {}),
        ...(opacity !== undefined ? { opacity } : {}),
        ...(kind !== 'audio' ? { width: project.width, height: project.height } : {}),
      });
      continue;
    }

    if (layer.kind === 'video' || layer.kind === 'audio' || layer.kind === 'image') {
      const asset = project.assets.find((entry) => entry.id === layer.assetId);
      if (!asset) {
        throw new MappingError(
          'missing-asset',
          `La capa «${layer.id}» no referencia un asset existente (${String(layer.assetId)}).`,
        );
      }
      if (asset.type !== layer.kind) {
        throw new MappingError(
          'bad-layer',
          `El asset «${asset.id}» es de tipo ${asset.type}, incompatible con la capa ${layer.kind}.`,
        );
      }
      const mediaPath = resolveContainedAssetPath(projectDir, asset.uri, layer.id);
      const mimeType = inferMimeType(mediaPath);
      const volume =
        layer.kind === 'audio' || layer.kind === 'video' ? readLayerVolume(layer) : undefined;
      const explicitOpacity = layer.kind === 'audio' ? undefined : readLayerOpacity(layer);
      const preserveAlpha =
        layer.kind === 'image' &&
        mimeType === 'image/png' &&
        (layer.zIndex > 0 || explicitOpacity === 1);
      const opacity =
        preserveAlpha && (explicitOpacity === undefined || explicitOpacity >= 1)
          ? 0.999
          : explicitOpacity;

      mapped.push({
        id: layer.id,
        kind: layer.kind,
        mediaPath,
        startFrame: layer.startFrame,
        durationFrames: layer.durationFrames,
        sourceInFrame: layer.sourceInFrame ?? 0,
        zIndex: layer.zIndex,
        mimeType,
        ...(volume !== undefined ? { volume } : {}),
        ...(preserveAlpha ? { preserveAlpha: true } : {}),
        ...(opacity !== undefined ? { opacity } : {}),
        ...(layer.kind !== 'audio' ? { width: project.width, height: project.height } : {}),
      });
      continue;
    }

    if (layer.kind === 'svg' || layer.kind === 'drawing' || layer.kind === 'model3d') {
      throw new MappingError(
        'missing-overlay-input',
        `La capa «${layer.id}» (${layer.kind}) requiere su artefacto renderizado en job.inputs[] o requirements['input.${layer.id}'].`,
      );
    }

    throw new MappingError(
      'unsupported-layer',
      `Tipo de capa no soportado directamente por FreeCut: «${layer.id}» (${layer.kind}).`,
    );
  }

  const hasVisualLayer = mapped.some((l) => l.kind !== 'audio');
  if (!hasVisualLayer) {
    throw new MappingError(
      'unsupported-scene',
      `La escena «${sceneId}» no contiene capas visuales (video/image/text) para exportar MP4.`,
    );
  }

  return {
    projectId: project.id,
    projectName: project.name,
    sceneId: scene.id,
    width: project.width,
    height: project.height,
    fps,
    audioSampleRate,
    durationFrames: scene.durationFrames,
    layers: mapped,
  };
}

export type DirectClipJobOptions = {
  clipPath: string;
  projectDir: string;
  width: number;
  height: number;
  fps: number;
  durationFrames: number;
  audioSampleRate?: number;
  projectName?: string;
  sceneId?: string;
};

/** Construye un `FreeCutEngineJob` a partir de un clip único contenido en `projectDir`. */
export function buildDirectClipJob(options: DirectClipJobOptions): FreeCutEngineJob {
  const mediaPath = resolveContainedAssetPath(options.projectDir, options.clipPath, 'clip');
  const audioSampleRate = resolveAudioSampleRate(options.audioSampleRate);
  const sceneId = options.sceneId ?? 'direct-clip';
  return {
    projectId: sceneId,
    projectName: options.projectName ?? sceneId,
    sceneId,
    width: options.width,
    height: options.height,
    fps: options.fps,
    audioSampleRate,
    durationFrames: options.durationFrames,
    layers: [
      {
        id: 'clip-0',
        kind: 'video',
        mediaPath,
        startFrame: 0,
        durationFrames: options.durationFrames,
        sourceInFrame: 0,
        zIndex: 0,
      },
    ],
  };
}
