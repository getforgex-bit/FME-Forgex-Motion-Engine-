// Integración con el motor real (FDN-032). Se marca SKIP, con el motivo, si el motor, ffmpeg o Chrome no están disponibles.
// Chrome: define FME_PUPPETEER_CACHE_DIR o deja la caché de la verificación de la Fase 1 en examples/fase1/revideo/out/.puppeteer.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkAdapterResult } from '@fme/connectors';
import { deserialize, serialize } from '@fme/project';
import { RevideoAdapter, newJobId } from '../src/index.ts';

const repo = fileURLToPath(new URL('../../../../', import.meta.url));
const fixturePath = join(repo, 'examples', 'prueba-hibrida-10s', 'project.fme.json');
const phase1Cache = join(repo, 'examples', 'fase1', 'revideo', 'out', '.puppeteer');
const puppeteerCacheDir = process.env.FME_PUPPETEER_CACHE_DIR ?? (existsSync(phase1Cache) ? phase1Cache : undefined);

const adapter = new RevideoAdapter(puppeteerCacheDir ? { puppeteerCacheDir } : {});
const probe = await adapter.probe();
const skip = !probe.available
  ? `motor Revideo no disponible: ${probe.diagnostics.map((d) => d.message).join(' | ')}`
  : !puppeteerCacheDir
    ? 'no se indicó dónde está Chrome (FME_PUPPETEER_CACHE_DIR) ni existe la caché de examples/fase1/revideo'
    : false;

// scripts/probe-media.mjs es JS sin tipos: se importa dinámicamente.
const probeMediaModule = (await import(new URL('../../../../scripts/probe-media.mjs', import.meta.url).href)) as {
  probeMedia: (f: string, o: { ffprobe: string }) => Promise<{ fps: number | null; frames: number | null; width: number | null; height: number | null; hasAlpha: boolean; pixFmt: string | null }>;
};
const ffprobe = process.env.FME_FFPROBE_PATH ?? 'ffprobe';

function job(extra: Record<string, string | number | boolean> = {}) {
  return {
    projectId: 'prueba-hibrida-10s', operation: 'render.video',
    inputs: [{ uri: fixturePath, type: 'fme/project+json' }],
    requirements: { layerId: 'capa-titulo', text: 'FME', ...extra },
  };
}
const ctx = () => ({ jobId: newJobId(), workDir: realpathSync(mkdtempSync(join(tmpdir(), 'fme-revideo-it-'))), timeoutMs: 180_000 });

test('probe lee la versión real del motor', { skip }, () => {
  assert.match(probe.engineVersion ?? '', /^0\.11\./);
});

test('capa de título de la fixture híbrida → MP4 de 120 fotogramas a 30 FPS con procedencia conforme', { skip, timeout: 240_000 }, async () => {
  const result = await adapter.run(job(), ctx());
  assert.deepEqual(result.diagnostics, [], JSON.stringify(result.diagnostics));
  assert.equal(result.status, 'ok');
  assert.deepEqual(checkAdapterResult(result, adapter), []);
  const media = await probeMediaModule.probeMedia(fileURLToPath(result.outputs[0]!.uri), { ffprobe });
  assert.equal(media.frames, 120);
  assert.equal(media.fps, 30);
  assert.deepEqual([media.width, media.height], [1920, 1080]);
  assert.equal(result.provenance[0]!.params.frames, 120);
  assert.match(result.provenance[0]!.engineVersion, /^0\.11\./);
});

test('alpha:true → MOV ProRes 4444 con canal alpha y 120 fotogramas', { skip, timeout: 240_000 }, async () => {
  const result = await adapter.run(job({ alpha: true }), ctx());
  assert.deepEqual(result.diagnostics, [], JSON.stringify(result.diagnostics));
  assert.deepEqual(checkAdapterResult(result, adapter), []);
  assert.equal(result.outputs[0]!.type, 'video/quicktime');
  const media = await probeMediaModule.probeMedia(fileURLToPath(result.outputs[0]!.uri), { ffprobe });
  assert.equal(media.frames, 120);
  assert.equal(media.hasAlpha, true);
});

test('capa inexistente → failed con diagnóstico, sin salidas', async () => {
  const result = await adapter.run({ ...job(), requirements: { layerId: 'nada' } }, ctx());
  // Sin motor el diagnóstico es engine-missing; con motor, layer-not-found. En ambos casos: failed y conforme.
  assert.equal(result.status, 'failed');
  assert.ok(['layer-not-found', 'engine-missing'].includes(result.diagnostics[0]!.code));
  assert.deepEqual(checkAdapterResult(result, adapter), []);
});

test('motor ausente → engine-missing y probe no disponible', async () => {
  const sin = new RevideoAdapter({ engineDir: join(tmpdir(), 'no-existe-fme-engine') });
  const p = await sin.probe();
  assert.equal(p.available, false);
  assert.equal(p.diagnostics[0]!.code, 'engine-missing');
  const r = await sin.run(job(), ctx());
  assert.equal(r.status, 'failed');
  assert.equal(r.diagnostics[0]!.code, 'engine-missing');
});

test('capa SVG (drawing con asset .svg) → MP4 de 210 fotogramas', { skip, timeout: 240_000 }, async () => {
  const parsed = deserialize(readFileSync(fixturePath, 'utf8'));
  assert.ok(parsed.ok);
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'fme-revideo-svg-')));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'assets', 'ilustracion.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><circle cx="100" cy="100" r="80" fill="#ff6b35"/></svg>');
  const projectPath = join(dir, 'project.fme.json');
  writeFileSync(projectPath, serialize(parsed.value));
  const result = await adapter.run({ ...job(), inputs: [{ uri: projectPath, type: 'fme/project+json' }], requirements: { layerId: 'capa-2d' } }, ctx());
  assert.deepEqual(result.diagnostics, [], JSON.stringify(result.diagnostics));
  assert.deepEqual(checkAdapterResult(result, adapter), []);
  const media = await probeMediaModule.probeMedia(fileURLToPath(result.outputs[0]!.uri), { ffprobe });
  assert.equal(media.frames, 210);
});
