import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { checkAdapterResult } from '@fme/connectors';
import { createBlenderAdapter } from '../src/index.ts';
import { prepareJob } from '../src/request.ts';
import type { JobRequest } from '@fme/connectors';
import type { TestContext } from 'node:test';

const examplePath = realpathSync.native(fileURLToPath(
  new URL('../../../../examples/prueba-hibrida-10s/project.fme.json', import.meta.url),
));
const exampleRoot = dirname(examplePath);
const windows = process.platform === 'win32';
const preview = { width: 256, height: 144 };

const projectJob: JobRequest = {
  projectId: 'prueba-hibrida-10s',
  operation: 'render.image-sequence',
  inputs: [{ type: 'fme/project+json', uri: pathToFileURL(examplePath).href }],
  requirements: { layerId: 'capa-3d', resolution: '256x144' },
};

function setup(context: TestContext) {
  const root = mkdtempSync(join(realpathSync.native(tmpdir()), 'fme-adapter-blender-test-'));
  context.after(() => rmSync(root, { recursive: true, force: true, maxRetries: 2 }));
  const adapter = createBlenderAdapter({ allowedRoots: [root, exampleRoot] });
  const work = (jobId: string, timeoutMs = 90_000) => {
    const workDir = join(root, jobId);
    mkdirSync(workDir);
    return { jobId, workDir, timeoutMs };
  };
  return { root, adapter, work };
}

test('prepara el mismo trabajo a partir de la fixture FME de schemaVersion 1 y la vigente', () => {
  const legacyPath = realpathSync.native(fileURLToPath(
    new URL('../../../../packages/project/test/fixtures-v1/hibrida.fme.json', import.meta.url),
  ));
  assert.equal(JSON.parse(readFileSync(legacyPath, 'utf8')).schemaVersion, 1);
  const legacyJob: JobRequest = {
    ...projectJob,
    inputs: [{ type: 'fme/project+json', uri: pathToFileURL(legacyPath).href }],
  };

  assert.deepEqual(
    prepareJob(legacyJob, [dirname(legacyPath)]),
    prepareJob(projectJob, [exampleRoot]),
  );
});

test('probe devuelve indisponibilidad real con ruta inexistente', async (context) => {
  const { root } = setup(context);
  const adapter = createBlenderAdapter({ allowedRoots: [root], blenderPath: join(root, 'missing.exe') });
  const status = await adapter.probe();
  assert.equal(status.available, false);
  assert.equal(status.diagnostics[0]?.code, 'BLENDER_UNAVAILABLE');
});

test('rechaza operación, opciones, capa y rutas de trabajo no autorizadas antes de escribir', async (context) => {
  const { root, adapter, work } = setup(context);
  const outside = mkdirSync(join(root, 'not-allowed'), { recursive: true })!;
  const workCtx = work('job');
  const project = JSON.parse(readFileSync(examplePath, 'utf8'));
  project.assets.find((asset: { id: string }) => asset.id === 'objeto3d').uri = '../outside.glb';
  const invalidAssetProject = join(root, 'with-traversal.json');
  writeFileSync(invalidAssetProject, JSON.stringify(project));
  const invalidJobs: JobRequest[] = [
    { ...projectJob, operation: 'unsupported' },
    { ...projectJob, requirements: { layerId: 'capa-fondo' } },
    { ...projectJob, requirements: { layerId: 'capa-3d', resolution: '256/144' } },
    { ...projectJob, requirements: { layerId: 'capa-3d', script: 'load.py' } },
    { ...projectJob, inputs: [{ type: 'text/x-python', uri: examplePath }] },
    { ...projectJob, inputs: [{ type: 'fme/project+json', uri: pathToFileURL(invalidAssetProject).href }] },
    { ...projectJob, inputs: [{ type: 'fme/project+json', uri: pathToFileURL(invalidAssetProject).href.replace(
      'with-traversal.json', '%2e%2e/with-traversal.json',
    ) }] },
  ];
  const restricted = createBlenderAdapter({ allowedRoots: [workCtx.workDir, exampleRoot] });
  const results = [await restricted.run(projectJob, { ...workCtx, workDir: outside }),
    await restricted.run({ ...projectJob, inputs: [{ type: 'fme/project+json', uri: invalidAssetProject }] }, workCtx)];
  const junction = join(root, 'escape');
  symlinkSync(outside, junction, windows ? 'junction' : 'dir');
  results.push(await adapter.run(projectJob, { ...workCtx, workDir: junction }));
  for (const job of invalidJobs) results.push(await adapter.run(job, workCtx));

  for (const result of results) {
    assert.equal(result.status, 'failed');
    assert.equal(result.diagnostics[0]?.code, 'BLENDER_INVALID_JOB');
    assert.deepEqual(checkAdapterResult(result, adapter), []);
    assert.deepEqual(result.outputs, []);
  }
  assert.deepEqual(readdirSync(workCtx.workDir), []);
});

