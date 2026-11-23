import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { checkAdapterResult, type ConnectorAdapter, type JobRequest } from '@fme/connectors';
import { SCHEMA_VERSION, serialize, type Layer, type Project } from '@fme/project';
import { createBlenderAdapter } from '../../packages/adapters/blender/src/index.ts';
import { FreeCutAdapter } from '../../packages/adapters/freecut/src/index.ts';
import { RevideoAdapter } from '../../packages/adapters/revideo/src/index.ts';

const runFile = promisify(execFile);
const ffmpeg = process.env.FME_FFMPEG_PATH ?? 'ffmpeg';
const ffprobe = process.env.FME_FFPROBE_PATH ?? 'ffprobe';
const timeLimit = 120_000;
const smallCanvas = { width: 96, height: 64 };
const freecutCanvas = { width: 320, height: 240 };
const fps = 30;
const sha256 = /^[0-9a-f]{64}$/;
const candidateMode = process.env.FME_REGRESSION_CANDIDATES === '1';

type Engine = 'blender' | 'freecut' | 'revideo';

type Snapshot = {
  engineVersion: string;
  contentSha256: string[];
};

async function workRoot(t: TestContext): Promise<string> {
  const directory = await mkdtemp(join(await realpath(tmpdir()), 'fme-regresion-'));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 }));
  return directory;
}

function makeProject(engine: Engine, kind: Layer['kind'], durationFrames: number, canvas = smallCanvas): Project {
  const layer: Layer = { id: 'capa', kind, startFrame: 0, durationFrames, zIndex: 0,
    techniques: [kind === 'model3d' ? '3d' : '2d'], channels: {} };
  return {
    schemaVersion: SCHEMA_VERSION,
    id: 'regresion-' + engine,
    name: 'Regresión audiovisual',
    ...canvas, fps: { num: fps, den: 1 }, seed: 11,
    assets: [],
    sequences: [{ id: 'sec', scenes: [{ id: 'escena', durationFrames, layers: [layer] }] }],
  };
}

function quoteDiagnostic(diagnostics: readonly { code: string; message: string }[]): string {
  return diagnostics.map(({ code, message }) => code + ' ' + message).join(' | ');
}

async function probe(t: TestContext, adapter: ConnectorAdapter, unavailable: string): Promise<string | undefined> {
  const result = await adapter.probe();
  const detail = quoteDiagnostic(result.diagnostics);
  if (!result.available && result.diagnostics.length > 0 && result.diagnostics.every(({ code }) => code === unavailable)) {
    t.skip(adapter.simple.name + ' no disponible: ' + detail);
    return;
  }
  assert.ok(result.available && result.engineVersion, adapter.simple.name + ' no se pudo verificar: ' + detail);
  return result.engineVersion;
}

async function execute(adapter: ConnectorAdapter, root: string, project: Project, operation: string,
  requirements: JobRequest['requirements'], engineVersion: string) {
  const jobDirectory = await mkdtemp(join(root, 'job-'));
  const projectPath = join(root, project.id + '.fme.json');
  await writeFile(projectPath, serialize(project), 'utf8');
  const result = await adapter.run({
    projectId: project.id, operation, inputs: [{ uri: projectPath, type: 'fme/project+json' }],
    requirements, seed: project.seed,
  }, { jobId: project.id, workDir: jobDirectory, timeoutMs: timeLimit });
  assert.equal(result.status, 'ok', quoteDiagnostic(result.diagnostics));
  assert.deepEqual(checkAdapterResult(result, adapter), []);
  assert.ok(result.provenance.every((record) => record.engineVersion === engineVersion),
    'La versión del motor debe coincidir con la sondeada.');
  return result.provenance;
}

async function assertVideo(path: string, frames: number, canvas = smallCanvas): Promise<void> {
  const { stdout } = await runFile(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-count_frames',
    '-show_entries', 'stream=width,height,r_frame_rate,nb_read_frames', '-of', 'json', path],
  { timeout: 30_000, windowsHide: true });
  assert.deepEqual(JSON.parse(stdout).streams, [{ ...canvas, r_frame_rate: fps + '/1', nb_read_frames: String(frames) }]);
}

async function decodedVideoHash(path: string): Promise<string> {
  const { stdout } = await runFile(ffmpeg, ['-v', 'error', '-i', path, '-map', '0:v:0',
    '-c:v', 'rawvideo', '-pix_fmt', 'yuv420p', '-f', 'hash', '-hash', 'sha256', '-'],
  { timeout: 30_000, windowsHide: true });
  const hash = /^SHA256=([0-9a-f]{64})$/.exec(stdout.trim())?.[1];
  assert.ok(hash, 'FFmpeg no devolvió un SHA-256 de píxeles válido.');
  return hash;
}

function contentHash(value: string | undefined): string {
  assert.ok(value && sha256.test(value), 'Falta un SHA-256 de contenido de la procedencia.');
  return value;
}

function compareSnapshot(expected: Snapshot, actual: Snapshot): void {
  assert.equal(actual.engineVersion, expected.engineVersion, 'engineVersion cambió.');
  assert.deepEqual(actual.contentSha256, expected.contentSha256, 'contentSha256 cambió.');
}

