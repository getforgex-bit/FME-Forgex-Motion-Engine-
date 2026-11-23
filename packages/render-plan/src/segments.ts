import { DependencyGraph, dependencyHash } from '@fme/cache';
import type { JsonValue } from '@fme/cache';
import type { Layer, Project } from '@fme/project';
import { selectPreviewProfile, type PreviewProfile } from './preview.ts';

export type RenderAdapterDependency = {
  readonly pluginId: string;
  readonly version: string;
  readonly engineVersion?: string;
};

export type LayerRenderInputs = {
  readonly adapters?: readonly RenderAdapterDependency[];
  readonly parameters?: Readonly<Record<string, JsonValue>>;
};

export type RenderPlanOptions = {
  readonly sequenceId: string;
  readonly sceneId: string;
  readonly segmentFrames: number;
  readonly vramBudgetMiB: number;
  readonly layerInputs?: Readonly<Record<string, LayerRenderInputs>>;
};

export type RenderChange = { readonly kind: 'layer' | 'asset' | 'adapter'; readonly id: string };
export type RenderDependency = RenderChange | { readonly kind: 'segment'; readonly id: string };

type FrameRange = { readonly startFrame: number; readonly endFrameExclusive: number };

export type RenderSegment = FrameRange & {
  readonly id: string;
  readonly layerId: string;
  readonly cacheKey: string;
  readonly dependencies: readonly RenderDependency[];
};

export type RenderPlan = {
  readonly projectId: string;
  readonly sequenceId: string;
  readonly sceneId: string;
  readonly profile: PreviewProfile;
  readonly segments: readonly RenderSegment[];
};

type SegmentRange = FrameRange & { readonly id: string; readonly layer: Layer };

function requireUnique<T extends { id: string }>(values: readonly T[], id: string, label: string): T {
  const matches = values.filter((value) => value.id === id);
  if (matches.length !== 1) throw new Error(`El id de ${label} ${JSON.stringify(id)} debe identificar un único elemento.`);
  return matches[0]!;
}

function assertFrameCount(value: number, min: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < min) {
    throw new RangeError(`${label} debe ser un entero seguro mayor o igual a ${min}.`);
  }
}

function getGuide(layer: Layer, layers: ReadonlyMap<string, Layer>): Layer | undefined {
  const id = layer.guide3DLayerId;
  if (id === undefined || !layer.techniques.includes('2d-guided-by-3d')) return undefined;
  const guide = layers.get(id);
  if (!guide) throw new Error(`La guía 3D ${JSON.stringify(id)} no existe en la escena.`);
  return guide;
}

function overlappingRanges(ranges: readonly SegmentRange[], target: FrameRange): readonly SegmentRange[] {
  // Busca el primer rango que termina después del inicio de target.
  let low = 0;
  let high = ranges.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (ranges[middle]!.endFrameExclusive <= target.startFrame) low = middle + 1;
    else high = middle;
  }
  const matches: SegmentRange[] = [];
  for (let index = low; index < ranges.length; index++) {
    const range = ranges[index]!;
    if (range.startFrame >= target.endFrameExclusive) break;
    matches.push(range);
  }
  return matches;
}