function decodeRgba(file: string): Buffer {
  return execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:v:0', '-frames:v', '1',
    '-c:v', 'rawvideo', '-threads:v', '1', '-pix_fmt', 'rgba', '-f', 'rawvideo', '-'], { windowsHide: true });
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

test('la capa 3D híbrida produce dos secuencias RGBA de 150 PNG con la misma procedencia de píxeles', { timeout: 210_000 }, async (context) => {
  const { adapter, work } = setup(context);
  const probe = await adapter.probe();
  if (!probe.available) {
    context.skip('Blender indisponible: ' + probe.diagnostics[0]?.message);
    return;
  }

  const first = await adapter.run(projectJob, work('hybrid-first'));
  const second = await adapter.run(projectJob, work('hybrid-second'));
  for (const run of [first, second]) {
    assert.equal(run.status, 'ok', JSON.stringify(run.diagnostics));
    assert.deepEqual(checkAdapterResult(run, adapter), []);
    assert.equal(run.outputs.length, 150);
    assert.equal(run.diagnostics[0]?.code, 'BLENDER_ASSET_MISSING');
    assert.equal(run.diagnostics[0]?.severity, 'warning');
    for (const [index, item] of run.provenance.entries()) {
      const path = fileURLToPath(item.uri);
      const bytes = readFileSync(path);
      assert.equal(basename(path), 'frame-' + String(index + 1).padStart(4, '0') + '.png');
      assert.equal(item.sha256, sha256(bytes));
      assert.equal(item.engineVersion, probe.engineVersion);
      assert.equal(item.seed, 2026);
      assert.equal(item.params.startFrame, 105);
      assert.equal(item.params.durationFrames, 150);
      assert.equal(bytes.readUInt32BE(16), preview.width);
      assert.equal(bytes.readUInt32BE(20), preview.height);
      assert.equal(bytes[25], 6);
    }
  }
  assert.deepEqual(first.provenance.map(({ contentSha256 }) => contentSha256),
    second.provenance.map(({ contentSha256 }) => contentSha256));
  assert.notEqual(first.provenance[0]?.contentSha256, first.provenance[149]?.contentSha256);

  try {
    execFileSync('ffmpeg', ['-version'], { windowsHide: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    context.diagnostic('FFmpeg ausente: la comprobación independiente de píxeles se omitió.');
    return;
  }
  for (const frame of [first.provenance[0]!, first.provenance[149]!]) {
    const pixels = decodeRgba(fileURLToPath(frame.uri));
    assert.equal(pixels.length, preview.width * preview.height * 4);
    assert.equal(pixels[3], 0);
    assert.ok(pixels.some((value, index) => index % 4 === 3 && value === 255));
    assert.equal(frame.contentSha256, sha256(pixels));
  }
});

function stillRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
    throw error;
  }
}

