// FDN-075a · criterio #8: reabrir el proyecto, cambiar una parte y NO rehacerlo todo, con los tres motores reales.
//   Ejecución 1: completa.  Ejecución 2: sin cambios → 0 jobs de motor.  Ejecución 3: cambia el texto del título →
//   1 job de Revideo + la composición; el resto sale de la caché. El vídeo cambia solo en el rango del título (180–299).
// SKIP con motivo si falta algún motor.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { deserialize, serialize } from '@fme/project';
import { createHybridAdapters, reopenExternalSource, runHybrid } from '../src/index.ts';
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

const probeDir = newDir('probe-inc');
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
async function frameRgb(mp4: string, n: number): Promise<Buffer> {
  const { stdout } = await run(ffmpeg, ['-v', 'error', '-i', mp4, '-vf', `select='eq(n,${n})'`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
    { encoding: 'buffer', maxBuffer: W * H * 3 + 1024, windowsHide: true });
  assert.equal(stdout.length, W * H * 3, `fotograma ${n}: tamaño inesperado`);
  return stdout;
}
const sha = (p: string): string => createHash('sha256').update(readFileSync(p)).digest('hex');

/** Umbrales DECLARADOS de la diferencia de píxeles entre dos MP4 (por fotograma). */
const OUTSIDE_MAX_MEAN_ABS = 0.25; // diferencia absoluta media por canal (0–255)
const OUTSIDE_MAX_CHANGED_FRACTION = 0.001; // fracción de píxeles con |Δ| > 16 en algún canal
function diffStats(a: Buffer, b: Buffer): { meanAbs: number; changed: number } {
  let sum = 0;
  let changed = 0;
  for (let p = 0; p < a.length; p += 3) {
    const d0 = Math.abs(a[p]! - b[p]!), d1 = Math.abs(a[p + 1]! - b[p + 1]!), d2 = Math.abs(a[p + 2]! - b[p + 2]!);
    sum += d0 + d1 + d2;
    if (d0 > 16 || d1 > 16 || d2 > 16) changed++;
  }
  return { meanAbs: sum / a.length, changed: changed / (W * H) };
}

const adaptersOfSteps = (r: HybridResult, source: 'engine' | 'cache'): string[] =>
  r.steps.filter((s) => s.source === source).map((s) => s.adapterId).sort();

test('criterio #8: completa → sin cambios (0 jobs) → cambio de título (1 job Revideo + composición)', { skip, timeout: 2_400_000 }, async () => {
  const inDir = newDir('in-inc');
  mkdirSync(join(inDir, 'assets'));
  await ff(['-f', 'lavfi', '-i', `testsrc2=size=${W}x${H}:rate=30:duration=10`, '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=10',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-g', '30', '-c:a', 'aac', '-shortest', join(inDir, 'assets', 'fondo.mp4')]);
  await ff(['-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=48000:duration=10', join(inDir, 'assets', 'base.wav')]);
  writeFileSync(join(inDir, 'assets', 'ilustracion.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360"><circle cx="180" cy="180" r="170" fill="#000000"/></svg>');
  const parsed = deserialize(readFileSync(fixturePath, 'utf8'));
  assert.ok(parsed.ok);
  const base = { ...parsed.value, width: W, height: H };
  const projectPath = join(inDir, 'project.fme.json');
  writeFileSync(projectPath, serialize(base));
  const outDir = newDir('out-inc');
  const times: number[] = [];
  const go = async (): Promise<HybridResult> => {
    const t0 = Date.now();
    const r = await runHybrid(projectPath, outDir, options);
    times.push((Date.now() - t0) / 1000);
    assert.equal(r.status, 'ok', JSON.stringify(r.diagnostics));
    return r;
  };

  // ── Ejecución 1: completa ────────────────────────────────────────────────────────────────────────────────────────
  const r1 = await go();
  assert.equal(r1.cachedSteps, 0);
  assert.deepEqual(adaptersOfSteps(r1, 'engine'), ['adapter.blender', 'adapter.freecut', 'fme.pipeline.prores', 'revideo', 'revideo']);
  const mp4Run1 = join(outDir, 'hybrid-run1.mp4');
  copyFileSync(r1.mp4!, mp4Run1);
  const arts1 = new Map((r1.project!.artifacts ?? []).map((a) => [a.id, a]));

  // ── Ejecución 2: sin cambios → 0 jobs de motor ───────────────────────────────────────────────────────────────────
  const r2 = await go();
  assert.equal(r2.engineJobs, 0, `ejecutó motores: ${adaptersOfSteps(r2, 'engine').join(', ')}`);
  assert.equal(r2.cachedSteps, r1.steps.length, 'todos los pasos deben venir de la caché');
  assert.deepEqual(r2.segmentKeys, r1.segmentKeys);
  assert.equal(r2.composeKey, r1.composeKey);
  assert.equal(sha(r2.mp4!), sha(mp4Run1), 'el MP4 final debe ser el mismo archivo');
  const arts2 = new Map((r2.project!.artifacts ?? []).map((a) => [a.id, a]));
  assert.deepEqual([...arts2.keys()].sort(), [...arts1.keys()].sort());
  for (const [id, a] of arts1) assert.deepEqual(arts2.get(id), a, `artefacto ${id} cambió sin cambios en el proyecto`);
  // La procedencia de los pasos en caché conserva a los tres adaptadores.
  for (const id of ['revideo', 'adapter.blender', 'adapter.freecut', 'fme.pipeline.prores']) assert.ok(r2.adaptersInProvenance.includes(id), `falta ${id} en la procedencia de la ejecución 2`);

  // ── Ejecución 3: cambia el texto del título ──────────────────────────────────────────────────────────────────────
  const edited = deserialize(readFileSync(projectPath, 'utf8'));
  assert.ok(edited.ok);
  const proj3 = structuredClone(edited.value);
  const title = proj3.sequences[0]!.scenes[0]!.layers.find((l) => l.id === 'capa-titulo')!;
  assert.ok(title.text, 'la fixture v3 trae el texto del título');
  title.text = { ...title.text, content: 'Cambio parcial' };
  writeFileSync(projectPath, serialize(proj3));
  const r3 = await go();
  assert.equal(r3.engineJobs, 2, `esperaba 2 jobs (Revideo + composición), hubo: ${adaptersOfSteps(r3, 'engine').join(', ')}`);
  assert.deepEqual(adaptersOfSteps(r3, 'engine'), ['adapter.freecut', 'revideo']);
  const titleStep = r3.steps.find((s) => s.source === 'engine' && s.adapterId === 'revideo');
  assert.equal(titleStep?.layerId, 'capa-titulo');
  assert.deepEqual(r3.steps.filter((s) => s.source === 'cache').map((s) => `${s.adapterId}:${s.layerId}`).sort(),
    ['adapter.blender:capa-3d', 'fme.pipeline.prores:capa-3d', 'revideo:capa-2d']);
  // Claves: solo cambian la del título y la composición.
  for (const [layerId, key] of Object.entries(r1.segmentKeys!)) {
    if (layerId === 'capa-titulo') assert.notEqual(r3.segmentKeys![layerId], key);
    else assert.equal(r3.segmentKeys![layerId], key, `la clave de ${layerId} no debía cambiar`);
  }
  assert.notEqual(r3.composeKey, r1.composeKey);
  // Los artefactos no afectados conservan dependencyHash y archivo (mismo SHA-256); el del título cambia.
  const arts3 = new Map((r3.project!.artifacts ?? []).map((a) => [a.id, a]));
  for (const id of ['render-capa-2d', 'render-capa-3d', 'render-capa-3d-prores']) {
    assert.equal(arts3.get(id)!.dependencyHash, arts1.get(id)!.dependencyHash, `${id}: dependencyHash cambió`);
    assert.deepEqual(arts3.get(id), arts1.get(id), `${id}: cambió`);
  }
  assert.notEqual(arts3.get('render-capa-titulo')!.dependencyHash, arts1.get('render-capa-titulo')!.dependencyHash);
  assert.notEqual(arts3.get('render-final')!.dependencyHash, arts1.get('render-final')!.dependencyHash);
  assert.equal(sha(fileURLToPath(arts3.get('render-capa-2d')!.uri)), sha(fileURLToPath(arts1.get('render-capa-2d')!.uri)));

  // «Reabrir la fuente externa»: el ExternalProjectRef de la capa lleva a su documento nativo y a su artefacto.
  const ref = reopenExternalSource(r3.project!, 'capa-titulo', inDir);
  assert.ok(ref && ref.pluginId === 'revideo' && ref.artifact?.id === 'render-capa-titulo');
  assert.equal(ref.exists, false, 'el documento nativo de ejemplo (titulo.tsx) no existe en disco y no se inventa');

  // ── El vídeo cambia SOLO en el rango del título (180–299) ───────────────────────────────────────────────────────
  const outside = [0, 7, 15, 29, 30, 44, 60, 77, 104, 105, 120, 150, 179];
  const inside = [200, 220, 250, 280, 299];
  const stat = async (n: number) => diffStats(await frameRgb(mp4Run1, n), await frameRgb(r3.mp4!, n));
  const out = new Map<number, { meanAbs: number; changed: number }>();
  const inn = new Map<number, { meanAbs: number; changed: number }>();
  for (const n of outside) out.set(n, await stat(n));
  for (const n of inside) inn.set(n, await stat(n));
  console.log(`tiempos (s): completa ${times[0]!.toFixed(1)}, sin cambios ${times[1]!.toFixed(1)}, título ${times[2]!.toFixed(1)}`);
  console.log('diferencia FUERA de 180–299', JSON.stringify(Object.fromEntries([...out].map(([n, v]) => [n, { meanAbs: +v.meanAbs.toFixed(4), changed: +v.changed.toFixed(5) }]))));
  console.log('diferencia DENTRO de 180–299', JSON.stringify(Object.fromEntries([...inn].map(([n, v]) => [n, { meanAbs: +v.meanAbs.toFixed(4), changed: +v.changed.toFixed(5) }]))));
  for (const [n, v] of out) {
    assert.ok(v.meanAbs <= OUTSIDE_MAX_MEAN_ABS && v.changed <= OUTSIDE_MAX_CHANGED_FRACTION,
      `fotograma ${n} (fuera del título) cambió: meanAbs=${v.meanAbs}, changed=${v.changed} (umbrales ${OUTSIDE_MAX_MEAN_ABS} / ${OUTSIDE_MAX_CHANGED_FRACTION})`);
  }
  const changedInside = [...inn.values()].filter((v) => v.changed > OUTSIDE_MAX_CHANGED_FRACTION * 5).length;
  assert.ok(changedInside >= 4, `el cambio del título no se ve dentro de 180–299 (${changedInside}/${inside.length} fotogramas)`);
});
