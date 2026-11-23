/**
 * Adaptador Revideo (FDN-032, ADR-0011). Renderiza UNA capa `text` o `svg` de un proyecto FME a MP4 o a MOV ProRes 4444 (alpha).
 * Ejecuta el motor (`runtime/engines/revideo/cli.mjs`) con `runIsolated`: sin shell, rutas validadas, timeout y escritura solo en `ctx.workDir`.
 */
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { delimiter, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deserialize } from '@fme/project';
import { runIsolated } from '@fme/runtime-workers';
import type { AdapterJobResult, ArtifactProvenance, ConnectorAdapter, JobContext, JobRequest, ProbeResult } from '@fme/connectors';
import { advanced, ADAPTER_VERSION, simple } from './cards.ts';
import { MappingError, buildEngineJob, findLayer } from './mapping.ts';
import type { EngineJob } from './mapping.ts';

export type RevideoAdapterOptions = {
  /** Carpeta del motor (por defecto `runtime/engines/revideo` del repo). */
  engineDir?: string;
  /** Ruta absoluta de ffmpeg; por defecto `FME_FFMPEG_PATH` o el PATH. */
  ffmpegPath?: string;
  /** Ruta absoluta de ffprobe; por defecto `FME_FFPROBE_PATH`, el directorio de ffmpeg o el PATH. */
  ffprobePath?: string;
  /** Caché de Chrome de Puppeteer; por defecto `FME_PUPPETEER_CACHE_DIR` o la de Puppeteer. */
  puppeteerCacheDir?: string;
  /** Ruta de node; por defecto el que ejecuta el adaptador. */
  nodePath?: string;
};

type Diag = { code: string; message: string };
type Tools = { ffmpeg?: string; ffprobe?: string; node: string; cli: string; diagnostics: Diag[] };

const defaultEngineDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../runtime/engines/revideo');

function isFile(p: string | undefined): p is string {
  if (!p || !isAbsolute(p)) return false;
  try { return statSync(p).isFile(); } catch { return false; }
}

function findInPath(name: string): string | undefined {
  const ext = process.platform === 'win32' ? '.exe' : '';
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (!dir) continue;
    const candidate = join(dir, name + ext);
    if (isFile(candidate)) return candidate;
  }
  return undefined;
}

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function toPath(uri: string): string {
  return uri.startsWith('file:') ? fileURLToPath(uri) : uri;
}

function tail(path: string, max = 600): string {
  try {
    const text = readFileSync(path, 'utf8').trim();
    return text.length > max ? '…' + text.slice(-max) : text;
  } catch { return ''; }
}

/** Entorno explícito mínimo para node + Chrome + ffmpeg (runIsolated no hereda el del proceso). */
function buildEnv(extra: Record<string, string | undefined>): Record<string, string> {
  const keys = ['SystemRoot', 'windir', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'ProgramData', 'PATH', 'HOME'];
  const env: Record<string, string> = {};
  for (const k of keys) { const v = process.env[k]; if (v !== undefined) env[k] = v; }
  env.DISABLE_TELEMETRY = 'true';
  for (const [k, v] of Object.entries(extra)) if (v !== undefined) env[k] = v;
  return env;
}

export class RevideoAdapter implements ConnectorAdapter {
  readonly simple = simple;
  readonly advanced = advanced;
  private readonly engineDir: string;
  private readonly opts: RevideoAdapterOptions;
  private engineVersionCache: string | undefined;

  constructor(opts: RevideoAdapterOptions = {}) {
    this.opts = opts;
    this.engineDir = resolve(opts.engineDir ?? defaultEngineDir);
  }