async function baseline(t: TestContext, engine: Engine, snapshot: Snapshot): Promise<Snapshot> {
  if (candidateMode) {
    t.diagnostic('Candidato sin guardar ' + engine + ': ' + JSON.stringify(snapshot));
    return snapshot;
  }
  const path = new URL('./expected/' + engine + '.json', import.meta.url);
  const expected = JSON.parse(await readFile(path, 'utf8')) as Snapshot;
  compareSnapshot(expected, snapshot);
  return expected;
}

test('Blender · PNG RGBA y un cambio deliberado de cámara rompe el baseline', { timeout: 300_000 }, async (t) => {
  const root = await workRoot(t);
  const adapter = createBlenderAdapter({ allowedRoots: [root] });
  const engineVersion = await probe(t, adapter, 'BLENDER_UNAVAILABLE');
  if (engineVersion === undefined) return;

  const project = makeProject('blender', 'model3d', 3);
  const layer = project.sequences[0]!.scenes[0]!.layers[0]!;
  layer.channels.rotation = { defaultValue: 0, keyframes: [{ frame: 0, value: 0 }, { frame: 2, value: 12 }] };
  const render = async (value: Project): Promise<Snapshot> => {
    const provenance = await execute(adapter, root, value, 'render.image-sequence', { layerId: layer.id }, engineVersion);
    assert.equal(provenance.length, layer.durationFrames);
    return { engineVersion, contentSha256: provenance.map((record) => contentHash(record.contentSha256)) };
  };
  const expected = await baseline(t, 'blender', await render(project));

  layer.channels.rotation.defaultValue = 30;
  layer.channels.rotation.keyframes[0]!.value = 30;
  layer.channels.rotation.keyframes[1]!.value = 42;
  const modified = await render(project);
  assert.throws(() => compareSnapshot(expected, modified), { name: 'AssertionError', message: /contentSha256 cambió/ });
  t.diagnostic('La órbita de cámara +30° fue rechazada por el comparador.');
});

test('Revideo · MP4 de una ilustración SVG fija', { timeout: 180_000 }, async (t) => {
  const root = await workRoot(t);
  const cache = [
    process.env.FME_PUPPETEER_CACHE_DIR,
    fileURLToPath(new URL('../../examples/fase1/revideo/out/.puppeteer', import.meta.url)),
    join(homedir(), '.cache', 'puppeteer'),
  ].find((path) => path && existsSync(join(path, 'chrome')));
  const engineDir = process.env.FME_REVIDEO_ENGINE_DIR;
  const adapter = new RevideoAdapter({ probeWorkDir: root, ...(engineDir ? { engineDir } : {}),
    ...(cache ? { puppeteerCacheDir: cache } : {}) });
  const engineVersion = await probe(t, adapter, 'engine-missing');
  if (engineVersion === undefined) return;
  if (!cache) {
    t.skip('Revideo requiere una caché de Chrome. Usa FME_PUPPETEER_CACHE_DIR.');
    return;
  }

  const asset = { id: 'vector', type: 'svg', uri: 'vector.svg' } as const;
  await writeFile(join(root, asset.uri),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 64"><rect width="96" height="64" fill="#16324f"/><circle cx="42" cy="30" r="18" fill="#f5a623"/></svg>',
    'utf8');
  const project = makeProject('revideo', 'svg', 12);
  project.assets.push(asset);
  project.sequences[0]!.scenes[0]!.layers[0]!.assetId = asset.id;

  const provenance = await execute(adapter, root, project, 'render.video', { layerId: 'capa' }, engineVersion);
  assert.equal(provenance.length, 1);
  const path = fileURLToPath(provenance[0]!.uri);
  await assertVideo(path, 12);
  // Revideo no publica contentSha256. Se calcula con el mismo formato de píxeles que usa FreeCut.
  const hash = await decodedVideoHash(path);
  await baseline(t, 'revideo', { engineVersion, contentSha256: [hash] });
});

test('FreeCut · MP4 de una pista de vídeo sintético', { timeout: 180_000 }, async (t) => {
  const root = await workRoot(t);
  const adapter = new FreeCutAdapter({ probeWorkDir: root });
  const engineVersion = await probe(t, adapter, 'engine-missing');
  if (engineVersion === undefined) return;

  const frames = 12;
  const asset = { id: 'fondo', type: 'video', uri: 'fondo.mp4' } as const;
  const source = join(root, asset.uri);
  await runFile(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=30',
    '-frames:v', String(frames), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-threads', '1', source],
  { timeout: 30_000, windowsHide: true });

  const project = makeProject('freecut', 'video', frames, freecutCanvas);
  project.assets.push(asset);
  project.sequences[0]!.scenes[0]!.layers[0]!.assetId = asset.id;

  const provenance = await execute(adapter, root, project, 'edit.export', { sceneId: 'escena' }, engineVersion);
  assert.equal(provenance.length, 1);
  const output = provenance[0]!;
  const path = fileURLToPath(output.uri);
  await assertVideo(path, frames, freecutCanvas);
  const hash = contentHash(output.contentSha256);
  assert.equal(await decodedVideoHash(path), hash);
  await baseline(t, 'freecut', { engineVersion, contentSha256: [hash] });
});
