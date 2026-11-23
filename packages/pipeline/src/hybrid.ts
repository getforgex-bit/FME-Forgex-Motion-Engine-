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
import { basename, dirname, join, resolve, sep } from 'node:path';
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
import { planSceneRender } from '@fme/render-plan';
import type { LayerRenderInputs } from '@fme/render-plan';
import { planWorkflow } from '@fme/router';
import type { RouteTask } from '@fme/router';
import { PRORES_STEP_ID, PRORES_STEP_VERSION, encodeProRes, findInPath, readFfmpegVersion } from './prores.ts';
import { StepCache } from './stepcache.ts';
import type { CacheManifest, CachedFile, CachedStep } from './stepcache.ts';

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
  /** Caché incremental (por defecto `<outDir>/cache`). */
  cacheDir?: string;
  /** Presupuesto de VRAM del plan de segmentos, en MiB (por defecto 3072). */
  vramBudgetMiB?: number;
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
  /** `engine`: se ejecutó el motor en esta corrida; `cache`: viene de la caché (procedencia conservada). */
  source: 'engine' | 'cache';
  /** Clave de caché (`dependencyHash`) del segmento o de la composición. */
  cacheKey?: string;
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
  /** Pasos que ejecutaron un motor en esta corrida (0 si todo vino de la caché). */
  engineJobs: number;
  /** Pasos servidos desde la caché. */
  cachedSteps: number;
  /** Clave de caché por capa y de la composición (para comprobar qué cambió). */
  segmentKeys?: Record<string, string>;
  composeKey?: string;
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
  const counts = () => ({
    engineJobs: steps.filter((s) => s.source === 'engine').length,
    cachedSteps: steps.filter((s) => s.source === 'cache').length,
  });
  const fail = (code: string, message: string): HybridResult => {
    diagnostics.push({ code, message });
    return { status: 'failed', steps, adaptersInProvenance: adaptersOf(steps), diagnostics, ...counts() };
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
  const sequence = project.sequences[0];
  const scene = sequence?.scenes[0];
  if (!sequence || !scene) return fail('bad-project', 'El proyecto no tiene escenas.');
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

  // Disponibilidad real de los tres motores (nunca se afirma sin comprobarla) y su versión, que entra en las claves de caché.
  const engineVersions: Record<string, string> = {};
  for (const [id, a] of Object.entries(byId)) {
    const p = await a.probe();
    if (!p.available) return fail('engine-missing', `${id} no disponible: ${p.diagnostics.map((d) => d.message).join(' | ')}`);
    engineVersions[id] = p.engineVersion ?? 'unknown';
  }

  const ffmpegPath = options.ffmpegPath ?? process.env.FME_FFMPEG_PATH ?? findInPath('ffmpeg');
  if (!ffmpegPath || !isFile(ffmpegPath)) return fail('engine-missing', 'No se encuentra ffmpeg (FME_FFMPEG_PATH o PATH).');
  const ffmpegVersion = (await readFfmpegVersion(ffmpegPath, join(outDir, 'probe', 'ffmpeg'))) ?? 'unknown';

  // 2b. Plan de segmentos (@fme/render-plan): una ventana por capa, con su clave de caché (dependencyHash).
  const realProjectDir = realpathSync(projectDir);
  const dep = (id: string, extra: Record<string, JsonValue> = {}): LayerRenderInputs => ({
    adapters: [{ pluginId: id, version: byId[id]!.simple.version, engineVersion: engineVersions[id]! }],
    parameters: extra,
  });
  const layerInputs: Record<string, LayerRenderInputs> = {};
  for (const l of layers.revideo) layerInputs[l.id] = dep(REVIDEO_ID, { alpha: true });
  for (const l of layers.blender) {
    const blender = dep(BLENDER_ID, { resolution: options.blenderResolution ?? '960x540' });
    layerInputs[l.id] = {
      adapters: [...(blender.adapters ?? []), { pluginId: PRORES_STEP_ID, version: PRORES_STEP_VERSION, engineVersion: ffmpegVersion }],
      parameters: blender.parameters ?? {},
    };
  }
  for (const l of layers.native) {
    const asset = project.assets.find((a) => a.id === l.assetId);
    let content: string | null = null;
    if (asset) {
      const src = resolve(realProjectDir, asset.uri);
      if (src.startsWith(realProjectDir + sep) && isFile(src)) content = sha256File(src);
    }
    layerInputs[l.id] = { adapters: [], parameters: { assetSha256: content } };
  }
  const renderPlan = planSceneRender(project, {
    sequenceId: sequence.id, sceneId: scene.id, segmentFrames: Math.max(1, scene.durationFrames), vramBudgetMiB: options.vramBudgetMiB ?? 3072, layerInputs,
  });
  const segmentKey = new Map(renderPlan.segments.map((s) => [s.layerId, s.cacheKey]));

  const cache = new StepCache(options.cacheDir ?? join(outDir, 'cache'));
  const runId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const jobsDir = join(outDir, 'jobs', runId);
  mkdirSync(jobsDir, { recursive: true });
  let seq = 0;
  const newJob = (label: string) => {
    const name = `${String(++seq).padStart(2, '0')}-${label}`;
    const dir = join(jobsDir, name);
    mkdirSync(dir, { recursive: true });
    return { jobId: `${runId}-${name}`, workDir: realpathSync(dir), timeoutMs };
  };
  const record = (s: HybridStep): HybridStep => { steps.push(s); return s; };
  const projectInput = { uri: pathToFileURL(realProject).href, type: 'fme/project+json' };

  const artifacts: RenderArtifact[] = [];
  const links = new Map<string, string>(); // layerId -> renderArtifactId
  const overlays = new Map<string, string>(); // layerId -> ruta del MOV para FreeCut

  /** Registra los pasos de un manifiesto acertado como `source: 'cache'`. */
  const fromCache = (m: CacheManifest, key: string): void => {
    for (const s of m.steps) record({ ...s, status: 'ok', source: 'cache', cacheKey: key, workDir: join(cache.filesRoot, key) });
    artifacts.push(...m.artifacts);
  };

  // 3a. Revideo: título y 2D → MOV ProRes con alpha.
  for (const layer of layers.revideo) {
    const key = segmentKey.get(layer.id)!;
    const id = `render-${layer.id}`;
    const hit = await cache.lookup(key, 'revideo');
    if (hit) {
      fromCache(hit, key);
      overlays.set(layer.id, join(cache.filesRoot, key, 'layer.mov'));
      links.set(layer.id, id);
      continue;
    }
    const adapter = chosen.get(`render:${layer.id}`)!;
    const ctx = newJob(layer.id);
    const job: JobRequest = { projectId: project.id, operation: 'render.video', inputs: [projectInput], requirements: { layerId: layer.id, alpha: true }, seed: project.seed };
    const res = await adapter.run(job, ctx);
    const stepBase = { id: ctx.jobId, layerId: layer.id, operation: job.operation, adapterId: adapter.simple.id, status: res.status === 'ok' ? 'ok' as const : 'failed' as const, source: 'engine' as const, cacheKey: key, workDir: ctx.workDir };
    if (res.status !== 'ok') {
      record({ ...stepBase, diagnostics: res.diagnostics, provenance: res.provenance });
      return fail('step-failed', `${ctx.jobId}: ${res.diagnostics.map((d) => d.message).join(' | ')}`);
    }
    const files: CachedFile[] = [];
    const movPath = cache.adopt(key, toPath(res.provenance[0]!.uri), 'layer.mov', files);
    const prov: ArtifactProvenance = { ...res.provenance[0]!, uri: pathToFileURL(movPath).href };
    record({ ...stepBase, diagnostics: res.diagnostics, provenance: [prov] });
    const artifact = artifactFor({ project, layer, id, uri: prov.uri, type: prov.type, prov, extraSegment: { segmentKey: key } });
    artifacts.push(artifact);
    links.set(layer.id, id);
    overlays.set(layer.id, movPath);
    await cache.save({ version: 1, key, kind: 'revideo', files, artifacts: [artifact], steps: [toCachedStep(steps[steps.length - 1]!)] }).catch((e) => diagnostics.push({ code: 'cache-save-failed', message: String(e) }));
  }

  // 3b. Blender: 3D → PNG RGBA → (paso propio) ProRes 4444.
  for (const layer of layers.blender) {
    const key = segmentKey.get(layer.id)!;
    const seqId = `render-${layer.id}`;
    const hit = await cache.lookup(key, 'blender');
    if (hit) {
      fromCache(hit, key);
      overlays.set(layer.id, join(cache.filesRoot, key, 'sequence.mov'));
      links.set(layer.id, seqId);
      continue;
    }
    const adapter = chosen.get(`render:${layer.id}`)!;
    const ctx = newJob(layer.id);
    const job: JobRequest = {
      projectId: project.id, operation: 'render.image-sequence', inputs: [projectInput], seed: project.seed,
      requirements: { layerId: layer.id, resolution: options.blenderResolution ?? '960x540' },
    };
    const res = await adapter.run(job, ctx);
    const stepBase = { id: ctx.jobId, layerId: layer.id, operation: job.operation, adapterId: adapter.simple.id, status: res.status === 'ok' ? 'ok' as const : 'failed' as const, source: 'engine' as const, cacheKey: key, workDir: ctx.workDir };
    if (res.status !== 'ok' || res.provenance.length !== layer.durationFrames) {
      record({ ...stepBase, diagnostics: res.diagnostics, provenance: res.provenance });
      return fail('step-failed', `${ctx.jobId}: ${res.diagnostics.map((d) => d.message).join(' | ') || 'número de fotogramas inesperado'}`);
    }

    // Los PNG van a la caché; la procedencia por fotograma apunta a su copia definitiva.
    const files: CachedFile[] = [];
    const framesDir = dirname(toPath(res.provenance[0]!.uri));
    cache.adoptDir(key, framesDir, 'frames', files);
    const cachedFrames = join(cache.filesRoot, key, 'frames');
    const cachedProv = res.provenance.map((p) => ({ ...p, uri: pathToFileURL(join(cachedFrames, basename(toPath(p.uri)))).href }));
    record({ ...stepBase, diagnostics: res.diagnostics, provenance: cachedProv });
    const blenderStep = toCachedStep(steps[steps.length - 1]!);

    const first = cachedProv[0]!;
    const framesSha = createHash('sha256').update(cachedProv.map((p) => p.contentSha256 ?? p.sha256).join('\n')).digest('hex');
    const seqArtifact = artifactFor({
      project, layer, id: seqId, uri: pathToFileURL(join(cachedFrames, 'frame-%04d.png')).href, type: 'image/png-sequence', prov: { ...first, sha256: framesSha },
      extraSegment: { segmentKey: key }, extraConfig: { frames: cachedProv.length, framesSha256: framesSha },
    });

    const encCtx = newJob(`${layer.id}-prores`);
    const enc = await encodeProRes({ framesDir: cachedFrames, frames: layer.durationFrames, fps, width: project.width, height: project.height, workDir: encCtx.workDir, ffmpegPath, timeoutMs });
    record({ id: encCtx.jobId, layerId: layer.id, operation: 'encode.prores4444', adapterId: PRORES_STEP_ID, status: enc.ok ? 'ok' : 'failed', source: 'engine', cacheKey: key, diagnostics: enc.ok ? [] : [{ code: enc.code, message: enc.message }], provenance: enc.ok ? [enc.provenance] : [], workDir: encCtx.workDir });
    if (!enc.ok) return fail(enc.code, enc.message);
    const movPath = cache.adopt(key, enc.outputPath, 'sequence.mov', files);
    const encProv: ArtifactProvenance = { ...enc.provenance, uri: pathToFileURL(movPath).href };
    steps[steps.length - 1]!.provenance = [encProv];
    const movArtifact = artifactFor({
      project, layer, id: `${seqId}-prores`, uri: encProv.uri, type: 'video/quicktime', prov: encProv,
      extraSegment: { derivedFrom: seqId, framesSha256: framesSha, segmentKey: key }, extraConfig: { derivedFrom: seqId },
    });
    artifacts.push(seqArtifact, movArtifact);
    links.set(layer.id, seqId);
    overlays.set(layer.id, movPath);
    await cache.save({ version: 1, key, kind: 'blender', files, artifacts: [seqArtifact, movArtifact], steps: [blenderStep, toCachedStep(steps[steps.length - 1]!)] }).catch((e) => diagnostics.push({ code: 'cache-save-failed', message: String(e) }));
  }

  // 3c. FreeCut: composición final (`edit.compose`). Su clave depende de las claves de todas las capas (cualquier cambio la invalida).
  const layerKeys = [...scene.layers].sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id)).map((l) => ({ id: l.id, key: segmentKey.get(l.id)! }));
  const composeKey = dependencyHash({
    projectId: project.id,
    segment: plain({ kind: 'compose', sceneId: scene.id, durationFrames: scene.durationFrames, layers: layerKeys }),
    assets: [],
    adapters: [plain({ pluginId: FREECUT_ID, version: byId[FREECUT_ID]!.simple.version, engineVersion: engineVersions[FREECUT_ID] })],
  });
  const mp4 = join(outDir, 'hybrid.mp4');
  let finalArtifact: RenderArtifact;
  const composeHit = await cache.lookup(composeKey, 'compose');
  if (composeHit) {
    fromCache(composeHit, composeKey);
    copyFileSync(join(cache.filesRoot, composeKey, 'hybrid.mp4'), mp4);
    finalArtifact = composeHit.artifacts[0]!;
    artifacts.pop(); // se reañade abajo con la URI de esta salida
  } else {
    // Proyecto de composición derivado: las capas renderizadas pasan a `drawing`/`model3d` (sin `text`) para recibir su MOV por id.
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
    const cstep = record({ id: composeCtx.jobId, operation: composeJob.operation, adapterId: composeAdapter.simple.id, status: composed.status === 'ok' ? 'ok' : 'failed', source: 'engine', cacheKey: composeKey, diagnostics: composed.diagnostics, provenance: composed.provenance, workDir: composeCtx.workDir });
    if (composed.status !== 'ok') return fail('step-failed', `${cstep.id}: ${composed.diagnostics.map((d) => d.message).join(' | ')}`);

    const files: CachedFile[] = [];
    const cachedMp4 = cache.adopt(composeKey, toPath(composed.outputs[0]!.uri), 'hybrid.mp4', files);
    copyFileSync(cachedMp4, mp4);
    const finalProv: ArtifactProvenance = { ...composed.provenance[0]!, uri: pathToFileURL(cachedMp4).href };
    cstep.provenance = [finalProv];
    finalArtifact = artifactFor({
      project, id: 'render-final', uri: finalProv.uri, type: 'video/mp4', prov: finalProv,
      extraSegment: { composeKey }, extraConfig: { sceneId: scene.id },
    });
    await cache.save({ version: 1, key: composeKey, kind: 'compose', files, artifacts: [finalArtifact], steps: [toCachedStep(cstep)] }).catch((e) => diagnostics.push({ code: 'cache-save-failed', message: String(e) }));
  }
  artifacts.push(finalArtifact);

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

  return { status: 'ok', mp4, projectPath: outProject, project: checked.value, steps, adaptersInProvenance: adaptersOf(steps), diagnostics, ...counts(), segmentKeys: Object.fromEntries(segmentKey), composeKey };
}

