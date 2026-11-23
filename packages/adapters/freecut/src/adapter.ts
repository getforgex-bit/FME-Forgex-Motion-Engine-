/**
 * Adaptador FreeCut nivel A (FDN-041 / FDN-042a, ADR-0011).
 *
 * Soporta `edit.export` (FDN-041) y `edit.compose` (FDN-042a: pistas ordenadas por `zIndex`
 * con overlays compatibles e inspección previa de alpha mediante `ffprobe`).
 */
import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { delimiter, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deserialize } from '@fme/project';
import { runIsolated } from '@fme/runtime-workers';
import type {
  AdapterJobResult,
  ArtifactProvenance,
  ConnectorAdapter,
  JobContext,
  JobRequest,
  ProbeResult,
} from '@fme/connectors';
import { advanced, ADAPTER_VERSION, simple } from './cards.ts';
import {
  MappingError,
  buildFreeCutComposeJob,
  buildFreeCutJob,
} from './mapping.ts';
import type {
  ComposeInputArtifact,
  FreeCutEngineJob,
} from './mapping.ts';

export type FreeCutBrowserMode = 'auto' | 'msedge' | 'chrome' | 'playwright';

export type FreeCutAdapterOptions = {
  /** Carpeta del wrapper (`runtime/engines/freecut`). */
  engineDir?: string;
  /** Ruta del clon upstream de FreeCut (por defecto `FME_FREECUT_DIR` o `C:\Users\bogex\Documents\Forgex\FME-ext\freecut`). */
  freecutDir?: string;
  /** Navegador Chromium para Playwright (`auto` | `msedge` | `chrome` | `playwright`). */
  browser?: FreeCutBrowserMode;
  /** Ruta absoluta de ffmpeg; por defecto `FME_FFMPEG_PATH` o PATH. */
  ffmpegPath?: string;
  /** Ruta absoluta de ffprobe; por defecto `FME_FFPROBE_PATH`, hermano de ffmpeg o PATH. */
  ffprobePath?: string;
  /** Ruta de node; por defecto `process.execPath`. */
  nodePath?: string;
  /** Carpeta para los logs de `probe()`. */
  probeWorkDir?: string;
};

type Diag = { code: string; message: string };
type Tools = {
  cli: string;
  freecutDir: string;
  node: string;
  ffmpeg?: string;
  ffprobe?: string;
  browser: FreeCutBrowserMode;
  diagnostics: Diag[];
};

const DEFAULT_ENGINE_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../runtime/engines/freecut',
);
const DEFAULT_FREECUT_DIR = 'C:\\Users\\bogex\\Documents\\Forgex\\FME-ext\\freecut';
const SHA256_RE = /^[0-9a-f]{64}$/;

function isFile(p: string | undefined): p is string {
  if (!p || !isAbsolute(p)) return false;
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

function isDir(p: string | undefined): p is string {
  if (!p || !isAbsolute(p)) return false;
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
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

function sha256File(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function toPath(uri: string): string {
  return uri.startsWith('file:') ? fileURLToPath(uri) : uri;
}

function tail(filePath: string, max = 600): string {
  try {
    const text = readFileSync(filePath, 'utf8').trim();
    return text.length > max ? '…' + text.slice(-max) : text;
  } catch {
    return '';
  }
}

function hasBrowser(mode: FreeCutBrowserMode): boolean {
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    join(process.env.LOCALAPPDATA ?? '', 'Google\\Chrome\\Application\\chrome.exe'),
  ];
  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  const findPlaywright = (): boolean => {
    const root = join(process.env.LOCALAPPDATA ?? '', 'ms-playwright');
    if (!isDir(root)) return false;
    try {
      return readdirSync(root).some(
        (entry) =>
          entry.startsWith('chromium-') &&
          isFile(join(root, entry, 'chrome-win64', 'chrome.exe')),
      );
    } catch {
      return false;
    }
  };

  if (mode === 'chrome') return chromePaths.some((p) => isFile(p));
  if (mode === 'msedge') return edgePaths.some((p) => isFile(p));
  if (mode === 'playwright') return findPlaywright();
  return chromePaths.some((p) => isFile(p)) || edgePaths.some((p) => isFile(p)) || findPlaywright();
}

function buildEnv(extra: Record<string, string | undefined>): Record<string, string> {
  const keys = [
    'SystemRoot',
    'windir',
    'TEMP',
    'TMP',
    'TMPDIR',
    'LOCALAPPDATA',
    'APPDATA',
    'USERPROFILE',
    'HOMEDRIVE',
    'HOMEPATH',
    'ProgramData',
    'ProgramFiles',
    'ProgramFiles(x86)',
    'PATH',
    'HOME',
  ];
  const env: Record<string, string> = {};
  for (const key of keys) {
    const val = process.env[key];
    if (val !== undefined) env[key] = val;
  }
  env.DISABLE_TELEMETRY = 'true';
  for (const [key, val] of Object.entries(extra)) {
    if (val !== undefined) env[key] = val;
  }
  return env;
}

async function computeDecodedVideoSha256(
  ffmpegBin: string,
  videoPath: string,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolveHash, rejectHash) => {
    execFile(
      ffmpegBin,
      [
        '-v',
        'error',
        '-i',
        videoPath,
        '-map',
        '0:v:0',
        '-c:v',
        'rawvideo',
        '-pix_fmt',
        'yuv420p',
        '-f',
        'hash',
        '-hash',
        'sha256',
        '-',
      ],
      {
        shell: false,
        windowsHide: true,
        timeout: Math.max(10_000, timeoutMs),
        maxBuffer: 4 * 1024 * 1024,
      },
      (err, stdout, stderr) => {
        if (err) {
          rejectHash(
            new Error(
              `No se pudo calcular contentSha256 con ffmpeg: ${stderr.trim() || err.message}`,
            ),
          );
          return;
        }
        const match = /^SHA256=([0-9a-f]{64})$/m.exec(stdout.trim());
        if (!match?.[1] || !SHA256_RE.test(match[1])) {
          rejectHash(
            new Error(`Salida inesperada de ffmpeg hash para contentSha256: ${stdout.trim()}`),
          );
          return;
        }
        resolveHash(match[1]);
      },
    );
  });
}

