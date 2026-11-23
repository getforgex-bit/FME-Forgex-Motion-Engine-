/**
 * Operaciones compartidas por el servidor MCP y la CLI (FDN-080b): cargar proyectos, localizar capas,
 * enrutar, ejecutar jobs y generar previews. Sin dependencias del SDK de MCP: la CLI lo importa como
 * `@fme/mcp/ops`, de modo que ambas apps son adaptadores finos sobre la misma lógica.
 */
import { randomUUID } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve, sep } from 'node:path';
import { sampleCurve } from '@fme/adapter-revideo';
import {
  checkAdapterResult,
  createConnectorRegistry,
  type AdapterJobResult,
  type ConnectorAdapter,
  type ConnectorRegistry,
  type JobRequest,
} from '@fme/connectors';
import {
  deserialize,
  parseProject,
  serialize,
  type Channel,
  type Curve,
  type Layer,
  type Project,
  type ValidationIssue,
} from '@fme/project';
import { planRoute, type RoutePlan, type RouteTask } from '@fme/router';
import { planSceneRender, selectPreviewProfile, type PreviewProfile, type RenderPlan } from '@fme/render-plan';

/** Error estructurado de las operaciones; `code` es estable. */
export class OpsError extends Error {
  readonly code: string;
  readonly details?: unknown;
  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'OpsError';
    this.code = code;
    this.details = details;
  }
}

export function summarize(p: Project) {
  const layers = p.sequences.flatMap((s) => s.scenes.flatMap((sc) => sc.layers));
  return {
    id: p.id,
    name: p.name,
    schemaVersion: p.schemaVersion,
    fps: p.fps,
    size: { width: p.width, height: p.height },
    assets: p.assets.length,
    sequences: p.sequences.length,
    scenes: p.sequences.reduce((n, s) => n + s.scenes.length, 0),
    layers: layers.length,
    artifacts: p.artifacts?.length ?? 0,
  };
}

/** Lee y valida un proyecto (migrando versiones anteriores). `file` debe ser una ruta ya validada por quien llama. */
export function loadProjectFile(file: string): { project: Project; sourceVersion: unknown } {
  let text: string;
  try {
    text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    throw new OpsError(err.code === 'ENOENT' ? 'FILE_NOT_FOUND' : 'FILE_UNREADABLE', `No se puede leer «${file}»: ${err.message}`);
  }
  const result = deserialize(text);
  if (!result.ok) {
    const unknown = result.errors.some((i: ValidationIssue) => i.code === 'unknown-schema-version');
    throw new OpsError(unknown ? 'UNKNOWN_SCHEMA_VERSION' : 'INVALID_PROJECT', `El proyecto «${file}» no es válido.`, result.errors);
  }
  let sourceVersion: unknown;
  try {
    sourceVersion = (JSON.parse(text) as { schemaVersion?: unknown }).schemaVersion;
  } catch {
    sourceVersion = undefined;
  }
  return { project: result.value, sourceVersion };
}

export type LocatedLayer = { layer: Layer; sequenceId: string; sceneId: string };

export function findLayer(project: Project, layerId: string): LocatedLayer {
  for (const seq of project.sequences) {
    for (const scene of seq.scenes) {
      const layer = scene.layers.find((l) => l.id === layerId);
      if (layer) return { layer, sequenceId: seq.id, sceneId: scene.id };
    }
  }
  throw new OpsError('LAYER_NOT_FOUND', `No existe la capa «${layerId}» en el proyecto.`);
}

/** Capacidad que debe tener el conector que renderice una capa. Las capas text y svg las pinta `render.video`. */
export function capabilityFor(layer: Layer): string {
  return layer.kind === 'text' || layer.kind === 'svg' ? 'render.video' : `render.${layer.kind}`;
}

export function routeTaskFor(layer: Layer): RouteTask {
  return { operation: 'render.video', requiredCapabilities: [capabilityFor(layer)], requiredAccepts: ['fme/project+json'] };
}

export function buildRegistry(adapters: readonly ConnectorAdapter[]): ConnectorRegistry {
  const registry = createConnectorRegistry();
  for (const a of adapters) registry.register(a.simple, a.advanced);
  return registry;
}

export type RenderLayerResult = {
  plan: RoutePlan;
  connectorId: string;
  engineVersion: string | undefined;
  result: AdapterJobResult;
  conformance: string[];
};

/**
 * Enruta la capa, comprueba el motor y ejecuta el job en `workDir`.
 * Lanza `NO_CONNECTOR` si ningún conector sirve y `ENGINE_UNAVAILABLE` (sin ejecutar nada) si falta el motor.
 */
