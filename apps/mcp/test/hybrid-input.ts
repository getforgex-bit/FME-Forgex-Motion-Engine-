// Entradas de la prueba híbrida real (FDN-080c): el proyecto de la fixture a 1280×720 (resolución verificada de
// FreeCut) con fondo, audio y SVG reales generados con FFmpeg, igual que `packages/pipeline/test`.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { deserialize, serialize } from '@fme/project';

const repo = resolve(import.meta.dirname, '..', '..', '..');
export const fixturePath = join(repo, 'examples', 'prueba-hibrida-10s', 'project.fme.json');
export const W = 1280;
export const H = 720;

export const ffmpeg = process.env.FME_FFMPEG_PATH ?? 'ffmpeg';
export const ffprobe = process.env.FME_FFPROBE_PATH ?? 'ffprobe';

export function ffmpegAvailable(): boolean {
  return spawnSync(ffmpeg, ['-version'], { windowsHide: true }).status === 0;
}

/** Entorno para los motores reales: respeta lo definido y, si falta Chrome, usa la caché de la Fase 1 si existe. */
export function engineEnv(): Record<string, string> {
  const env = { ...(process.env as Record<string, string>) };
  const phase1 = join(repo, 'examples', 'fase1', 'revideo', 'out', '.puppeteer');
  if (!env.FME_PUPPETEER_CACHE_DIR && existsSync(phase1)) env.FME_PUPPETEER_CACHE_DIR = phase1;
  return env;
}

function ff(args: string[]): void {
  const r = spawnSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { windowsHide: true, timeout: 120_000 });
  if (r.status !== 0) throw new Error(`ffmpeg falló: ${String(r.stderr)}`);
}

/** Crea `<dir>/project.fme.json` y `<dir>/assets/*`; devuelve la ruta del proyecto. */
export function prepareHybridInput(dir: string): string {
  mkdirSync(join(dir, 'assets'), { recursive: true });
  ff(['-f', 'lavfi', '-i', `testsrc2=size=${W}x${H}:rate=30:duration=10`, '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=10',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-g', '30', '-c:a', 'aac', '-shortest', join(dir, 'assets', 'fondo.mp4')]);
  ff(['-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=48000:duration=10', join(dir, 'assets', 'base.wav')]);
  writeFileSync(join(dir, 'assets', 'ilustracion.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360"><circle cx="180" cy="180" r="170" fill="#000000"/></svg>');
  const parsed = deserialize(readFileSync(fixturePath, 'utf8'));
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  const projectPath = join(dir, 'project.fme.json');
  writeFileSync(projectPath, serialize({ ...parsed.value, width: W, height: H }));
  return projectPath;
}