type StreamInspectInfo = {
  codecName?: string;
  pixFmt?: string;
  hasAlpha: boolean;
};

const alphaPixFmtsCache = new Map<string, Set<string>>();

async function getAlphaPixFmts(ffprobeBin: string): Promise<Set<string>> {
  const cached = alphaPixFmtsCache.get(ffprobeBin);
  if (cached !== undefined) return cached;

  const stdout = await new Promise<string>((ok, fail) => {
    execFile(
      ffprobeBin,
      ['-v', 'error', '-show_pixel_formats', '-print_format', 'json'],
      { shell: false, windowsHide: true, timeout: 15_000, maxBuffer: 4 * 1024 * 1024 },
      (err, out, stderr) => {
        if (err) fail(new Error(stderr.trim() || err.message));
        else ok(out);
      },
    );
  });
  const list = (JSON.parse(stdout) as { pixel_formats?: Array<{ name?: string; flags?: { alpha?: number } }> })
    .pixel_formats ?? [];
  const alphaSet = new Set(
    list
      .filter((item) => item.flags?.alpha === 1 && typeof item.name === 'string')
      .map((item) => item.name as string),
  );
  alphaPixFmtsCache.set(ffprobeBin, alphaSet);
  return alphaSet;
}

async function inspectMediaStream(
  ffprobeBin: string,
  mediaPath: string,
): Promise<StreamInspectInfo | null> {
  try {
    const stdout = await new Promise<string>((ok, fail) => {
      execFile(
        ffprobeBin,
        ['-v', 'error', '-print_format', 'json', '-show_streams', mediaPath],
        { shell: false, windowsHide: true, timeout: 15_000, maxBuffer: 4 * 1024 * 1024 },
        (err, out, stderr) => {
          if (err) fail(new Error(stderr.trim() || err.message));
          else ok(out);
        },
      );
    });
    const streams = (JSON.parse(stdout) as { streams?: Array<{ codec_type?: string; codec_name?: string; pix_fmt?: string }> }).streams ?? [];
    const video = streams.find((s) => s.codec_type === 'video');
    if (!video) return { hasAlpha: false };
    const alphaFmts = await getAlphaPixFmts(ffprobeBin);
    const pixFmt = video.pix_fmt;
    const hasAlpha = typeof pixFmt === 'string' && alphaFmts.has(pixFmt);
    return {
      ...(video.codec_name !== undefined ? { codecName: video.codec_name.toLowerCase() } : {}),
      ...(pixFmt !== undefined ? { pixFmt } : {}),
      hasAlpha,
    };
  } catch {
    return null;
  }
}

