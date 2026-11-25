// FDN-063: técnicas compuestas con motor real y una métrica de POSICIÓN verificable por técnica.
//   2.5d             → razón de desplazamientos del centroide alfa entre planos a distinta profundidad (Revideo).
//   2d-guided-by-3d  → el centroide de la capa 2D sigue al del objeto 3D renderizado por Blender (guía JSON v1).
//   3d-with-2d       → el overlay 2D (alpha) se ve ENCIMA del render 3D en la posición guiada (composición con FFmpeg `overlay`).
// SKIP con motivo si falta Revideo, Chrome, Blender o FFmpeg.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { createBlenderAdapter } from '@fme/adapter-blender';
import { checkAdapterResult } from '@fme/connectors';
import { deserialize, serialize } from '@fme/project';
import type { Project } from '@fme/project';
import { RevideoAdapter, newJobId } from '../src/index.ts';
import { newWorkDir, probeWorkDir } from './workroot.ts';

const run = promisify(execFile);
const repo = fileURLToPath(new URL('../../../../', import.meta.url));
const fixturePath = join(repo, 'examples', 'prueba-hibrida-10s', 'project.fme.json');
const phase1Cache = join(repo, 'examples', 'fase1', 'revideo', 'out', '.puppeteer');
const puppeteerCacheDir = process.env.FME_PUPPETEER_CACHE_DIR ?? (existsSync(phase1Cache) ? phase1Cache : undefined);
const ffmpeg = process.env.FME_FFMPEG_PATH ?? 'ffmpeg';

const revideo = new RevideoAdapter({ probeWorkDir, ...(puppeteerCacheDir ? { puppeteerCacheDir } : {}) });
const rProbe = await revideo.probe();
const blenderRoot = newWorkDir('blender-root');
const blender = createBlenderAdapter({ allowedRoots: [blenderRoot] });
const bProbe = await blender.probe();
const skipRevideo = !rProbe.available ? `Revideo no disponible: ${rProbe.diagnostics.map((d) => d.message).join(' | ')}` : !puppeteerCacheDir ? 'no se indicó dónde está Chrome (FME_PUPPETEER_CACHE_DIR)' : false;
const skipBoth = skipRevideo || (!bProbe.available ? `Blender no disponible: ${bProbe.diagnostics.map((d) => d.message).join(' | ')}` : false);

const W = 1280;
const H = 720;

async function rgbaFrames(args: string[], w: number, h: number, frames: number): Promise<Buffer[]> {
  const { stdout } = await run(ffmpeg, ['-v', 'error', ...args, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], { encoding: 'buffer', maxBuffer: w * h * 4 * frames + 4096, windowsHide: true });
  assert.equal(stdout.length, w * h * 4 * frames, 'tamaño de salida inesperado');
  const size = w * h * 4;
  return Array.from({ length: frames }, (_, i) => stdout.subarray(i * size, (i + 1) * size));
}

/** Centroide y área de los píxeles con alfa > 128. */
function alphaCentroid(rgba: Buffer, w: number): { cx: number; cy: number; count: number } {
  let sx = 0, sy = 0, count = 0;
  for (let p = 0; p < rgba.length; p += 4) {
    if (rgba[p + 3]! > 128) { const i = p / 4; sx += i % w; sy += Math.floor(i / w); count++; }
  }
  return { cx: count ? sx / count : NaN, cy: count ? sy / count : NaN, count };
}