function toCachedStep(s: HybridStep): CachedStep {
  return { id: s.id, ...(s.layerId !== undefined ? { layerId: s.layerId } : {}), operation: s.operation, adapterId: s.adapterId, diagnostics: s.diagnostics, provenance: s.provenance };
}

function adaptersOf(steps: readonly HybridStep[]): string[] {
  return [...new Set(steps.flatMap((s) => s.provenance.map((p) => p.pluginId)))];
}

/**
 * «Reabrir la fuente externa» (FDN-075a): resuelve el `ExternalProjectRef` de una capa hacia su documento nativo y el
 * artefacto derivado. Hoy el documento nativo de Revideo/Blender es la propia capa del proyecto FME más su `uri`
 * (p. ej. `adapters/revideo/titulo.tsx`); si el archivo no existe, `exists` es false y se dice sin inventar nada.
 */
export function reopenExternalSource(project: Project, layerId: string, baseDir: string): {
  pluginId: string; uri: string; path: string; exists: boolean; engineVersion?: string; artifact?: RenderArtifact;
} | undefined {
  for (const seq of project.sequences) for (const sc of seq.scenes) for (const l of sc.layers) {
    if (l.id !== layerId || !l.externalProject) continue;
    const ref = l.externalProject;
    const path = resolve(baseDir, ref.uri);
    const artifact = ref.renderArtifactId ? project.artifacts?.find((a) => a.id === ref.renderArtifactId) : undefined;
    return { pluginId: ref.pluginId, uri: ref.uri, path, exists: path.startsWith(resolve(baseDir) + sep) && isFile(path), ...(ref.engineVersion ? { engineVersion: ref.engineVersion } : {}), ...(artifact ? { artifact } : {}) };
  }
  return undefined;
}