function isSupportedAlphaStream(mimeType: string | undefined, info: StreamInspectInfo): boolean {
  if (!info.hasAlpha) return true;
  const codec = info.codecName ?? '';
  if (mimeType === 'image/png' || codec === 'png') return true;
  if (mimeType === 'video/webm' && (codec === 'vp9' || codec === 'vp8')) return true;
  if (mimeType === 'video/quicktime' && codec === 'prores') return true;
  return false;
}

function parseLayerInputMap(
  requirements: JobRequest['requirements'],
): Record<string, string> {
  const map: Record<string, string> = {};
  const rawJson = requirements.layerInputs;
  if (typeof rawJson === 'string' && rawJson.trim().length > 0) {
    try {
      const parsed = JSON.parse(rawJson) as unknown;
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string' && v.trim().length > 0) {
            map[k] = v;
          }
        }
      }
    } catch {
      throw new MappingError(
        'bad-requirements',
        'requirements.layerInputs debe ser un JSON objeto { layerId: uri }.',
      );
    }
  }
  for (const [key, value] of Object.entries(requirements)) {
    if (key.startsWith('input.') && typeof value === 'string' && value.trim().length > 0) {
      map[key.slice('input.'.length)] = value;
    }
  }
  return map;
}

export class FreeCutAdapter implements ConnectorAdapter {
  readonly simple = simple;
  readonly advanced = advanced;
  private readonly engineDir: string;
  private readonly freecutDir: string;
  private readonly browser: FreeCutBrowserMode;
  private readonly opts: FreeCutAdapterOptions;
  private engineVersionCache: string | undefined;

  constructor(opts: FreeCutAdapterOptions = {}) {
    this.opts = opts;
    this.engineDir = resolve(opts.engineDir ?? DEFAULT_ENGINE_DIR);
    this.freecutDir = resolve(
      opts.freecutDir ?? process.env.FME_FREECUT_DIR ?? DEFAULT_FREECUT_DIR,
    );
    this.browser =
      opts.browser ?? (process.env.FME_FREECUT_BROWSER as FreeCutBrowserMode | undefined) ?? 'auto';
  }

  private resolveTools(): Tools {
    const diagnostics: Diag[] = [];
    const node = this.opts.nodePath ?? process.execPath;
    const cli = join(this.engineDir, 'cli.mjs');
    if (!isFile(cli)) {
      diagnostics.push({
        code: 'engine-missing',
        message: `Falta el wrapper CLI de FreeCut en ${cli}.`,
      });
    }

    const freecutDir = this.freecutDir;
    if (
      !isDir(freecutDir) ||
      !isFile(join(freecutDir, 'dist', 'headless.html')) ||
      !isDir(join(freecutDir, 'headless', 'lib')) ||
      !existsSync(join(freecutDir, 'node_modules', 'playwright'))
    ) {
      diagnostics.push({
        code: 'engine-missing',
        message: `FreeCut no está instalado/compilado en ${freecutDir} (falta dist/headless.html o node_modules/playwright).`,
      });
    }

    if (!hasBrowser(this.browser)) {
      diagnostics.push({
        code: 'engine-missing',
        message: `No se encontró un navegador Chromium compatible (modo "${this.browser}").`,
      });
    }

    const ffmpeg = this.opts.ffmpegPath ?? process.env.FME_FFMPEG_PATH ?? findInPath('ffmpeg');
    if (!isFile(ffmpeg)) {
      diagnostics.push({
        code: 'engine-missing',
        message: 'No se encuentra ffmpeg (define FME_FFMPEG_PATH o añádelo al PATH).',
      });
    }

    let ffprobe = this.opts.ffprobePath ?? process.env.FME_FFPROBE_PATH;
    if (!ffprobe && isFile(ffmpeg)) {
      const sibling = join(
        dirname(ffmpeg),
        process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe',
      );
      ffprobe = isFile(sibling) ? sibling : findInPath('ffprobe');
    }
    if (!isFile(ffprobe)) {
      diagnostics.push({
        code: 'engine-missing',
        message: 'No se encuentra ffprobe (define FME_FFPROBE_PATH o añádelo al PATH).',
      });
    }

    const tools: Tools = {
      cli,
      freecutDir,
      node,
      browser: this.browser,
      diagnostics,
    };
    if (isFile(ffmpeg)) tools.ffmpeg = ffmpeg;
    if (isFile(ffprobe)) tools.ffprobe = ffprobe;
    return tools;
  }

