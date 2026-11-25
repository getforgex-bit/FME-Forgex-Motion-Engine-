// FDN-063c · `3d-with-2d` integrada en runHybrid: el 2D guiado va ENCIMA del render 3D en el MP4 final, dentro de su rango.
// Métrica: en los píxeles donde el título (alfa > 250 en su MOV) y el objeto 3D (alfa > 250 en su PNG de Blender, escalado)
// coinciden, el MP4 final debe mostrar el color del TÍTULO, no el del cubo. Se repite con el título puesto POR DEBAJO del
// 3D en el proyecto (zIndex menor): el pipeline lo sube por encima (`overlayZIndexes`). Además el título sigue al objeto
// (guía de la silueta alfa): su centroide coincide con el del cubo. SKIP con motivo si falta algún motor.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { deserialize, serialize } from '@fme/project';
import type { Project } from '@fme/project';
import { createHybridAdapters, overlayZIndexes, runHybrid } from '../src/index.ts';
import type { HybridResult } from '../src/index.ts';

const run = promisify(execFile);
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const fixturePath = join(repo, 'examples', 'prueba-hibrida-10s', 'project.fme.json');
const phase1Cache = join(repo, 'examples', 'fase1', 'revideo', 'out', '.puppeteer');
const puppeteerCacheDir = process.env.FME_PUPPETEER_CACHE_DIR ?? (existsSync(phase1Cache) ? phase1Cache : undefined);
const ffmpeg = process.env.FME_FFMPEG_PATH ?? 'ffmpeg';

const root = join(fileURLToPath(new URL('../', import.meta.url)), '.test-work');
mkdirSync(root, { recursive: true });
const newDir = (name: string): string => realpathSync(mkdtempSync(join(root, `${name}-`)));

const W = 1280;
const H = 720;
const options = { blenderResolution: '640x360', ...(puppeteerCacheDir ? { puppeteerCacheDir } : {}) };

const probeDir = newDir('probe-ovl');
const missing = await (async () => {
  const a = createHybridAdapters(probeDir, probeDir, { ...options, probeWorkDir: join(probeDir, 'p') });
  const out: string[] = [];
  for (const [name, adapter] of Object.entries(a)) {
    const p = await adapter.probe();
    if (!p.available) out.push(`${name}: ${p.diagnostics.map((d) => d.message).join(' | ')}`);
  }
  return out;
})();
const skip = missing.length > 0 ? `motor no disponible → ${missing.join(' || ')}` : !puppeteerCacheDir ? 'no se indicó dónde está Chrome (FME_PUPPETEER_CACHE_DIR)' : false;

