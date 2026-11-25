// FDN-061 (base del criterio #6): los gradientes `expression` e `integration` cambian una propiedad visual MEDIBLE
// a lo largo del tiempo en un render real. Métrica de píxeles sobre los fotogramas decodificados del MP4:
//   A = píxeles «contorno» (rojizos: r - b > 30)   → debe SUBIR con expression (0 → 1)
//   B = píxeles de sombra (más oscuros que el fondo) → debe BAJAR con integration (1 → 0)
// Las dos curvas van en sentidos opuestos a la vez: demuestra además que los gradientes son independientes.
// SKIP con motivo si el motor no está disponible.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { checkAdapterResult } from '@fme/connectors';
import { deserialize, serialize } from '@fme/project';
import { RevideoAdapter, newJobId } from '../src/index.ts';
import { newWorkDir, probeWorkDir } from './workroot.ts';

const run = promisify(execFile);
const repo = fileURLToPath(new URL('../../../../', import.meta.url));
const fixturePath = join(repo, 'examples', 'prueba-hibrida-10s', 'project.fme.json');
const phase1Cache = join(repo, 'examples', 'fase1', 'revideo', 'out', '.puppeteer');
const puppeteerCacheDir = process.env.FME_PUPPETEER_CACHE_DIR ?? (existsSync(phase1Cache) ? phase1Cache : undefined);

const adapter = new RevideoAdapter({ probeWorkDir, ...(puppeteerCacheDir ? { puppeteerCacheDir } : {}) });
const probe = await adapter.probe();
const skip = !probe.available
  ? `motor Revideo no disponible: ${probe.diagnostics.map((d) => d.message).join(' | ')}`
  : !puppeteerCacheDir ? 'no se indicó dónde está Chrome (FME_PUPPETEER_CACHE_DIR)' : false;

const W = 1920;
const H = 1080;
const BG_LUMA = 0.2126 * 0x10 + 0.7152 * 0x18 + 0.0722 * 0x20; // fondo #101820 de project.ts

async function metrics(mp4: string, frame: number): Promise<{ stroke: number; shadow: number }> {
  const { stdout } = await run(process.env.FME_FFMPEG_PATH ?? 'ffmpeg',
    ['-v', 'error', '-i', mp4, '-vf', `select=eq(n\\,${frame})`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
    { encoding: 'buffer', maxBuffer: W * H * 3 + 1024, windowsHide: true });
  assert.equal(stdout.length, W * H * 3, `fotograma ${frame}: tamaño inesperado`);
  let stroke = 0;
  let shadow = 0;
  for (let p = 0; p < stdout.length; p += 3) {
    const r = stdout[p]!, g = stdout[p + 1]!, b = stdout[p + 2]!;
    if (r - b > 30) stroke++;
    else if (0.2126 * r + 0.7152 * g + 0.0722 * b < BG_LUMA - 4) shadow++;
  }
  return { stroke, shadow };
}

test('expression sube y integration baja a la vez: la métrica de píxeles lo sigue de forma monótona', { skip, timeout: 300_000 }, async () => {
  const parsed = deserialize(readFileSync(fixturePath, 'utf8'));
  assert.ok(parsed.ok);
  const project = structuredClone(parsed.value);
  const layer = project.sequences[0]!.scenes[0]!.layers.find((l) => l.id === 'capa-titulo')!;
  layer.channels = {
    opacity: { defaultValue: 1, keyframes: [] },
    expression: { defaultValue: 0, keyframes: [{ frame: 0, value: 0 }, { frame: 119, value: 1, easing: 'linear' }] },
    integration: { defaultValue: 1, keyframes: [{ frame: 0, value: 1 }, { frame: 119, value: 0, easing: 'linear' }] },
  };
  const workDir = newWorkDir('grad');
  const projectPath = join(workDir, 'project.fme.json');
  writeFileSync(projectPath, serialize(project));

  const result = await adapter.run({
    projectId: project.id, operation: 'render.video',
    inputs: [{ uri: projectPath, type: 'fme/project+json' }],
    requirements: { layerId: 'capa-titulo' },
  }, { jobId: newJobId(), workDir: newWorkDir('grad-out'), timeoutMs: 240_000 });
  assert.deepEqual(result.diagnostics, [], JSON.stringify(result.diagnostics));
  assert.deepEqual(checkAdapterResult(result, adapter), []);

  const mp4 = fileURLToPath(result.outputs[0]!.uri);
  // Un contorno de ~2 px y poca opacidad (fotograma 30) no sobrevive al submuestreo de croma de H.264: se miden 0, 60, 90 y 119.
  const frames = [0, 60, 90, 119];
  const m: { stroke: number; shadow: number }[] = [];
  for (const f of frames) m.push(await metrics(mp4, f));
  console.log('métrica por fotograma', JSON.stringify(frames.map((f, i) => ({ frame: f, ...m[i] }))));

  for (let k = 1; k < m.length; k++) {
    assert.ok(m[k]!.stroke > m[k - 1]!.stroke, `contorno no crece entre ${frames[k - 1]} y ${frames[k]}: ${m[k - 1]!.stroke} → ${m[k]!.stroke}`);
    assert.ok(m[k]!.shadow < m[k - 1]!.shadow, `sombra no baja entre ${frames[k - 1]} y ${frames[k]}: ${m[k - 1]!.shadow} → ${m[k]!.shadow}`);
  }
  // Magnitudes con un salto claro (no ruido de compresión H.264): sin contorno al principio, sombra casi nula al final.
  assert.ok(m[0]!.stroke < 50, `contorno inicial no es ~0: ${m[0]!.stroke}`);
  assert.ok(m[3]!.stroke > 10_000, `contorno final demasiado pequeño: ${m[3]!.stroke}`);
  assert.ok(m[0]!.shadow > 20_000, `sombra inicial demasiado pequeña: ${m[0]!.shadow}`);
  assert.ok(m[3]!.shadow < m[0]!.shadow * 0.1, `sombra final no es ~0: ${m[3]!.shadow}`);
});