  async probe(): Promise<ProbeResult> {
    const tools = this.resolveTools();
    if (tools.diagnostics.length > 0) {
      return { available: false, diagnostics: tools.diagnostics };
    }

    const probeDir =
      this.opts.probeWorkDir ??
      join(process.env.TEMP ?? process.env.TMPDIR ?? '/tmp', 'fme-probe-freecut');
    mkdirSync(probeDir, { recursive: true });
    const realProbeDir = realpathSync(probeDir);
    const realNode = realpathSync(tools.node);
    const realCli = realpathSync(tools.cli);
    const realFreecutDir = realpathSync(tools.freecutDir);

    const run = await runIsolated({
      cmd: realNode,
      args: [{ path: realCli }, '--version', '--freecut-dir', { path: realFreecutDir }],
      workDir: realProbeDir,
      allowedPaths: [realNode, realCli, realFreecutDir, realProbeDir],
      timeoutMs: 30_000,
      env: buildEnv({ FME_FREECUT_DIR: realFreecutDir }),
    });

    const version =
      run.exitCode === 0 ? tail(run.stdoutPath, 120).split(/\r?\n/).pop()?.trim() : undefined;
    if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
      return {
        available: false,
        diagnostics: [
          {
            code: 'engine-broken',
            message: `El motor FreeCut no respondió a --version (código ${String(run.exitCode)}): ${tail(run.stderrPath)}`,
          },
        ],
      };
    }