async function ff(args: string[]): Promise<void> {
  await run(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { windowsHide: true, timeout: 120_000 });
}
async function rgba(input: string[], filter: string): Promise<Buffer> {
  const { stdout } = await run(ffmpeg, ['-v', 'error', ...input, '-vf', filter, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
    { encoding: 'buffer', maxBuffer: W * H * 4 + 1024, windowsHide: true });
  assert.equal(stdout.length, W * H * 4, 'tamaño de fotograma inesperado');
  return stdout;
}
const centroid = (b: Buffer): { cx: number; cy: number; count: number } => {
  let sx = 0, sy = 0, count = 0;
  for (let p = 0; p < b.length; p += 4) if (b[p + 3]! > 128) { const i = p / 4; sx += i % W; sy += Math.floor(i / W); count++; }
  return { cx: sx / count, cy: sy / count, count };
};

/** Fracción de píxeles solapados (título opaco ∧ 3D opaco) cuyo color final es el del título; y su número. */
async function overlapMetric(r: HybridResult, n: number): Promise<{ overlap: number; titleOnTop: number; centroidError: number }> {
  const arts = new Map((r.project!.artifacts ?? []).map((a) => [a.id, a]));
  const titleMov = fileURLToPath(arts.get('render-capa-titulo')!.uri);
  const blenderStep = r.steps.find((s) => s.adapterId === 'adapter.blender')!;
  const png = fileURLToPath(blenderStep.provenance[n - 105]!.uri);
  const final = await rgba(['-i', r.mp4!], `select='eq(n,${n})'`);
  const title = await rgba(['-i', titleMov], `select='eq(n,${n - 180})'`);
  const cube = await rgba(['-i', png], `scale=${W}:${H}:flags=bilinear`);
  let overlap = 0, onTop = 0;
  for (let p = 0; p < final.length; p += 4) {
    if (title[p + 3]! > 250 && cube[p + 3]! > 250) {
      overlap++;
      if (Math.abs(final[p]! - title[p]!) < 40 && Math.abs(final[p + 1]! - title[p + 1]!) < 40 && Math.abs(final[p + 2]! - title[p + 2]!) < 40) onTop++;
    }
  }
  const ct = centroid(title), cc = centroid(cube);
  return { overlap, titleOnTop: overlap ? onTop / overlap : NaN, centroidError: Math.hypot(ct.cx - cc.cx, ct.cy - cc.cy) };
}

test('overlayZIndexes: el 2D guiado por una capa 3D con 3d-with-2d queda encima (solo sube)', () => {
  const z = overlayZIndexes([
    { id: 'fondo', zIndex: 0, techniques: ['2d'] },
    { id: 'cubo', zIndex: 5, techniques: ['3d', '3d-with-2d'] },
    { id: 'titulo', zIndex: 1, techniques: ['2d-guided-by-3d'], guide3DLayerId: 'cubo' },
    { id: 'alto', zIndex: 9, techniques: ['2d-guided-by-3d'], guide3DLayerId: 'cubo' },
    { id: 'sin-decl', zIndex: 1, techniques: ['2d-guided-by-3d'], guide3DLayerId: 'fondo' },
  ]);
  assert.deepEqual([z.get('titulo'), z.get('alto'), z.get('sin-decl'), z.get('cubo')], [6, 9, 1, 5]);
});

test('3d-with-2d en runHybrid: el título guiado se ve encima del cubo en el MP4 final (también si el proyecto lo pone debajo)', { skip, timeout: 2_400_000 }, async () => {
  const inDir = newDir('in-ovl');
  mkdirSync(join(inDir, 'assets'));
  await ff(['-f', 'lavfi', '-i', `testsrc2=size=${W}x${H}:rate=30:duration=10`, '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=10',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-g', '30', '-c:a', 'aac', '-shortest', join(inDir, 'assets', 'fondo.mp4')]);
  await ff(['-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=48000:duration=10', join(inDir, 'assets', 'base.wav')]);
  writeFileSync(join(inDir, 'assets', 'ilustracion.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360"><circle cx="180" cy="180" r="170" fill="#000000"/></svg>');
  const parsed = deserialize(readFileSync(fixturePath, 'utf8'));
  assert.ok(parsed.ok);
  const base: Project = { ...structuredClone(parsed.value), width: W, height: H };
  const titleOf = (p: Project) => p.sequences[0]!.scenes[0]!.layers.find((l) => l.id === 'capa-titulo')!;
  const cubeOf = (p: Project) => p.sequences[0]!.scenes[0]!.layers.find((l) => l.id === 'capa-3d')!;
  assert.ok(cubeOf(base).techniques.includes('3d-with-2d') && titleOf(base).guide3DLayerId === 'capa-3d');
  const projectPath = join(inDir, 'project.fme.json');
  writeFileSync(projectPath, serialize(base));
  const outDir = newDir('out-ovl');

  const frames = [200, 220, 240, 254]; // título y cubo coinciden en 180–254
  const check = async (r: HybridResult, label: string) => {
    const out: Record<number, { overlap: number; titleOnTop: number; centroidError: number }> = {};
    for (const n of frames) out[n] = await overlapMetric(r, n);
    console.log(`${label}: solape título∧3D y fracción con el color del título`, JSON.stringify(Object.fromEntries(Object.entries(out).map(([n, v]) => [n, { overlap: v.overlap, titleOnTop: +v.titleOnTop.toFixed(3), centroidErr: +v.centroidError.toFixed(2) }]))));
    for (const n of frames) {
      assert.ok(out[n]!.overlap > 2_000, `${label} fotograma ${n}: casi no hay solape (${out[n]!.overlap}); la métrica no discriminaría`);
      assert.ok(out[n]!.titleOnTop >= 0.9, `${label} fotograma ${n}: el título NO está encima del cubo (${out[n]!.titleOnTop})`);
      // El centroide del TEXTO no coincide exactamente con el centro del objeto (el texto no es simétrico y su contorno crece con expression): 15 px ≈ 1,2 % del ancho.
      assert.ok(out[n]!.centroidError < 15, `${label} fotograma ${n}: el título no sigue al cubo (error ${out[n]!.centroidError} px)`);
    }
  };

  // 1) Proyecto de la fixture (título z 4 sobre 3D z 3).
  const r1 = await runHybrid(projectPath, outDir, options);
  assert.equal(r1.status, 'ok', JSON.stringify(r1.diagnostics));
  assert.ok(r1.steps.some((s) => s.adapterId === 'adapter.blender') && r1.steps.some((s) => s.layerId === 'capa-titulo' && s.adapterId === 'revideo'));
  await check(r1, 'fixture');

  // 2) El título POR DEBAJO del 3D (zIndex 2 < 3): el pipeline lo sube (3d-with-2d); misma métrica.
  const lowered = structuredClone(base);
  titleOf(lowered).zIndex = 2;
  writeFileSync(projectPath, serialize(lowered));
  const r2 = await runHybrid(projectPath, outDir, options);
  assert.equal(r2.status, 'ok', JSON.stringify(r2.diagnostics));
  assert.ok(r2.cachedSteps >= 3, 'el 3D, el 2D y el ProRes deben venir de la caché');
  await check(r2, 'título debajo en el proyecto');
});