test('el timeout termina el proceso real de Blender y devuelve un diagnóstico', { timeout: 45_000 }, async (context) => {
  const { adapter, work } = setup(context);
  const probe = await adapter.probe();
  if (!probe.available) {
    context.skip('Blender indisponible: ' + probe.diagnostics[0]?.message);
    return;
  }

  const ctx = work('timeout', 50);
  const result = await adapter.run(projectJob, ctx);
  assert.equal(result.status, 'failed');
  assert.deepEqual(checkAdapterResult(result, adapter), []);
  assert.equal(result.diagnostics[0]?.code, 'BLENDER_TIMEOUT', JSON.stringify(result.diagnostics));
  const folder = readdirSync(ctx.workDir).find((name) => name.startsWith('fme-job-'));
  assert.ok(folder);
  const report = JSON.parse(readFileSync(join(ctx.workDir, folder, '.fme-worker', 'worker.json'), 'utf8'));
  assert.equal(report.timedOut, true);
  assert.equal(report.killed, true);
  assert.equal(typeof report.pid, 'number');
  const deadline = performance.now() + 2_000;
  while (stillRunning(report.pid) && performance.now() < deadline) await delay(25);
  assert.equal(stillRunning(report.pid), false);
});

function triangleGlb(): Buffer {
  const positions = Buffer.alloc(36);
  [-1, -1, 0, 1, -1, 0, 0, 1, 0].forEach((value, index) => positions.writeFloatLE(value, index * 4));
  const description = JSON.stringify({
    asset: { version: '2.0' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-1, -1, 0], max: [1, 1, 0] }],
    bufferViews: [{ buffer: 0, byteLength: positions.length, target: 34962 }],
    buffers: [{ byteLength: positions.length }],
  });
  const json = Buffer.from(description.padEnd(Math.ceil(description.length / 4) * 4));
  const glb = Buffer.alloc(28 + json.length + positions.length);
  glb.write('glTF', 0);
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(json.length, 12);
  glb.write('JSON', 16);
  json.copy(glb, 20);
  glb.writeUInt32LE(positions.length, 20 + json.length);
  glb.writeUInt32LE(0x004e4942, 24 + json.length);
  positions.copy(glb, 28 + json.length);
  return glb;
}

test('un GLB local existente se entrega al motor y desactiva el primitivo de sustitución', { timeout: 90_000 }, async (context) => {
  const { adapter, root, work } = setup(context);
  const probe = await adapter.probe();
  if (!probe.available) {
    context.skip('Blender indisponible: ' + probe.diagnostics[0]?.message);
    return;
  }

  const asset = { id: 'triangle', type: 'model3d', uri: 'triangle.glb' };
  const layer = { id: 'model', kind: 'model3d', assetId: asset.id, startFrame: 0, durationFrames: 1,
    zIndex: 0, techniques: ['3d'], channels: {} };
  const projectPath = join(root, 'local.fme.json');
  writeFileSync(join(root, asset.uri), triangleGlb());
  writeFileSync(projectPath, JSON.stringify({
    schemaVersion: 1, id: 'local-model', name: 'GLB local', fps: { num: 30_000, den: 1001 },
    width: 96, height: 54, seed: 42, assets: [asset],
    sequences: [{ id: 'seq', scenes: [{ id: 'scene', durationFrames: 1, layers: [layer] }] }],
  }));

  const run = await adapter.run({
    projectId: 'local-model', operation: projectJob.operation,
    inputs: [{ type: 'fme/project+json', uri: projectPath }], requirements: { layerId: layer.id }, seed: 15,
  }, work('glb-local'));
  assert.equal(run.status, 'ok', JSON.stringify(run.diagnostics));
  assert.deepEqual(checkAdapterResult(run, adapter), []);
  assert.deepEqual(run.diagnostics, []);
  assert.equal(run.outputs.length, 1);
  assert.equal(run.provenance[0]?.params.fallbackPrimitive, false);
  assert.equal(run.provenance[0]?.params.width, 96);
  assert.equal(run.provenance[0]?.params.fpsNum, 30_000);
  assert.equal(run.provenance[0]?.params.fpsDen, 1001);
  assert.equal(run.provenance[0]?.seed, 15);
});
