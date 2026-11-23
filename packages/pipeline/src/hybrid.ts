/**
 * Pipeline de la prueba híbrida (FDN-042c, criterio #3).
 *
 * `runHybrid(projectPath, outDir)`: abre el proyecto (`deserialize`), planifica cada capa con `planWorkflow`
 * sobre un registro con los TRES adaptadores reales, ejecuta (Revideo → título y 2D con alpha; Blender → 3D en PNG RGBA
 * y precodificación a ProRes 4444 como paso propio; FreeCut → fondo, audio y composición final), registra todo en
 * `project.artifacts` (ADR-0015), enlaza `renderArtifactId` en cada capa y guarda el proyecto junto al MP4.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createBlenderAdapter } from '@fme/adapter-blender';
import { FreeCutAdapter } from '@fme/adapter-freecut';
import { RevideoAdapter } from '@fme/adapter-revideo';
import { dependencyHash } from '@fme/cache';
import type { JsonValue } from '@fme/cache';
import { createConnectorRegistry } from '@fme/connectors';
import type { ArtifactProvenance, ConnectorAdapter, JobRequest } from '@fme/connectors';
import { deserialize, parseProject, serialize } from '@fme/project';
import type { Layer, Project, RenderArtifact } from '@fme/project';
import { planWorkflow } from '@fme/router';
import type { RouteTask } from '@fme/router';
import { PRORES_STEP_ID, PRORES_STEP_VERSION, encodeProRes, findInPath } from './prores.ts';

export type Diag = { code: string; message: string; severity?: string };

export type HybridOptions = {
  /** Resolución con la que Blender renderiza (por memoria de vídeo); el MOV ProRes se reescala al tamaño del proyecto. */
  blenderResolution?: string;
  /** Tiempo máximo por job, en ms (por defecto 15 min). */
  timeoutMs?: number;
  ffmpegPath?: string;
  ffprobePath?: string;
  blenderPath?: string;
  freecutDir?: string;
  puppeteerCacheDir?: string;
  /** Raíz para los logs de `probe()` de los adaptadores (por defecto, `<outDir>/probe`). */
  probeWorkDir?: string;
  /** Adaptadores ya construidos (tests). */
  adapters?: Partial<Record<'revideo' | 'blender' | 'freecut', ConnectorAdapter>>;
};

export type HybridStep = {
  id: string;
  layerId?: string;
  operation: string;
  adapterId: string;
  status: 'ok' | 'failed';
  diagnostics: Diag[];
  provenance: ArtifactProvenance[];
  workDir: string;
};

export type HybridResult = {
  status: 'ok' | 'failed';
  /** MP4 final (`<outDir>/hybrid.mp4`). */
  mp4?: string;
  /** Proyecto resultante (`<outDir>/project.fme.json`), con `artifacts` enlazados. */
  projectPath?: string;
  project?: Project;
  steps: HybridStep[];
  /** Ids de conector que aparecen en la procedencia, sin repetir. */
  adaptersInProvenance: string[];
  diagnostics: Diag[];
};

const REVIDEO_ID = 'revideo';
const BLENDER_ID = 'adapter.blender';
const FREECUT_ID = 'adapter.freecut';

const sha256File = (p: string): string => createHash('sha256').update(readFileSync(p)).digest('hex');
const plain = (v: unknown): JsonValue => JSON.parse(JSON.stringify(v)) as JsonValue;
const toPath = (uri: string): string => (uri.startsWith('file:') ? fileURLToPath(uri) : uri);
const isFile = (p: string): boolean => { try { return statSync(p).isFile(); } catch { return false; } };

