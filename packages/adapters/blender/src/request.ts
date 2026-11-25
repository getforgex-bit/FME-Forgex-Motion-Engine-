import { readFileSync } from 'node:fs';
import { dirname, extname } from 'node:path';
import { deserialize } from '@fme/project';
import { prepareGradientOps } from './gradients.ts';
import { filePath, optionalAsset, requirePath } from './paths.ts';
import type { BlenderGradientOps } from '@fme/art-direction';
import type { JobRequest } from '@fme/connectors';
import type { Layer, Project } from '@fme/project';

export const operation = 'render.image-sequence';
export const projectType = 'fme/project+json';

export type RenderRequest = {
  width: number;
  height: number;
  durationFrames: number;
  fps: Project['fps'];
  channels: Layer['channels'];
  gradientOps?: BlenderGradientOps[];
  seed: number;
};

type PreparedJob = {
  request: RenderRequest;
  modelPath: string | undefined;
  layer: Layer;
  cameraGuide: boolean;
};

function readProject(projectPath: string): Project {
  const result = deserialize(readFileSync(projectPath, 'utf8'));
  if (!result.ok) {
    const first = result.errors[0];
    throw new Error(first ? 'Proyecto FME inválido en ' + first.path + ': ' + first.message : 'Proyecto FME inválido.');
  }
  return result.value;
}

function resolution(project: Project, value: string | boolean | number | undefined) {
  if (value === undefined) return { width: project.width, height: project.height };
  if (typeof value !== 'string') throw new Error('resolution debe tener el formato ANCHOxALTO.');
  const match = /^([1-9]\d*)x([1-9]\d*)$/.exec(value);
  if (!match) throw new Error('resolution debe tener el formato ANCHOxALTO.');
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)) throw new Error('resolution fuera de rango.');
  return { width, height };
}

function chooseLayer(project: Project, layerId: string): Layer {
  const layers = project.sequences.flatMap((sequence) =>
    sequence.scenes.flatMap((scene) => scene.layers.filter((layer) => layer.id === layerId)),
  );
  const layer = layers[0];
  if (layers.length !== 1 || !layer || layer.kind !== 'model3d') {
    throw new Error('layerId debe identificar una única capa model3d.');
  }
  if (layer.durationFrames < 1) throw new Error('La capa model3d debe tener al menos un fotograma.');
  return layer;
}

function chooseAsset(project: Project, layer: Layer, projectPath: string, roots: readonly string[]): string | undefined {
  if (layer.assetId === undefined) return undefined;
  const assets = project.assets.filter((asset) => asset.id === layer.assetId);
  const asset = assets[0];
  if (!asset) return undefined;
  if (assets.length > 1 || asset.type !== 'model3d') throw new Error('El asset de la capa debe ser un model3d único.');
  const path = optionalAsset(filePath(asset.uri, dirname(projectPath)), roots);
  if (path && !['.blend', '.glb'].includes(extname(path).toLowerCase())) {
    throw new Error('Los assets existentes deben ser archivos .blend o .glb autocontenidos.');
  }
  return path;
}

export function prepareJob(job: JobRequest, roots: readonly string[]): PreparedJob {
  if (job.operation !== operation) throw new Error('Operación no soportada: ' + job.operation);
  const input = job.inputs[0];
  if (job.inputs.length !== 1 || !input || input.type !== projectType) {
    throw new Error('La operación requiere exactamente un proyecto ' + projectType + '.');
  }
  const layerId = job.requirements.layerId;
  if (typeof layerId !== 'string' || layerId.length === 0) throw new Error('requirements.layerId es obligatorio.');
  if (Object.keys(job.requirements).some((key) => key !== 'layerId' && key !== 'resolution' && key !== 'cameraGuide')) {
    throw new Error('Solo se admiten los requisitos cameraGuide, layerId y resolution.');
  }
  const cameraGuide = job.requirements.cameraGuide;
  if (cameraGuide !== undefined && typeof cameraGuide !== 'boolean') {
    throw new Error('requirements.cameraGuide debe ser booleano.');
  }
  if (job.seed !== undefined && !Number.isSafeInteger(job.seed)) throw new Error('seed debe ser un entero seguro.');

  const projectPath = requirePath(filePath(input.uri), roots, 'file');
  const project = readProject(projectPath);
  if (project.id !== job.projectId) throw new Error('projectId no coincide con el proyecto FME.');
  const layer = chooseLayer(project, layerId);
  const modelPath = chooseAsset(project, layer, projectPath, roots);
  const gradientOps = prepareGradientOps(layer);
  return {
    layer,
    cameraGuide: cameraGuide === true,
    modelPath,
    request: {
      ...resolution(project, job.requirements.resolution),
      durationFrames: layer.durationFrames,
      fps: project.fps,
      channels: layer.channels,
      ...(gradientOps === undefined ? {} : { gradientOps }),
      seed: job.seed ?? project.seed,
    },
  };
}
