// FDN-042c · criterio #3: la prueba híbrida de 10 s con los TRES motores reales (Revideo, Blender, FreeCut).
// SKIP con motivo si falta algún motor. Se ejecuta a 1280×720 (la resolución verificada de FreeCut, FDN-042a);
// Blender renderiza a 640×360 (4 GB de VRAM) y el paso ProRes lo reescala al tamaño del proyecto.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { checkAdapterResult } from '@fme/connectors';
import type { ArtifactProvenance } from '@fme/connectors';
import { deserialize, parseProject, serialize } from '@fme/project';
import { createHybridAdapters, runHybrid } from '../src/index.ts';

const run = promisify(execFile);
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const fixturePath = join(repo, 'examples', 'prueba-hibrida-10s', 'project.fme.json');
const phase1Cache = join(repo, 'examples', 'fase1', 'revideo', 'out', '.puppeteer');
const puppeteerCacheDir = process.env.FME_PUPPETEER_CACHE_DIR ?? (existsSync(phase1Cache) ? phase1Cache : undefined);
const ffmpeg = process.env.FME_FFMPEG_PATH ?? 'ffmpeg';
const ffprobe = process.env.FME_FFPROBE_PATH ?? 'ffprobe';

const root = join(fileURLToPath(new URL('../', import.meta.url)), '.test-work');
mkdirSync(root, { recursive: true });
const newDir = (name: string): string => realpathSync(mkdtempSync(join(root, `${name}-`)));

const W = 1280;
const H = 720;
const options = { blenderResolution: '640x360', ...(puppeteerCacheDir ? { puppeteerCacheDir } : {}) };

// ¿Están los tres motores? (probe real de cada adaptador).
const probeDir = newDir('probe');
const probes = await (async () => {
  const a = createHybridAdapters(probeDir, probeDir, { ...options, probeWorkDir: join(probeDir, 'p') });
  const out: string[] = [];
  for (const [name, adapter] of Object.entries(a)) {
    const p = await adapter.probe();
    if (!p.available) out.push(`${name}: ${p.diagnostics.map((d) => d.message).join(' | ')}`);
  }
  return out;
})();
const skip = probes.length > 0 ? `motor no disponible → ${probes.join(' || ')}` : !puppeteerCacheDir ? 'no se indicó dónde está Chrome (FME_PUPPETEER_CACHE_DIR)' : false;

const probeMedia = ((await import(new URL('../../../scripts/probe-media.mjs', import.meta.url).href)) as {
  probeMedia: (f: string, o: { ffprobe: string }) => Promise<{ fps: number | null; frames: number | null; width: number | null; height: number | null; audio: boolean }>;
}).probeMedia;

async function ff(args: string[]): Promise<void> {
  await run(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { windowsHide: true, timeout: 120_000 });
}