  private resolveTools(): Tools {
    const diagnostics: Diag[] = [];
    const node = this.opts.nodePath ?? process.execPath;
    const cli = join(this.engineDir, 'cli.mjs');
    if (!isFile(cli) || !existsSync(join(this.engineDir, 'node_modules', '@revideo', 'renderer'))) {
      diagnostics.push({ code: 'engine-missing', message: `El motor no está instalado en ${this.engineDir}: ejecuta «npm ci» en esa carpeta.` });
    }
    const ffmpeg = this.opts.ffmpegPath ?? process.env.FME_FFMPEG_PATH ?? findInPath('ffmpeg');
    if (!isFile(ffmpeg)) diagnostics.push({ code: 'engine-missing', message: 'No se encuentra ffmpeg (define FME_FFMPEG_PATH o añádelo al PATH; ADR-0010).' });
    let ffprobe = this.opts.ffprobePath ?? process.env.FME_FFPROBE_PATH;
    if (!ffprobe && isFile(ffmpeg)) {
      const sibling = join(dirname(ffmpeg), process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
      ffprobe = isFile(sibling) ? sibling : findInPath('ffprobe');
    }
    if (!isFile(ffprobe)) diagnostics.push({ code: 'engine-missing', message: 'No se encuentra ffprobe (define FME_FFPROBE_PATH o añádelo al PATH).' });
    const tools: Tools = { node, cli, diagnostics };
    if (isFile(ffmpeg)) tools.ffmpeg = ffmpeg;
    if (isFile(ffprobe)) tools.ffprobe = ffprobe;
    return tools;
  }

  async probe(): Promise<ProbeResult> {
    const tools = this.resolveTools();
    if (tools.diagnostics.length > 0) return { available: false, diagnostics: tools.diagnostics };
    const tmp = join(process.env.TEMP ?? process.env.TMPDIR ?? '/tmp', 'fme-probe-revideo');
    mkdirSync(tmp, { recursive: true });
    const r = await runIsolated({
      cmd: tools.node, args: [{ path: tools.cli }, '--version'], workDir: realpathSync(tmp),
      allowedPaths: [tools.node, tools.cli, realpathSync(tmp)], timeoutMs: 30_000, env: buildEnv({}),
    });
    const version = r.exitCode === 0 ? tail(r.stdoutPath, 100).split(/\r?\n/).pop()?.trim() : undefined;
    if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
      return { available: false, diagnostics: [{ code: 'engine-broken', message: `El motor no respondió a --version (código ${String(r.exitCode)}): ${tail(r.stderrPath)}` }] };
    }
    this.engineVersionCache = version;
    return { available: true, engineVersion: version, diagnostics: [] };
  }