export async function renderLayer(options: {
  adapters: readonly ConnectorAdapter[];
  projectFile: string;
  project: Project;
  layer: Layer;
  jobId?: string;
  workDir: string;
  timeoutMs: number;
  alpha?: boolean;
  seed?: number;
}): Promise<RenderLayerResult> {
  const { adapters, project, layer } = options;
  const plan = planRoute(buildRegistry(adapters), routeTaskFor(layer));
  const connectorId = plan.selected?.connectorId;
  const adapter = adapters.find((a) => a.simple.id === connectorId);
  if (plan.status !== 'planned' || adapter === undefined || connectorId === undefined) {
    throw new OpsError('NO_CONNECTOR', `Ningún conector puede renderizar la capa «${layer.id}». ${plan.justification}`, plan.rejections);
  }
  const probe = await adapter.probe();
  if (!probe.available) {
    throw new OpsError('ENGINE_UNAVAILABLE', `El motor de «${connectorId}» no está disponible; no se ejecutó el job.`, probe.diagnostics);
  }
  const jobId = options.jobId ?? randomUUID();
  mkdirSync(options.workDir, { recursive: true });
  const job: JobRequest = {
    projectId: project.id,
    operation: 'render.video',
    inputs: [{ uri: options.projectFile, type: 'fme/project+json' }],
    requirements: { layerId: layer.id, ...(options.alpha ? { alpha: true } : {}) },
    seed: options.seed ?? project.seed,
  };
  const result = await adapter.run(job, { jobId, workDir: options.workDir, timeoutMs: options.timeoutMs });
  return { plan, connectorId, engineVersion: probe.engineVersion, result, conformance: checkAdapterResult(result, adapter) };
}

// --- preview.render -------------------------------------------------------------------------------------

/** Presupuesto de VRAM del perfil de preview por defecto: GPU de referencia de 4 GB (RTX 3050). */
export const DEFAULT_PREVIEW_VRAM_MIB = 4096;
const SEGMENT_FRAMES = 30;
const BAKED_CHANNELS: readonly Channel[] = ['x', 'y', 'opacity', 'scale', 'rotation', 'expression', 'integration'];
const DEFAULT_FONT_SIZE = 96; // el del motor Revideo cuando la capa no fija `fontSize`
const MAX_SVG_BYTES = 2_000_000;

export type PreviewRange = { startFrame: number; endFrameExclusive: number };

export type PreviewBuild = {
  project: Project;
  profile: PreviewProfile;
  range: PreviewRange;
  /** Escala aplicada a las posiciones y al tamaño de fuente (ancho de preview / ancho del proyecto). */
  scale: number;
  plan: RenderPlan;
};

function bake(curve: Curve, range: PreviewRange, scale: number): Curve {
  const keyframes = [];
  for (let f = range.startFrame; f < range.endFrameExclusive; f++) {
    keyframes.push({ frame: f - range.startFrame, value: sampleCurve(curve, f, curve.defaultValue) * scale, easing: 'linear' as const });
  }
  return { defaultValue: curve.defaultValue * scale, keyframes };
}

/**
 * Deriva un proyecto de preview de una sola capa: resolución del perfil de 4 GB (`selectPreviewProfile`) y rango de
 * fotogramas (relativos a la capa). Las curvas se muestrean fotograma a fotograma, que es exactamente como las evalúa
 * el motor, así que el recorte conserva los valores; x/y y el tamaño de fuente se escalan con la resolución.
 * `assetsDir` es donde se copia el SVG de la capa (el adaptador exige que el asset esté junto al proyecto).
 */