async function frameRgb(mp4: string, n: number): Promise<Buffer> {
  const { stdout } = await run(ffmpeg, ['-v', 'error', '-i', mp4, '-vf', `select=eq(n\\,${n})`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
    { encoding: 'buffer', maxBuffer: W * H * 3 + 1024, windowsHide: true });
  assert.equal(stdout.length, W * H * 3, `fotograma ${n}: tamaño inesperado`);
  return stdout;
}

/**
 * Firmas de color de cada capa sobre los píxeles que difieren del fondo (|Δ| total > 90, así el fondo testsrc2 no cuenta):
 * negro (círculo 2D), cobre (cubo de Blender) y blanco puro (texto del título).
 */
function signatures(final: Buffer, bg: Buffer): { black: number; copper: number; white: number } {
  let black = 0;
  let copper = 0;
  let white = 0;
  for (let p = 0; p < final.length; p += 3) {
    const r = final[p]!, g = final[p + 1]!, b = final[p + 2]!;
    if (Math.abs(r - bg[p]!) + Math.abs(g - bg[p + 1]!) + Math.abs(b - bg[p + 2]!) < 90) continue;
    if (r < 14 && g < 14 && b < 14) black++;
    else if (r >= 120 && r <= 235 && g >= 60 && g <= 150 && b >= 30 && b <= 120 && r - b > 50 && r > g && g > b) copper++;
    else if (r > 245 && g > 245 && b > 245) white++;
  }
  return { black, copper, white };
}

test('prueba híbrida de 10 s: MP4 de 300 fotogramas, cada capa en su rango, artefactos enlazados y los tres adaptadores en la procedencia', { skip, timeout: 1_800_000 }, async () => {
  // Entradas: el proyecto de la fixture (v3) a 1280×720, con fondo y audio reales generados con FFmpeg.
  const inDir = newDir('in');
  mkdirSync(join(inDir, 'assets'));
  await ff(['-f', 'lavfi', '-i', `testsrc2=size=${W}x${H}:rate=30:duration=10`, '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=10',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-g', '30', '-c:a', 'aac', '-shortest', join(inDir, 'assets', 'fondo.mp4')]);
  await ff(['-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=48000:duration=10', join(inDir, 'assets', 'base.wav')]);
  writeFileSync(join(inDir, 'assets', 'ilustracion.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360"><circle cx="180" cy="180" r="170" fill="#000000"/></svg>');
  const parsed = deserialize(readFileSync(fixturePath, 'utf8'));
  assert.ok(parsed.ok);
  assert.equal(parsed.value.schemaVersion, 3);
  const base = { ...parsed.value, width: W, height: H };
  const projectPath = join(inDir, 'project.fme.json');
  writeFileSync(projectPath, serialize(base));

  const outDir = newDir('out');
  const t0 = Date.now();
  const result = await runHybrid(projectPath, outDir, options);
  const seconds = (Date.now() - t0) / 1000;
  console.log(`runHybrid: ${result.status} en ${seconds.toFixed(1)} s; pasos: ${result.steps.map((s) => `${s.id}=${s.status}`).join(', ')}`);
  assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics));
  assert.ok(result.mp4 && result.projectPath && result.project);

  // MP4 final: 300 fotogramas a 30 FPS.
  const media = await probeMedia(result.mp4, { ffprobe });
  assert.deepEqual([media.frames, media.fps, media.width, media.height], [300, 30, W, H]);
  assert.equal(media.audio, true);

  // Conformidad (checkAdapterResult) de cada paso de adaptador y procedencia de los tres adaptadores + el paso ProRes.
  const ids = new Set(result.adaptersInProvenance);
  for (const id of ['revideo', 'adapter.blender', 'adapter.freecut', 'fme.pipeline.prores']) assert.ok(ids.has(id), `falta ${id} en la procedencia: ${[...ids].join(', ')}`);
  const adapters = createHybridAdapters(inDir, outDir, { ...options, probeWorkDir: join(probeDir, 'q') });
  const byId = { revideo: adapters.revideo, 'adapter.blender': adapters.blender, 'adapter.freecut': adapters.freecut } as const;
  for (const step of result.steps) {
    const adapter = byId[step.adapterId as keyof typeof byId];
    if (!adapter) continue; // paso propio (ProRes): se comprueba abajo
    const issues = checkAdapterResult({ jobId: step.id, status: step.status, outputs: step.provenance.map((p: ArtifactProvenance) => ({ uri: p.uri, type: p.type })), provenance: step.provenance, diagnostics: step.diagnostics }, adapter);
    assert.deepEqual(issues, [], `${step.id}: ${issues.join('; ')}`);
  }
  const prores = result.steps.find((s) => s.adapterId === 'fme.pipeline.prores');
  assert.ok(prores && prores.provenance[0]?.engineVersion && /^[0-9a-f]{64}$/.test(prores.provenance[0].sha256));
  // Aviso del primitivo de sustitución de Blender (el modelo .glb de la fixture no existe).
  const blenderStep = result.steps.find((s) => s.adapterId === 'adapter.blender')!;
  assert.ok(blenderStep.diagnostics.some((d) => d.code === 'BLENDER_ASSET_MISSING'), 'debe avisar del primitivo de sustitución');

  // Proyecto resultante: pasa parseProject y cada renderArtifactId resuelve.
  const saved = deserialize(readFileSync(result.projectPath, 'utf8'));
  assert.ok(saved.ok);
  assert.ok(parseProject(JSON.parse(readFileSync(result.projectPath, 'utf8'))).ok);
  const artifacts = new Map((saved.value.artifacts ?? []).map((a) => [a.id, a]));
  const layers = saved.value.sequences[0]!.scenes[0]!.layers;
  for (const id of ['capa-titulo', 'capa-2d', 'capa-3d']) {
    const rid = layers.find((l) => l.id === id)?.externalProject?.renderArtifactId;
    assert.ok(rid && artifacts.has(rid), `${id}: renderArtifactId no resuelve (${String(rid)})`);
    assert.match(artifacts.get(rid)!.dependencyHash, /^[0-9a-f]{64}$/);
  }
  assert.ok(artifacts.has('render-final') && artifacts.has('render-capa-3d-prores'));

  // Métrica de píxeles: cada capa en su rango. Se compara el fotograma final con el del fondo (mismo n).
  const bgPath = join(inDir, 'assets', 'fondo.mp4');
  const probeFrames = [29, 30, 104, 105, 179, 200, 239, 240, 254, 255, 299];
  const m = new Map<number, { black: number; copper: number; white: number }>();
  for (const n of probeFrames) m.set(n, signatures(await frameRgb(result.mp4!, n), await frameRgb(bgPath, n)));
  console.log('métrica (píxeles de cada firma distintos del fondo)', JSON.stringify(Object.fromEntries(m)));

  const s = (n: number) => m.get(n)!;
  // 2D [30, 239]: el círculo negro entra en 30 y sale en 240.
  assert.ok(s(29).black < 100 && s(30).black > 20_000, `2D no entra en 30: ${s(29).black} → ${s(30).black}`);
  assert.ok(s(239).black > 20_000 && s(240).black < 100, `2D no sale en 240: ${s(239).black} → ${s(240).black}`);
  // 3D [105, 254]: el cubo cobre entra en 105 y casi desaparece en 255 (queda solo el tono cobre residual del contorno del título).
  assert.ok(s(104).copper < 1_000 && s(105).copper > 10_000, `3D no entra en 105: ${s(104).copper} → ${s(105).copper}`);
  assert.ok(s(254).copper > 30_000 && s(255).copper < 15_000, `3D no sale en 255: ${s(254).copper} → ${s(255).copper}`);
  // Título [180, 299]: su opacidad (0 → 1 en 20 fotogramas) está horneada en el MOV, así que el blanco puro aparece al llegar a 1 (fotograma 200).
  assert.ok(s(179).white < 100, `el título aparece antes de 180: ${s(179).white}`);
  assert.ok(s(200).white > 3_000 && s(255).white > 3_000 && s(299).white > 3_000, `el título no está en 200/255/299: ${s(200).white}, ${s(255).white}, ${s(299).white}`);
});