function baseProject(): Project {
  const parsed = deserialize(readFileSync(fixturePath, 'utf8'));
  assert.ok(parsed.ok);
  return { ...structuredClone(parsed.value), width: W, height: H };
}
const layerOf = (p: Project, id: string) => p.sequences[0]!.scenes[0]!.layers.find((l) => l.id === id)!;
const circleSvg = (r: number, color: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${2 * r}" height="${2 * r}"><circle cx="${r}" cy="${r}" r="${r}" fill="${color}"/></svg>`;

test('2.5d: el desplazamiento del centroide se atenúa 1/(1+depth) y el plano se ve más pequeño', { skip: skipRevideo, timeout: 600_000 }, async () => {
  const dir = newWorkDir('t25d');
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'assets', 'ilustracion.svg'), circleSvg(100, '#00ff80'));
  const project = baseProject();
  const layer = layerOf(project, 'capa-2d');
  layer.techniques = ['2.5d'];
  layer.durationFrames = 60;
  layer.channels = { x: { defaultValue: 0, keyframes: [{ frame: 0, value: -300 }, { frame: 59, value: 300, easing: 'linear' }] } };
  const projectPath = join(dir, 'project.fme.json');
  writeFileSync(projectPath, serialize(project));

  const measure = async (depth: number) => {
    const res = await revideo.run({ projectId: project.id, operation: 'render.video', inputs: [{ uri: projectPath, type: 'fme/project+json' }], requirements: { layerId: 'capa-2d', alpha: true, depth } },
      { jobId: newJobId(), workDir: newWorkDir(`d${depth}`), timeoutMs: 240_000 });
    assert.deepEqual(res.diagnostics, [], JSON.stringify(res.diagnostics));
    assert.deepEqual(checkAdapterResult(res, revideo), []);
    const mov = fileURLToPath(res.outputs[0]!.uri);
    const first = (await rgbaFrames(['-i', mov, '-vf', "select='eq(n,0)'", '-frames:v', '1'], W, H, 1))[0]!;
    const last = (await rgbaFrames(['-i', mov, '-vf', "select='eq(n,59)'", '-frames:v', '1'], W, H, 1))[0]!;
    const a = alphaCentroid(first, W), b = alphaCentroid(last, W);
    return { shift: b.cx - a.cx, area: a.count };
  };
  const results = new Map<number, { shift: number; area: number }>();
  for (const d of [0, 1, 3]) results.set(d, await measure(d));
  console.log('2.5d (desplazamiento del centroide en px, área en px²)', JSON.stringify(Object.fromEntries(results)));

  const s = (d: number) => results.get(d)!.shift;
  assert.ok(Math.abs(s(0) - 600) < 4, `profundidad 0: desplazamiento ${s(0)} ≠ 600`);
  assert.ok(Math.abs(s(1) / s(0) - 0.5) < 0.02, `razón depth 1: ${s(1) / s(0)} ≠ 0,5`);
  assert.ok(Math.abs(s(3) / s(0) - 0.25) < 0.02, `razón depth 3: ${s(3) / s(0)} ≠ 0,25`);
  assert.ok(s(0) > s(1) && s(1) > s(3), 'el desplazamiento debe decrecer con la profundidad');
  const ar = (d: number) => Math.sqrt(results.get(d)!.area / results.get(0)!.area);
  assert.ok(Math.abs(ar(1) - 0.8) < 0.03 && Math.abs(ar(3) - 1 / 1.75) < 0.03, `escala: ${ar(1)}, ${ar(3)}`);
});