export function buildPreviewProject(
  project: Project,
  located: LocatedLayer,
  options: { projectDir: string; assetsDir: string; startFrame?: number; endFrameExclusive?: number; vramBudgetMiB?: number },
): PreviewBuild {
  const { layer } = located;
  const start = options.startFrame ?? 0;
  const end = options.endFrameExclusive ?? layer.durationFrames;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > layer.durationFrames || start >= end) {
    throw new OpsError('INVALID_RANGE', `El rango [${start}, ${end}) debe ser entero y estar dentro de la capa (0–${layer.durationFrames}).`);
  }
  const range: PreviewRange = { startFrame: start, endFrameExclusive: end };
  let profile: PreviewProfile;
  let plan: RenderPlan;
  try {
    profile = selectPreviewProfile({ width: project.width, height: project.height, vramBudgetMiB: options.vramBudgetMiB ?? DEFAULT_PREVIEW_VRAM_MIB });
    plan = planSceneRender(project, {
      sequenceId: located.sequenceId,
      sceneId: located.sceneId,
      segmentFrames: SEGMENT_FRAMES,
      vramBudgetMiB: options.vramBudgetMiB ?? DEFAULT_PREVIEW_VRAM_MIB,
    });
  } catch (e) {
    throw new OpsError('PREVIEW_PLAN_FAILED', e instanceof Error ? e.message : String(e));
  }
  const scale = profile.width / project.width;

  const channels: Layer['channels'] = {};
  for (const name of BAKED_CHANNELS) {
    const curve = layer.channels[name];
    if (curve) channels[name] = bake(curve, range, name === 'x' || name === 'y' ? scale : 1);
  }
  const derived: Layer = {
    id: layer.id,
    kind: layer.kind,
    startFrame: 0,
    durationFrames: end - start,
    zIndex: 0,
    techniques: [...layer.techniques],
    channels,
  };
  if (layer.kind === 'text') {
    derived.text = {
      content: layer.text?.content ?? project.name,
      ...(layer.text?.fontFamily !== undefined ? { fontFamily: layer.text.fontFamily } : {}),
      fontSize: (layer.text?.fontSize ?? DEFAULT_FONT_SIZE) * scale,
      ...(layer.text?.color !== undefined ? { color: layer.text.color } : {}),
    };
  }

  const assets: Project['assets'] = [];
  if (layer.kind === 'svg' || layer.kind === 'drawing') {
    const asset = project.assets.find((a) => a.id === layer.assetId);
    if (!asset) throw new OpsError('MISSING_ASSET', `La capa «${layer.id}» no referencia un asset existente.`);
    let source: string;
    try {
      source = realpathSync(resolve(options.projectDir, asset.uri));
    } catch {
      throw new OpsError('MISSING_ASSET', `No se puede leer el asset «${asset.uri}».`);
    }
    if (!source.startsWith(realpathSync(options.projectDir) + sep)) throw new OpsError('ASSET_OUTSIDE_PROJECT', `El asset «${asset.uri}» queda fuera de la carpeta del proyecto.`);
    if (statSync(source).size > MAX_SVG_BYTES) throw new OpsError('ASSET_TOO_LARGE', 'El SVG supera 2 MB.');
    mkdirSync(options.assetsDir, { recursive: true });
    const name = basename(source);
    copyFileSync(source, resolve(options.assetsDir, name));
    assets.push({ ...asset, uri: name });
    derived.assetId = asset.id;
  }

  const candidate = {
    schemaVersion: project.schemaVersion,
    id: project.id,
    name: project.name,
    fps: project.fps,
    width: profile.width,
    height: profile.height,
    seed: project.seed,
    assets,
    sequences: [{ id: located.sequenceId, scenes: [{ id: located.sceneId, durationFrames: end - start, layers: [derived] }] }],
  };
  const parsed = parseProject(candidate);
  if (!parsed.ok) throw new OpsError('PREVIEW_PROJECT_INVALID', 'No se pudo derivar un proyecto de preview válido.', parsed.errors);
  return { project: parsed.value, profile, range, scale, plan };
}

export type PreviewResult = RenderLayerResult & {
  profile: PreviewProfile;
  range: PreviewRange;
  scale: number;
  /** Segmentos del plan de render de la capa que solapan con el rango pedido. */
  segments: { id: string; startFrame: number; endFrameExclusive: number; cacheKey: string }[];
  previewProject: string;
};

/** Genera una preview de una capa (o de un rango de sus fotogramas) a la resolución del perfil de 4 GB. */
export async function previewRender(options: {
  adapters: readonly ConnectorAdapter[];
  projectFile: string;
  layerId: string;
  /** Carpeta donde se crea el directorio del job. */
  workRoot: string;
  startFrame?: number;
  endFrameExclusive?: number;
  vramBudgetMiB?: number;
  timeoutMs: number;
  alpha?: boolean;
}): Promise<PreviewResult> {
  const { project } = loadProjectFile(options.projectFile);
  const located = findLayer(project, options.layerId);
  const jobId = randomUUID();
  const jobDir = resolve(options.workRoot, jobId);
  const projectDir = dirname(options.projectFile);
  const previewDir = resolve(jobDir, 'preview');
  const build = buildPreviewProject(project, located, {
    projectDir,
    assetsDir: resolve(previewDir, 'assets'),
    ...(options.startFrame !== undefined ? { startFrame: options.startFrame } : {}),
    ...(options.endFrameExclusive !== undefined ? { endFrameExclusive: options.endFrameExclusive } : {}),
    ...(options.vramBudgetMiB !== undefined ? { vramBudgetMiB: options.vramBudgetMiB } : {}),
  });
  mkdirSync(previewDir, { recursive: true });
  const previewProject = resolve(previewDir, 'project.fme.json');
  writeFileSync(previewProject, serialize(build.project));
  const rendered = await renderLayer({
    adapters: options.adapters,
    projectFile: previewProject,
    project: build.project,
    layer: build.project.sequences[0]!.scenes[0]!.layers[0]!,
    jobId,
    workDir: resolve(jobDir, 'out'),
    timeoutMs: options.timeoutMs,
    ...(options.alpha ? { alpha: true } : {}),
    seed: project.seed,
  });
  const segments = build.plan.segments
    .filter((s) => s.layerId === located.layer.id && s.endFrameExclusive > located.layer.startFrame + build.range.startFrame && s.startFrame < located.layer.startFrame + build.range.endFrameExclusive)
    .map((s) => ({ id: s.id, startFrame: s.startFrame, endFrameExclusive: s.endFrameExclusive, cacheKey: s.cacheKey }));
  return { ...rendered, profile: build.profile, range: build.range, scale: build.scale, segments, previewProject };
}