    this.engineVersionCache = version;
    return { available: true, engineVersion: version, diagnostics: [] };
  }

  async run(job: JobRequest, ctx: JobContext): Promise<AdapterJobResult> {
    const startedAt = new Date();
    const fail = (code: string, message: string): AdapterJobResult => ({
      jobId: ctx.jobId,
      status: 'failed',
      outputs: [],
      provenance: [],
      diagnostics: [{ code, message }],
    });

    const isCompose = job.operation === 'edit.compose';
    if (job.operation !== 'edit.export' && !isCompose) {
      return fail('unsupported-operation', `Operación no soportada por FreeCut: ${job.operation}`);
    }

    const input = job.inputs[0];
    if (!input || input.type !== 'fme/project+json') {
      return fail('bad-input', 'inputs[0] debe tener type "fme/project+json".');
    }

    const sceneId = job.requirements.sceneId;
    if (typeof sceneId !== 'string' || !sceneId) {
      return fail('bad-requirements', 'requirements.sceneId (string) es obligatorio.');
    }

    let projectPath: string;
    try {
      projectPath = realpathSync(toPath(input.uri));
    } catch {
      return fail('bad-input', `No se puede leer el proyecto: ${input.uri}`);
    }

    const parsed = deserialize(readFileSync(projectPath, 'utf8'));
    if (!parsed.ok) {
      return fail(
        'invalid-project',
        parsed.errors.map((e) => `${e.path}: ${e.message}`).join('; '),
      );
    }

    // En `edit.compose`, comprobamos primero la compatibilidad de inputs/alpha antes de exigir browser/motor
    // para que un input con alpha no soportado (p. ej. image/png-sequence) falle siempre con `unsupported-alpha`.
    let engineJob: FreeCutEngineJob;
    try {
      if (isCompose) {
        const layerInputMap = parseLayerInputMap(job.requirements);
        const composeInputs: ComposeInputArtifact[] = job.inputs
          .slice(1)
          .map((item) => ({ uri: item.uri, type: item.type }));
        engineJob = buildFreeCutComposeJob(parsed.value, {
          sceneId,
          projectDir: dirname(projectPath),
          inputs: composeInputs,
          layerInputMap,
        });
      } else {
        engineJob = buildFreeCutJob(parsed.value, {
          sceneId,
          projectDir: dirname(projectPath),
        });
      }
    } catch (err) {
      if (err instanceof MappingError) return fail(err.code, err.message);
      return fail('bad-input', err instanceof Error ? err.message : String(err));
    }

    const tools = this.resolveTools();
    if (tools.diagnostics.length > 0 || !tools.ffmpeg || !tools.ffprobe) {
      return {
        jobId: ctx.jobId,
        status: 'failed',
        outputs: [],
        provenance: [],
        diagnostics: tools.diagnostics,
      };
    }

    if (isCompose) {
      for (const layer of engineJob.layers) {
        if (layer.kind !== 'video' && layer.kind !== 'image') continue;
        const streamInfo = await inspectMediaStream(tools.ffprobe, layer.mediaPath);
        if (streamInfo !== null && !isSupportedAlphaStream(layer.mimeType, streamInfo)) {
          return fail(
            'unsupported-alpha',
            `La entrada de la capa «${layer.id}» (${layer.mediaPath}) tiene canal alpha (${streamInfo.codecName ?? 'desconocido'} / ${streamInfo.pixFmt ?? '?'}) no soportado nativamente por FreeCut. ` +
              'Alternativa: convertir a MOV ProRes 4444 (yuva444p12le), WebM VP9 (yuva420p) o PNG RGBA, o precomponer con FFmpeg overlay.',
          );
        }
      }
    }

    mkdirSync(ctx.workDir, { recursive: true });
    const workDir = realpathSync(ctx.workDir);
    const jobJsonPath = join(workDir, `${ctx.jobId}.job.json`);
    const outPath = join(workDir, `${ctx.jobId}.mp4`);
    const tmpDir = join(workDir, `${ctx.jobId}.tmp`);
    const engineWorkDir = join(workDir, `${ctx.jobId}.engine`);
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(engineWorkDir, { recursive: true });
    writeFileSync(jobJsonPath, JSON.stringify(engineJob, null, 2), { flag: 'wx' });

    const realNode = realpathSync(tools.node);
    const realCli = realpathSync(tools.cli);
    const realFreecutDir = realpathSync(tools.freecutDir);
    const mediaPaths = new Set<string>();
    for (const layer of engineJob.layers) {
      if (layer.kind !== 'text') {
        mediaPaths.add(realpathSync(layer.mediaPath));
      }
    }

    const run = await runIsolated({
      cmd: realNode,
      args: [
        { path: realCli },
        '--job',
        { path: jobJsonPath },
        '--out',
        { path: outPath },
        '--work-dir',
        { path: engineWorkDir },
        '--freecut-dir',
        { path: realFreecutDir },
        '--browser',
        tools.browser,
      ],
      workDir,
      allowedPaths: [realNode, realCli, realFreecutDir, workDir, ...mediaPaths],
      timeoutMs: ctx.timeoutMs,
      env: buildEnv({
        TEMP: tmpDir,
        TMP: tmpDir,
        TMPDIR: tmpDir,
        FME_FREECUT_DIR: realFreecutDir,
        FME_FREECUT_BROWSER: tools.browser,
      }),
    });

    if (run.killed || run.exitCode === null) {
      return fail('timeout', `El render de FreeCut superó ${ctx.timeoutMs} ms y se terminó el proceso.`);
    }

    if (run.exitCode !== 0) {
      const errText = tail(run.stderrPath);
      let code = 'render-failed';
      try {
        const last = errText.split(/\r?\n/).filter((l) => l.startsWith('{')).pop() ?? '';
        const parsedErr = JSON.parse(last) as { code?: unknown };
        if (typeof parsedErr.code === 'string') code = parsedErr.code;
      } catch {
        // stderr no es JSON
      }
      return fail(code, `FreeCut terminó con código ${run.exitCode}: ${errText}`);
    }

    if (!isFile(outPath) || statSync(outPath).size === 0) {
      return fail('no-output', 'FreeCut terminó bien pero no produjo el archivo MP4 esperado.');
    }

    let contentSha256: string;
    try {
      contentSha256 = await computeDecodedVideoSha256(tools.ffmpeg, outPath, ctx.timeoutMs);
    } catch (err) {
      return fail(
        'content-hash-failed',
        err instanceof Error ? err.message : String(err),
      );
    }

    const engineVersion = this.engineVersionCache ?? (await this.probe()).engineVersion;
    if (!engineVersion) {
      return fail('engine-broken', 'No se pudo obtener engineVersion de FreeCut.');
    }

    const uri = pathToFileURL(outPath).href;
    const type = 'video/mp4';
    const provenance: ArtifactProvenance = {
      uri,
      type,
      sha256: sha256File(outPath),
      contentSha256,
      pluginId: simple.id,
      pluginVersion: ADAPTER_VERSION,
      engineVersion,
      params: {
        operation: job.operation,
        sceneId: engineJob.sceneId,
        width: engineJob.width,
        height: engineJob.height,
        fps: engineJob.fps,
        frames: engineJob.durationFrames,
        layerCount: engineJob.layers.length,
      },
      ...(job.seed !== undefined ? { seed: job.seed } : {}),
      startedAt: startedAt.toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
    };

    return {
      jobId: ctx.jobId,
      status: 'ok',
      outputs: [{ uri, type }],
      provenance: [provenance],
      diagnostics: [],
    };
  }
}

export function newJobId(): string {
  return randomUUID();
}