test('guide3DLayerId + 3d-with-2d: el 2D sigue al objeto 3D de Blender y se ve encima del render 3D', { skip: skipBoth, timeout: 1_200_000 }, async () => {
  const dir = newWorkDir('tguide');
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'assets', 'ilustracion.svg'), circleSvg(60, '#00ff80'));
  const project = baseProject();
  const l3 = layerOf(project, 'capa-3d');
  l3.channels = { x: { defaultValue: 0, keyframes: [{ frame: 0, value: -1.5 }, { frame: 149, value: 1.5, easing: 'linear' }] } };
  const l2 = layerOf(project, 'capa-2d');
  l2.techniques = ['2d-guided-by-3d'];
  l2.guide3DLayerId = 'capa-3d';
  l2.channels = {};
  const projectPath = join(dir, 'project.fme.json');
  writeFileSync(projectPath, serialize(project));
  const b0 = l3.startFrame; // 105
  const n3 = l3.durationFrames; // 150

  // 1) Render 3D real de Blender (pequeño) y silueta alfa → guía JSON v1.
  const broot = newWorkDir('blender-job');
  const bAdapter = createBlenderAdapter({ allowedRoots: [dir, broot] });
  const bres = await bAdapter.run({ projectId: project.id, operation: 'render.image-sequence', inputs: [{ uri: pathToFileURL(projectPath).href, type: 'fme/project+json' }],
    requirements: { layerId: 'capa-3d', resolution: '320x180' }, seed: project.seed }, { jobId: 'guide3d', workDir: broot, timeoutMs: 600_000 });
  assert.equal(bres.status, 'ok', JSON.stringify(bres.diagnostics));
  assert.equal(bres.outputs.length, n3);
  const framesDir = join(fileURLToPath(bres.outputs[0]!.uri), '..');
  const seq = await rgbaFrames(['-framerate', '30', '-i', join(framesDir, 'frame-%04d.png')], 320, 180, n3);
  const cube = seq.map((f) => alphaCentroid(f, 320));
  assert.ok(cube.every((c) => c.count > 500), 'el objeto 3D debe verse en todos los fotogramas');
  const travel = Math.abs(cube[n3 - 1]!.cx - cube[0]!.cx) * (W / 320);
  assert.ok(travel > 150, `el objeto 3D casi no se mueve (${travel.toFixed(0)} px): la prueba no discriminaría`);
  writeFileSync(join(dir, 'guide.json'), JSON.stringify({ version: 1, width: 320, height: 180, source: 'alpha-silhouette-centroid', frames: cube.map((c) => ({ x: c.cx / 320, y: c.cy / 180 })) }));

  // 2) Revideo renderiza la capa 2D guiada (MOV con alpha).
  const rres = await revideo.run({ projectId: project.id, operation: 'render.video', inputs: [{ uri: projectPath, type: 'fme/project+json' }],
    requirements: { layerId: 'capa-2d', alpha: true, guide: join(dir, 'guide.json') } }, { jobId: newJobId(), workDir: newWorkDir('guided'), timeoutMs: 240_000 });
  assert.deepEqual(rres.diagnostics, [], JSON.stringify(rres.diagnostics));
  assert.deepEqual(checkAdapterResult(rres, revideo), []);
  const mov = fileURLToPath(rres.outputs[0]!.uri);

  // 3) Métrica de posición: centroide del 2D vs. centroide del 3D (escalado a 1280×720) en fotogramas de escena 105…254.
  // La capa 2D vive en 30–239 y la 3D en 105–254: solapan en 105–239.
  const overlap = l2.startFrame + l2.durationFrames - b0; // 135 fotogramas
  const sceneFrames = [105, 140, 180, 210, 239];
  const errors: number[] = [];
  for (const t of sceneFrames) {
    const f2 = (await rgbaFrames(['-i', mov, '-vf', `select='eq(n,${t - l2.startFrame})'`, '-frames:v', '1'], W, H, 1))[0]!;
    const c2 = alphaCentroid(f2, W);
    const c3 = cube[t - b0]!;
    errors.push(Math.hypot(c2.cx - c3.cx * (W / 320), c2.cy - c3.cy * (H / 180)));
  }
  console.log('error de seguimiento 2D vs 3D (px a 1280×720) en los fotogramas', sceneFrames.join(','), '→', errors.map((e) => e.toFixed(2)).join(', '));
  assert.ok(errors.every((e) => e < 6), `el 2D no sigue al 3D: ${errors.join(', ')}`);
  // Si la guía se ignorase, el 2D estaría fijo en el centro y fallaría (el objeto se mueve > 150 px).

  // 4) 3d-with-2d: el overlay 2D (guiado) va encima del render 3D en la posición del objeto.
  const filter = (over: boolean) => '[0:v]scale=1280:720:flags=lanczos,format=rgba[b];' +
    `[1:v]trim=start_frame=${b0 - l2.startFrame}:end_frame=${b0 - l2.startFrame + overlap},setpts=PTS-STARTPTS,format=rgba[o];` +
    'color=c=0x303030:s=1280x720:r=30,format=rgba[bg];[bg][b]overlay=shortest=1[t];' + (over ? '[t][o]overlay=shortest=1' : '[o][t]overlay=shortest=1');
  const compose = (over: boolean) => rgbaFrames(['-framerate', '30', '-i', join(framesDir, 'frame-%04d.png'), '-i', mov, '-filter_complex', filter(over), '-frames:v', String(overlap)], W, H, overlap);
  const above = await compose(true);
  const below = await compose(false);
  const probes = [0, 40, 80, 120, overlap - 1];
  let copperAround = 0;
  for (const i of probes) {
    const cx = Math.round(cube[i]!.cx * (W / 320)), cy = Math.round(cube[i]!.cy * (H / 180));
    const px = (buf: Buffer): [number, number, number] => { const o = (cy * W + cx) * 4; return [buf[o]!, buf[o + 1]!, buf[o + 2]!]; };
    const [r, g, b] = px(above[i]!);
    assert.ok(r < 40 && g > 215 && b > 100 && b < 150, `fotograma ${i}: el 2D no está encima del 3D (RGB ${r},${g},${b})`);
    const [r2, g2, b2] = px(below[i]!);
    assert.ok(!(g2 > 215 && r2 < 40), `fotograma ${i}: con el orden invertido el 3D debería tapar al 2D (RGB ${r2},${g2},${b2})`);
    for (let p = 0; p < above[i]!.length; p += 4) { const R = above[i]![p]!, G = above[i]![p + 1]!, B = above[i]![p + 2]!; if (R > 120 && G > 40 && G < 150 && B < 110 && R - B > 50) copperAround++; }
  }
  assert.ok(copperAround > 20_000, `debe verse el objeto 3D alrededor del overlay (${copperAround} px cobre)`);
});