/** Planifica ventanas semiabiertas por capa en coordenadas de la escena. */
export function planSceneRender(project: Project, options: RenderPlanOptions): RenderPlan {
  const { sequenceId, sceneId, segmentFrames, vramBudgetMiB } = options;
  const sequence = requireUnique(project.sequences, sequenceId, 'secuencia');
  const scene = requireUnique(sequence.scenes, sceneId, 'escena');
  assertFrameCount(scene.durationFrames, 0, 'La duración de la escena');
  assertFrameCount(segmentFrames, 1, 'El tamaño de segmento');

  const profile = selectPreviewProfile({ width: project.width, height: project.height, vramBudgetMiB });
  const renderProfile = { width: profile.width, height: profile.height, samples: profile.samples };
  const layers = new Map(scene.layers.map((layer) => [layer.id, layer]));
  if (layers.size !== scene.layers.length) throw new Error('Los ids de capa de una escena deben ser únicos.');
  const assets = new Map(project.assets.map((asset) => [asset.id, asset]));
  if (assets.size !== project.assets.length) throw new Error('Los ids de asset de un proyecto deben ser únicos.');
  const layerInputs = new Map(Object.entries(options.layerInputs ?? {}));
  const rangesByLayer = new Map<string, SegmentRange[]>();

  for (const layer of scene.layers) {
    assertFrameCount(layer.startFrame, 0, 'El inicio de capa');
    assertFrameCount(layer.durationFrames, 0, 'La duración de capa');
    const layerFrames = Math.min(layer.durationFrames, scene.durationFrames - layer.startFrame);
    const layerEnd = layer.startFrame + layerFrames;
    const ranges: SegmentRange[] = [];
    for (let startFrame = layer.startFrame; startFrame < layerEnd;) {
      const endFrameExclusive = startFrame + Math.min(segmentFrames, layerEnd - startFrame);
      const id = JSON.stringify([project.id, sequenceId, sceneId, layer.id, startFrame, endFrameExclusive]);
      ranges.push({ id, layer, startFrame, endFrameExclusive });
      startFrame = endFrameExclusive;
    }
    rangesByLayer.set(layer.id, ranges);
  }

  const completed = new Map<string, RenderSegment>();
  const visiting = new Set<string>();

  function finalize(range: SegmentRange): RenderSegment {
    const cached = completed.get(range.id);
    if (cached) return cached;
    if (visiting.has(range.id)) throw new Error(`Dependencia cíclica de guía 3D en el segmento ${range.id}.`);
    visiting.add(range.id);

    const { id, layer, startFrame, endFrameExclusive } = range;
    const guide = getGuide(layer, layers);
    const guideSegments = guide ? overlappingRanges(rangesByLayer.get(guide.id)!, range).map(finalize) : [];
    const input = layerInputs.get(layer.id);
    const adapters = input?.adapters ?? [];
    const parameters = input?.parameters ?? {};
    const fallbackText = layer.kind === 'text' && layer.text === undefined && typeof parameters.text !== 'string'
      ? project.name
      : null;
    const asset = layer.assetId === undefined ? undefined : assets.get(layer.assetId);
    const adapterIds = new Set(adapters.map((adapter) => adapter.pluginId));
    if (layer.externalProject) adapterIds.add(layer.externalProject.pluginId);

    const dependencies: RenderDependency[] = [{ kind: 'layer', id: layer.id }];
    if (layer.assetId !== undefined) dependencies.push({ kind: 'asset', id: layer.assetId });
    for (const adapterId of adapterIds) dependencies.push({ kind: 'adapter', id: adapterId });
    for (const segment of guideSegments) dependencies.push({ kind: 'segment', id: segment.id });

    const cacheKey = dependencyHash({
      projectId: project.id,
      segment: {
        id, layer, startFrame, endFrameExclusive,
        schemaVersion: project.schemaVersion, fps: project.fps, seed: project.seed,
        profile: renderProfile, parameters, fallbackText,
        guides: guideSegments.map((segment) => ({ id: segment.id, cacheKey: segment.cacheKey })),
      },
      assets: asset ? [asset] : [],
      adapters,
    });

    const segment = { id, layerId: layer.id, startFrame, endFrameExclusive, cacheKey, dependencies };
    completed.set(id, segment);
    visiting.delete(id);
    return segment;
  }

  const segments = [...rangesByLayer.values()].flatMap((ranges) => ranges.map(finalize));
  return { projectId: project.id, sequenceId, sceneId, profile, segments };
}

function dependencyNode(dependency: RenderDependency): string {
  return JSON.stringify([dependency.kind, dependency.id]);
}

/** Selecciona en orden del plan los segmentos derivados de los cambios declarados. */
export function affectedSegments(plan: RenderPlan, changes: readonly RenderChange[]): RenderSegment[] {
  const graph = new DependencyGraph();
  const segmentNode = (id: string) => dependencyNode({ kind: 'segment', id });
  for (const segment of plan.segments) {
    graph.setDependencies(segmentNode(segment.id), segment.dependencies.map(dependencyNode));
  }

  const targets = new Set(changes.map(dependencyNode));
  const affected = new Set<string>();
  for (const target of targets) {
    for (const node of graph.invalidate(target)) affected.add(node);
  }
  return plan.segments.filter((segment) => affected.has(segmentNode(segment.id)));
}