function dirIn(root: string, name: string): string {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Construye los tres adaptadores reales con las rutas de confianza del anfitrión. */
export function createHybridAdapters(projectDir: string, outDir: string, options: HybridOptions = {}): Record<'revideo' | 'blender' | 'freecut', ConnectorAdapter> {
  const probeRoot = options.probeWorkDir ?? join(outDir, 'probe');
  mkdirSync(probeRoot, { recursive: true });
  return {
    revideo: options.adapters?.revideo ?? new RevideoAdapter({
      probeWorkDir: dirIn(probeRoot, 'revideo'),
      ...(options.ffmpegPath ? { ffmpegPath: options.ffmpegPath } : {}),
      ...(options.ffprobePath ? { ffprobePath: options.ffprobePath } : {}),
      ...(options.puppeteerCacheDir ? { puppeteerCacheDir: options.puppeteerCacheDir } : {}),
    }),
    blender: options.adapters?.blender ?? createBlenderAdapter({
      allowedRoots: [projectDir, outDir],
      ...(options.blenderPath ? { blenderPath: options.blenderPath } : {}),
    }) as unknown as ConnectorAdapter,
    freecut: options.adapters?.freecut ?? new FreeCutAdapter({
      probeWorkDir: dirIn(probeRoot, 'freecut'),
      ...(options.ffmpegPath ? { ffmpegPath: options.ffmpegPath } : {}),
      ...(options.ffprobePath ? { ffprobePath: options.ffprobePath } : {}),
      ...(options.freecutDir ? { freecutDir: options.freecutDir } : {}),
    }),
  };
}

type Classified = { revideo: Layer[]; blender: Layer[]; native: Layer[] };

function classify(layers: readonly Layer[]): Classified {
  const out: Classified = { revideo: [], blender: [], native: [] };
  for (const layer of layers) {
    const plugin = layer.externalProject?.pluginId;
    if (layer.kind === 'text' || plugin === 'revideo') out.revideo.push(layer);
    else if (layer.kind === 'model3d' || plugin === 'blender') out.blender.push(layer);
    else out.native.push(layer);
  }
  return out;
}

function artifactFor(opts: {
  project: Project; layer?: Layer; id: string; uri: string; type: string; prov: ArtifactProvenance;
  extraSegment?: Record<string, unknown>; extraConfig?: Record<string, string | number | boolean>;
}): RenderArtifact {
  const { project, layer, prov } = opts;
  const hash = dependencyHash({
    projectId: project.id,
    segment: plain({ layer: layer ?? null, fps: project.fps, width: project.width, height: project.height, ...opts.extraSegment }),
    assets: layer?.assetId ? project.assets.filter((a) => a.id === layer.assetId).map(plain) : [],
    adapters: [plain({ pluginId: prov.pluginId, pluginVersion: prov.pluginVersion, engineVersion: prov.engineVersion, params: prov.params })],
  });
  return {
    id: opts.id, uri: opts.uri, type: opts.type, dependencyHash: hash,
    producedBy: { pluginId: prov.pluginId, pluginVersion: prov.pluginVersion },
    ...(prov.seed !== undefined ? { seed: prov.seed } : {}),
    config: { ...prov.params, engineVersion: prov.engineVersion, sha256: prov.sha256, ...opts.extraConfig },
  };
}

export async function runHybrid(projectPath: string, outDirInput: string, options: HybridOptions = {}): Promise<HybridResult> {
  const steps: HybridStep[] = [];
  const diagnostics: Diag[] = [];
  const fail = (code: string, message: string): HybridResult => {
    diagnostics.push({ code, message });
    return { status: 'failed', steps, adaptersInProvenance: adaptersOf(steps), diagnostics };
  };
  const timeoutMs = options.timeoutMs ?? 900_000;

  // 1. Abrir el proyecto con deserialize (v3).
  mkdirSync(outDirInput, { recursive: true });
  const outDir = realpathSync(outDirInput);
  let realProject: string;
  try { realProject = realpathSync(toPath(projectPath)); } catch { return fail('bad-input', `No se puede leer el proyecto: ${projectPath}`); }
  const projectDir = dirname(realProject);
  const parsed = deserialize(readFileSync(realProject, 'utf8'));
  if (!parsed.ok) return fail('invalid-project', parsed.errors.map((e) => `${e.path}: ${e.message}`).join('; '));
  const project = parsed.value;
  const scene = project.sequences[0]?.scenes[0];
  if (!scene) return fail('bad-project', 'El proyecto no tiene escenas.');
  const fps = project.fps.num / project.fps.den;
  const layers = classify(scene.layers);

  // 2. Registro con los tres adaptadores reales y planificación con planWorkflow.
  const adapters = createHybridAdapters(projectDir, outDir, options);
  const byId: Record<string, ConnectorAdapter> = { [REVIDEO_ID]: adapters.revideo, [BLENDER_ID]: adapters.blender, [FREECUT_ID]: adapters.freecut };
  const registry = createConnectorRegistry();
  for (const a of [adapters.revideo, adapters.blender, adapters.freecut]) registry.register(a.simple, a.advanced);

  const tasks: RouteTask[] = [
    ...layers.revideo.map((l): RouteTask => ({ id: `render:${l.id}`, operation: 'render.video', requiredCapabilities: ['render.video'], requiredAccepts: ['fme/project+json'], requiredProduces: ['video/quicktime'] })),
    ...layers.blender.map((l): RouteTask => ({ id: `render:${l.id}`, operation: 'render.image-sequence', requiredCapabilities: ['render.image-sequence'], requiredAccepts: ['fme/project+json'], requiredProduces: ['image/png'] })),
    { id: 'compose', operation: 'edit.compose', requiredCapabilities: ['edit.compose'], requiredAccepts: ['fme/project+json', 'video/quicktime'], requiredProduces: ['video/mp4'] },
  ];
  const plan = planWorkflow(registry, tasks);
  if (plan.status !== 'planned') {
    const why = plan.tasks.filter((t) => t.plan.status !== 'planned').map((t) => `${t.task.id}: ${t.plan.error?.message ?? t.plan.justification}`).join(' | ');
    return fail('plan-rejected', `El router no pudo planificar el flujo: ${why}`);
  }
  const chosen = new Map<string, ConnectorAdapter>();
  for (const t of plan.tasks) {
    const id = t.plan.selected?.card.id;
    const adapter = id ? byId[id] : undefined;
    if (!id || !adapter) return fail('plan-rejected', `Sin conector para ${t.task.id}`);
    chosen.set(t.task.id!, adapter);
  }

  // Disponibilidad real de los tres motores (nunca se afirma sin comprobarla).
  for (const [id, a] of Object.entries(byId)) {
    const p = await a.probe();
    if (!p.available) return fail('engine-missing', `${id} no disponible: ${p.diagnostics.map((d) => d.message).join(' | ')}`);
  }

  const ffmpegPath = options.ffmpegPath ?? process.env.FME_FFMPEG_PATH ?? findInPath('ffmpeg');
  if (!ffmpegPath || !isFile(ffmpegPath)) return fail('engine-missing', 'No se encuentra ffmpeg (FME_FFMPEG_PATH o PATH).');

  const jobsDir = join(outDir, 'jobs');
  mkdirSync(jobsDir, { recursive: true });
  let seq = 0;
  const newJob = (label: string) => {
    const dir = join(jobsDir, `${String(++seq).padStart(2, '0')}-${label}`);
    mkdirSync(dir, { recursive: true });
    return { jobId: `${String(seq).padStart(2, '0')}-${label}`, workDir: realpathSync(dir), timeoutMs };
  };
  const record = (s: HybridStep): HybridStep => { steps.push(s); return s; };
  const projectInput = { uri: pathToFileURL(realProject).href, type: 'fme/project+json' };

  const artifacts: RenderArtifact[] = [];
  const links = new Map<string, string>(); // layerId -> renderArtifactId
  const overlays = new Map<string, string>(); // layerId -> ruta del MOV para FreeCut

  // 3a. Revideo: título y 2D → MOV ProRes con alpha.
  for (const layer of layers.revideo) {
    const adapter = chosen.get(`render:${layer.id}`)!;
    const ctx = newJob(layer.id);
    const job: JobRequest = { projectId: project.id, operation: 'render.video', inputs: [projectInput], requirements: { layerId: layer.id, alpha: true }, seed: project.seed };
    const res = await adapter.run(job, ctx);
    const step = record({ id: ctx.jobId, layerId: layer.id, operation: job.operation, adapterId: adapter.simple.id, status: res.status === 'ok' ? 'ok' : 'failed', diagnostics: res.diagnostics, provenance: res.provenance, workDir: ctx.workDir });
    if (res.status !== 'ok') return fail('step-failed', `${step.id}: ${res.diagnostics.map((d) => d.message).join(' | ')}`);
    const prov = res.provenance[0]!;
    const id = `render-${layer.id}`;
    artifacts.push(artifactFor({ project, layer, id, uri: prov.uri, type: prov.type, prov }));
    links.set(layer.id, id);
    overlays.set(layer.id, toPath(prov.uri));
  }

  // 3b. Blender: 3D → PNG RGBA → (paso propio) ProRes 4444.
  for (const layer of layers.blender) {
    const adapter = chosen.get(`render:${layer.id}`)!;
    const ctx = newJob(layer.id);
    const job: JobRequest = {
      projectId: project.id, operation: 'render.image-sequence', inputs: [projectInput], seed: project.seed,
      requirements: { layerId: layer.id, resolution: options.blenderResolution ?? '960x540' },
    };
    const res = await adapter.run(job, ctx);
    const step = record({ id: ctx.jobId, layerId: layer.id, operation: job.operation, adapterId: adapter.simple.id, status: res.status === 'ok' ? 'ok' : 'failed', diagnostics: res.diagnostics, provenance: res.provenance, workDir: ctx.workDir });
    if (res.status !== 'ok' || res.provenance.length !== layer.durationFrames) return fail('step-failed', `${step.id}: ${res.diagnostics.map((d) => d.message).join(' | ') || 'número de fotogramas inesperado'}`);

    const first = res.provenance[0]!;
    const framesDir = dirname(toPath(first.uri));
    const framesSha = createHash('sha256').update(res.provenance.map((p) => p.contentSha256 ?? p.sha256).join('\n')).digest('hex');
    const seqId = `render-${layer.id}`;
    artifacts.push(artifactFor({
      project, layer, id: seqId, uri: pathToFileURL(join(framesDir, 'frame-%04d.png')).href, type: 'image/png-sequence', prov: { ...first, sha256: framesSha },
      extraConfig: { frames: res.provenance.length, framesSha256: framesSha },
    }));
    links.set(layer.id, seqId);

    const encCtx = newJob(`${layer.id}-prores`);
    const enc = await encodeProRes({ framesDir, frames: layer.durationFrames, fps, width: project.width, height: project.height, workDir: encCtx.workDir, ffmpegPath, timeoutMs });
    record({ id: encCtx.jobId, layerId: layer.id, operation: 'encode.prores4444', adapterId: PRORES_STEP_ID, status: enc.ok ? 'ok' : 'failed', diagnostics: enc.ok ? [] : [{ code: enc.code, message: enc.message }], provenance: enc.ok ? [enc.provenance] : [], workDir: encCtx.workDir });
    if (!enc.ok) return fail(enc.code, enc.message);
    artifacts.push(artifactFor({
      project, layer, id: `${seqId}-prores`, uri: enc.provenance.uri, type: 'video/quicktime', prov: enc.provenance,
      extraSegment: { derivedFrom: seqId, framesSha256: framesSha }, extraConfig: { derivedFrom: seqId },
    }));
    overlays.set(layer.id, enc.outputPath);
  }

  // 3c. FreeCut: fondo, audio y composición final (`edit.compose`).
  // Proyecto derivado de composición: las capas renderizadas pasan a `drawing`/`model3d` (sin `text`) para recibir su MOV por id.
  const composeCtx = newJob('compose');
  const composeDir = join(composeCtx.workDir, 'project');
  mkdirSync(composeDir, { recursive: true });
  const composeProject = structuredClone(project);
  const composeScene = composeProject.sequences[0]!.scenes[0]!;
  for (const layer of composeScene.layers) {
    if (!overlays.has(layer.id)) continue;
    if (layer.kind === 'text') { layer.kind = 'drawing'; delete layer.text; }
    // Los canales (opacidad, posición…) ya van horneados en el MOV del motor: FreeCut no debe volver a aplicarlos
    // (p. ej. el `defaultValue` 0 de la opacidad del título lo dejaría invisible).
    layer.channels = {};
  }
  const realProjectDir = realpathSync(projectDir);
  for (const layer of layers.native) {
    const asset = project.assets.find((a) => a.id === layer.assetId);
    if (!asset) continue;
    const src = resolve(realProjectDir, asset.uri);
    if (!(src === realProjectDir || src.startsWith(realProjectDir + sep))) return fail('asset-outside-project', `El asset ${asset.uri} queda fuera del proyecto.`);
    if (!isFile(src)) return fail('missing-asset', `Falta el asset ${asset.uri} de la capa ${layer.id}.`);
    const dest = resolve(composeDir, asset.uri);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
  }
  const composeProjectPath = join(composeDir, 'project.compose.fme.json');
  writeFileSync(composeProjectPath, serialize(composeProject));

  const composeAdapter = chosen.get('compose')!;
  const composeJob: JobRequest = {
    projectId: composeProject.id, operation: 'edit.compose',
    inputs: [{ uri: pathToFileURL(composeProjectPath).href, type: 'fme/project+json' }, ...[...overlays.values()].map((p) => ({ uri: pathToFileURL(p).href, type: 'video/quicktime' }))],
    requirements: { sceneId: scene.id, ...Object.fromEntries([...overlays].map(([id, p]) => [`input.${id}`, pathToFileURL(p).href])) },
  };
  const composed = await composeAdapter.run(composeJob, composeCtx);
  const cstep = record({ id: composeCtx.jobId, operation: composeJob.operation, adapterId: composeAdapter.simple.id, status: composed.status === 'ok' ? 'ok' : 'failed', diagnostics: composed.diagnostics, provenance: composed.provenance, workDir: composeCtx.workDir });
  if (composed.status !== 'ok') return fail('step-failed', `${cstep.id}: ${composed.diagnostics.map((d) => d.message).join(' | ')}`);

  const mp4 = join(outDir, 'hybrid.mp4');
  copyFileSync(toPath(composed.outputs[0]!.uri), mp4);
  const finalProv = composed.provenance[0]!;
  artifacts.push(artifactFor({
    project, id: 'render-final', uri: pathToFileURL(mp4).href, type: 'video/mp4', prov: finalProv,
    extraSegment: { overlays: Object.fromEntries([...overlays].map(([id]) => [id, artifacts.find((a) => a.id === (links.get(id) ?? ''))?.dependencyHash ?? null])) },
    extraConfig: { sceneId: scene.id },
  }));

  // 4. project.artifacts (v3) + enlace en cada capa.
  const result = structuredClone(project);
  const replaced = new Set<string>();
  for (const l of result.sequences[0]!.scenes[0]!.layers) {
    const id = links.get(l.id);
    if (!id || !l.externalProject) continue;
    if (l.externalProject.renderArtifactId) replaced.add(l.externalProject.renderArtifactId);
    const prov = steps.find((s) => s.layerId === l.id && s.operation !== 'encode.prores4444')?.provenance[0];
    l.externalProject = { ...l.externalProject, renderArtifactId: id, ...(prov ? { engineVersion: prov.engineVersion } : {}) };
  }
  result.artifacts = [...(result.artifacts ?? []).filter((a) => !replaced.has(a.id) && !artifacts.some((n) => n.id === a.id)), ...artifacts];

  // 5. Validar y guardar el proyecto resultante junto al MP4.
  const checked = parseProject(JSON.parse(serialize(result)));
  if (!checked.ok) return fail('invalid-result', checked.errors.map((e) => `${e.path}: ${e.message}`).join('; '));
  const outProject = join(outDir, 'project.fme.json');
  writeFileSync(outProject, serialize(result));

  return { status: 'ok', mp4, projectPath: outProject, project: checked.value, steps, adaptersInProvenance: adaptersOf(steps), diagnostics };
}

function adaptersOf(steps: readonly HybridStep[]): string[] {
  return [...new Set(steps.flatMap((s) => s.provenance.map((p) => p.pluginId)))];
}
