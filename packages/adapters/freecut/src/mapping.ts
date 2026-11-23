/**
 * Mapeo determinista de una escena de `@fme/project` (v1 migrado o v2) a la especificación
 * de job del motor CLI de FreeCut (`runtime/engines/freecut/cli.mjs`).
 */
import { statSync, realpathSync } from 'node:fs';
import { isAbsolute, resolve, sep } from 'node:path';
import type { Layer, Project, Scene } from '@fme/project';

export type FreeCutMediaLayer = {
  id: string;
  kind: 'video' | 'audio' | 'image';
  mediaPath: string;
  startFrame: number;
  durationFrames: number;
  sourceInFrame: number;
  zIndex: number;
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
  if (!uri || isAbsolute(uri) || /^[a-zA-Z]:/.test(uri)) {
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

export type BuildFreeCutJobOptions = {
  sceneId: string;
  projectDir: string;
};

/** Mapea un `Project` FME y su `sceneId` a un `FreeCutEngineJob` determinista validando assets y rutas. */
export function buildFreeCutJob(project: Project, options: BuildFreeCutJobOptions): FreeCutEngineJob {
  const { sceneId, projectDir } = options;
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

  const mapped: FreeCutLayerSpec[] = [];
  for (const layer of scene.layers) {
    validateLayerTiming(layer);

    if (layer.kind === 'text') {
      const textLayer: FreeCutTextLayer = {
        id: layer.id,
        kind: 'text',
        text: layer.text?.content ?? project.name,
        startFrame: layer.startFrame,
        durationFrames: layer.durationFrames,
        zIndex: layer.zIndex,
        ...(layer.text?.fontFamily !== undefined ? { fontFamily: layer.text.fontFamily } : {}),
        ...(layer.text?.fontSize !== undefined ? { fontSize: layer.text.fontSize } : {}),
        ...(layer.text?.color !== undefined ? { color: layer.text.color } : {}),
      };
      mapped.push(textLayer);
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
      mapped.push({
        id: layer.id,
        kind: layer.kind,
        mediaPath,
        startFrame: layer.startFrame,
        durationFrames: layer.durationFrames,
        sourceInFrame: layer.sourceInFrame ?? 0,
        zIndex: layer.zIndex,
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
  projectName?: string;
  sceneId?: string;
};

/** Construye un `FreeCutEngineJob` a partir de un clip único contenido en `projectDir`. */
export function buildDirectClipJob(options: DirectClipJobOptions): FreeCutEngineJob {
  const mediaPath = resolveContainedAssetPath(options.projectDir, options.clipPath, 'clip');
  const sceneId = options.sceneId ?? 'direct-clip';
  return {
    projectId: sceneId,
    projectName: options.projectName ?? sceneId,
    sceneId,
    width: options.width,
    height: options.height,
    fps: options.fps,
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
