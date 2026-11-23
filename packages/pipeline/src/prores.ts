/**
 * Paso propio del pipeline (FDN-042c): precodificar una secuencia PNG RGBA a MOV ProRes 4444 con FFmpeg.
 *
 * Motivo (hallazgo de FDN-042a): FreeCut acepta MOV ProRes 4444 con alpha, pero no `image/png-sequence`.
 * Se ejecuta con `runIsolated` (sin shell, rutas validadas, timeout, escritura solo en `workDir`) y deja su
 * propia procedencia (`ArtifactProvenance`) como cualquier otro adaptador.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { delimiter, isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runIsolated } from '@fme/runtime-workers';
import type { ArtifactProvenance } from '@fme/connectors';

export const PRORES_STEP_ID = 'fme.pipeline.prores';
export const PRORES_STEP_VERSION = '0.0.0';

export type ProResStepInput = {
  /** Directorio con `frame-0001.png`, `frame-0002.png`… (salida del adaptador Blender). */
  framesDir: string;
  frames: number;
  fps: number;
  /** Tamaño final del MOV (se reescala con lanczos si difiere del de los PNG). */
  width: number;
  height: number;
  /** Directorio de trabajo del paso (dentro de la raíz del pipeline). */
  workDir: string;
  ffmpegPath: string;
  timeoutMs: number;
};

export type ProResStepResult =
  | { ok: true; outputPath: string; provenance: ArtifactProvenance }
  | { ok: false; code: string; message: string };

function isFile(p: string | undefined): p is string {
  if (!p || !isAbsolute(p)) return false;
  try { return statSync(p).isFile(); } catch { return false; }
}

/** Busca un ejecutable en el PATH sin shell. */
export function findInPath(name: string): string | undefined {
  const ext = process.platform === 'win32' ? '.exe' : '';
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (!dir) continue;
    const candidate = join(dir, name + ext);
    if (isFile(candidate)) return candidate;
  }
  return undefined;
}

function tail(path: string, max = 600): string {
  try {
    const text = readFileSync(path, 'utf8').trim();
    return text.length > max ? '…' + text.slice(-max) : text;
  } catch { return ''; }
}

function stepEnv(tmp: string): Record<string, string> {
  const env: Record<string, string> = { TEMP: tmp, TMP: tmp, TMPDIR: tmp };
  for (const k of ['SystemRoot', 'windir', 'PATH']) {
    const v = process.env[k];
    if (v !== undefined) env[k] = v;
  }
  return env;
}

/** Versión real de FFmpeg (`ffmpeg version 9.0.2-full_build…` → `9.0.2`). */
export async function readFfmpegVersion(ffmpegPath: string, workDir: string, timeoutMs = 30_000): Promise<string | undefined> {
  mkdirSync(workDir, { recursive: true });
  const dir = realpathSync(workDir);
  const run = await runIsolated({ cmd: ffmpegPath, args: ['-version'], workDir: dir, allowedPaths: [ffmpegPath, dir], timeoutMs, env: stepEnv(dir) });
  if (run.exitCode !== 0) return undefined;
  return /^ffmpeg version [^\d]*(\d+\.\d+(?:\.\d+)?)/m.exec(readFileSync(run.stdoutPath, 'utf8'))?.[1];
}

export async function encodeProRes(input: ProResStepInput): Promise<ProResStepResult> {
  const startedAt = new Date();
  mkdirSync(input.workDir, { recursive: true });
  const workDir = realpathSync(input.workDir);
  const framesDir = realpathSync(input.framesDir);
  const outputPath = join(workDir, 'sequence.mov');

  const version = await readFfmpegVersion(input.ffmpegPath, workDir, input.timeoutMs);
  if (!version) return { ok: false, code: 'engine-broken', message: 'ffmpeg no respondió a -version.' };

  const run = await runIsolated({
    cmd: input.ffmpegPath,
    args: [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-framerate', String(input.fps), '-start_number', '1',
      '-i', { path: join(framesDir, 'frame-%04d.png') },
      '-frames:v', String(input.frames),
      '-vf', `scale=${input.width}:${input.height}:flags=lanczos,format=yuva444p12le`,
      '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p12le',
      { path: outputPath },
    ],
    workDir,
    allowedPaths: [input.ffmpegPath, framesDir, workDir],
    timeoutMs: input.timeoutMs,
    env: stepEnv(workDir),
  });
  if (run.killed || run.exitCode === null) return { ok: false, code: 'timeout', message: `ffmpeg superó ${input.timeoutMs} ms.` };
  if (run.exitCode !== 0) return { ok: false, code: 'prores-failed', message: `ffmpeg terminó con código ${run.exitCode}: ${tail(run.stderrPath)}` };
  if (!isFile(outputPath) || statSync(outputPath).size === 0) return { ok: false, code: 'no-output', message: 'ffmpeg no produjo el MOV.' };

  const provenance: ArtifactProvenance = {
    uri: pathToFileURL(outputPath).href,
    type: 'video/quicktime',
    sha256: createHash('sha256').update(readFileSync(outputPath)).digest('hex'),
    pluginId: PRORES_STEP_ID,
    pluginVersion: PRORES_STEP_VERSION,
    engineVersion: version,
    params: {
      codec: 'prores_ks', profile: '4444', pixFmt: 'yuva444p12le',
      frames: input.frames, fps: input.fps, width: input.width, height: input.height,
      sourceDir: framesDir,
    },
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
  };
  return { ok: true, outputPath, provenance };
}