  async run(job: JobRequest, ctx: JobContext): Promise<AdapterJobResult> {
    const startedAt = new Date();
    const fail = (code: string, message: string): AdapterJobResult => ({ jobId: ctx.jobId, status: 'failed', outputs: [], provenance: [], diagnostics: [{ code, message }] });

    if (job.operation !== 'render.video') return fail('unsupported-operation', `Operación no soportada: ${job.operation}`);
    const input = job.inputs[0];
    if (!input || input.type !== 'fme/project+json') return fail('bad-input', 'inputs[0] debe ser un fme/project+json');
    const layerId = job.requirements.layerId;
    if (typeof layerId !== 'string' || !layerId) return fail('bad-requirements', 'requirements.layerId (string) es obligatorio');
    const alpha = job.requirements.alpha === true;

    const tools = this.resolveTools();
    if (tools.diagnostics.length > 0 || !tools.ffmpeg || !tools.ffprobe) {
      return { jobId: ctx.jobId, status: 'failed', outputs: [], provenance: [], diagnostics: tools.diagnostics };
    }

    let projectPath: string;
    try { projectPath = realpathSync(toPath(input.uri)); } catch { return fail('bad-input', `No se puede leer el proyecto: ${input.uri}`); }
    const parsed = deserialize(readFileSync(projectPath, 'utf8'));
    if (!parsed.ok) return fail('invalid-project', parsed.errors.map((e) => `${e.path}: ${e.message}`).join('; '));
    const project = parsed.value;

    let engineJob: EngineJob;
    try {
      const layer = findLayer(project, layerId);
      let svgMarkup: string | undefined;
      if (layer.kind === 'svg' || layer.kind === 'drawing') {
        const asset = project.assets.find((a) => a.id === layer.assetId);
        if (!asset) throw new MappingError('missing-asset', `La capa «${layerId}» no referencia un asset existente`);
        const base = dirname(projectPath);
        const svgPath = realpathSync(resolve(base, asset.uri));
        if (!svgPath.startsWith(base + sep)) throw new MappingError('asset-outside-project', `El asset ${asset.uri} queda fuera de la carpeta del proyecto`);
        if (statSync(svgPath).size > 2_000_000) throw new MappingError('asset-too-large', 'El SVG supera 2 MB');
        svgMarkup = readFileSync(svgPath, 'utf8');
      }
      const { text, fontSize, fill } = job.requirements;
      engineJob = buildEngineJob(project, layer, {
        ...(svgMarkup !== undefined ? { svgMarkup } : {}),
        ...(typeof text === 'string' ? { text } : {}),
        ...(typeof fontSize === 'number' ? { fontSize } : {}),
        ...(typeof fill === 'string' ? { fill } : {}),
      });
    } catch (e) {
      if (e instanceof MappingError) return fail(e.code, e.message);
      return fail('bad-input', e instanceof Error ? e.message : String(e));
    }

    mkdirSync(ctx.workDir, { recursive: true });
    const workDir = realpathSync(ctx.workDir);
    const scenePath = join(workDir, `${ctx.jobId}.scene.json`);
    const outPath = join(workDir, `${ctx.jobId}.${alpha ? 'mov' : 'mp4'}`);
    writeFileSync(scenePath, JSON.stringify(engineJob), { flag: 'wx' });
    // FDN-034 (ADR-0011 punto 3): los temporales de Revideo, Vite y Chrome van a `workDir`, no al temporal del sistema.
    const tmpDir = join(workDir, `${ctx.jobId}.tmp`);
    mkdirSync(tmpDir);

    const run = await runIsolated({
      cmd: tools.node,
      args: [{ path: tools.cli }, '--scene', { path: scenePath }, '--out', { path: outPath }, ...(alpha ? ['--alpha'] : []),
        '--ffmpeg', { path: tools.ffmpeg }, '--ffprobe', { path: tools.ffprobe }],
      workDir,
      allowedPaths: [tools.node, tools.cli, tools.ffmpeg, tools.ffprobe, workDir],
      timeoutMs: ctx.timeoutMs,
      env: buildEnv({ TEMP: tmpDir, TMP: tmpDir, TMPDIR: tmpDir, FME_VITE_CACHE_DIR: join(tmpDir, 'vite-cache'), PUPPETEER_CACHE_DIR: this.opts.puppeteerCacheDir ?? process.env.FME_PUPPETEER_CACHE_DIR, FFMPEG_PATH: tools.ffmpeg, FFPROBE_PATH: tools.ffprobe }),
    });

    if (run.killed || run.exitCode === null) return fail('timeout', `El render superó ${ctx.timeoutMs} ms y se terminó el proceso.`);
    if (run.exitCode !== 0) {
      const err = tail(run.stderrPath);
      let code = 'render-failed';
      try {
        const last = err.split(/\r?\n/).filter((l) => l.startsWith('{')).pop() ?? '';
        const j = JSON.parse(last) as { code?: unknown };
        if (typeof j.code === 'string') code = j.code;
      } catch { /* stderr no es JSON */ }
      return fail(code, `El motor terminó con código ${run.exitCode}: ${err}`);
    }
    if (!isFile(outPath) || statSync(outPath).size === 0) return fail('no-output', 'El motor terminó bien pero no produjo el archivo de salida (o está vacío).');

    const engineVersion = this.engineVersionCache ?? (await this.probe()).engineVersion;
    if (!engineVersion) return fail('engine-broken', 'No se pudo leer la versión del motor.');
    const type = alpha ? 'video/quicktime' : 'video/mp4';
    const uri = pathToFileURL(outPath).href;
    const provenance: ArtifactProvenance = {
      uri, type, sha256: sha256File(outPath), pluginId: simple.id, pluginVersion: ADAPTER_VERSION, engineVersion,
      params: { layerId, alpha, frames: engineJob.frames, fps: engineJob.fps, width: engineJob.width, height: engineJob.height, kind: engineJob.kind },
      ...(job.seed !== undefined ? { seed: job.seed } : {}),
      startedAt: startedAt.toISOString(), durationMs: Date.now() - startedAt.getTime(),
    };
    return { jobId: ctx.jobId, status: 'ok', outputs: [{ uri, type }], provenance: [provenance], diagnostics: [] };
  }
}

export function newJobId(): string { return randomUUID(); }
