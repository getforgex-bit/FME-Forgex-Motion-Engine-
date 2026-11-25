import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkAdapterResult } from '@fme/connectors';
import { deserialize, SCHEMA_VERSION, type Project } from '@fme/project';
import {
  FreeCutAdapter,
  MappingError,
  advanced,
  buildDirectClipJob,
  buildFreeCutJob,
  newJobId,
  simple,
} from '../src/index.ts';
import { newWorkDir, probeWorkDir, workRoot } from './workroot.ts';

function createProjectFixture(projectDir: string): Project {
  mkdirSync(join(projectDir, 'assets'), { recursive: true });
  writeFileSync(join(projectDir, 'assets', 'bg.mp4'), 'placeholder-mp4');
  writeFileSync(join(projectDir, 'assets', 'bgm.wav'), 'placeholder-wav');

  return {
    schemaVersion: SCHEMA_VERSION,
    id: 'proj-fc-unit',
    name: 'Proyecto Unitario FreeCut',
    fps: { num: 30, den: 1 },
    width: 1280,
    height: 720,
    seed: 101,
    assets: [
      { id: 'v1', type: 'video', uri: 'assets/bg.mp4' },
      { id: 'a1', type: 'audio', uri: 'assets/bgm.wav' },
    ],
    sequences: [
      {
        id: 'seq-1',
        scenes: [
          {
            id: 'esc-1',
            durationFrames: 90,
            layers: [
              {
                id: 'titulo',
                kind: 'text',
                startFrame: 10,
                durationFrames: 60,
                zIndex: 2,
                techniques: ['2d'],
                channels: {},
                text: {
                  content: 'Hola FreeCut',
                  fontFamily: 'Inter',
                  fontSize: 64,
                  color: '#ffcc00',
                },
              },
              {
                id: 'fondo',
                kind: 'video',
                assetId: 'v1',
                startFrame: 0,
                durationFrames: 90,
                sourceInFrame: 5,
                zIndex: 0,
                techniques: ['2d'],
                channels: {},
              },
              {
                id: 'musica',
                kind: 'audio',
                assetId: 'a1',
                startFrame: 0,
                durationFrames: 90,
                zIndex: 1,
                techniques: ['2d'],
                channels: {},
              },
            ],
          },
        ],
      },
    ],
  };
}

test('tarjetas simple y advanced cumplen contrato 0.1 y hallazgos FDN-012', () => {
  assert.equal(simple.id, 'adapter.freecut');
  assert.equal(simple.contractVersion, '0.1');
  assert.equal(simple.executor, 'cli');
  assert.ok(simple.capabilities.includes('edit.export'));
  assert.ok(simple.accepts.includes('fme/project+json'));
  assert.ok(simple.produces.includes('video/mp4'));
  assert.equal(advanced.pluginId, simple.id);
  assert.equal(advanced.technical.alpha, 'no');
  assert.equal(advanced.technical.headlessCli, 'yes');
  assert.equal(advanced.technical.deterministicContainer, 'no');
  assert.equal(advanced.editability, 'native');
});

test('buildFreeCutJob: mapea proyecto v2 ordenando por zIndex y conservando layer.text (ADR-0012)', () => {
  const dir = newWorkDir('map-v2');
  const project = createProjectFixture(dir);

  const job = buildFreeCutJob(project, { sceneId: 'esc-1', projectDir: dir });
  assert.equal(job.sceneId, 'esc-1');
  assert.equal(job.fps, 30);
  assert.equal(job.durationFrames, 90);
  assert.deepEqual(
    job.layers.map((l) => l.id),
    ['fondo', 'musica', 'titulo'],
  );

  const fondo = job.layers[0]!;
  assert.equal(fondo.kind, 'video');
  if (fondo.kind === 'video') {
    assert.equal(fondo.sourceInFrame, 5);
    assert.ok(fondo.mediaPath.endsWith('bg.mp4'));
  }

  const titulo = job.layers[2]!;
  assert.equal(titulo.kind, 'text');
  if (titulo.kind === 'text') {
    assert.equal(titulo.text, 'Hola FreeCut');
    assert.equal(titulo.fontFamily, 'Inter');
    assert.equal(titulo.fontSize, 64);
    assert.equal(titulo.color, '#ffcc00');
  }
});

test('buildFreeCutJob: soporta proyecto v1 migrado vía deserialize', () => {
  const dir = newWorkDir('map-v1');
  mkdirSync(join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, 'assets', 'clip.mp4'), 'mp4');

  const v1Json = JSON.stringify({
    schemaVersion: 1,
    id: 'proj-v1',
    name: 'Proyecto Legacy v1',
    fps: { num: 30, den: 1 },
    width: 1280,
    height: 720,
    seed: 1,
    assets: [{ id: 'a-v1', type: 'video', uri: 'assets/clip.mp4' }],
    sequences: [
      {
        id: 's1',
        scenes: [
          {
            id: 'sc1',
            durationFrames: 60,
            layers: [
              {
                id: 'v-layer',
                kind: 'video',
                assetId: 'a-v1',
                startFrame: 0,
                durationFrames: 60,
                zIndex: 0,
                techniques: ['2d'],
                channels: {},
              },
              {
                id: 't-layer',
                kind: 'text',
                startFrame: 0,
                durationFrames: 60,
                zIndex: 1,
                techniques: ['2d'],
                channels: {},
              },
            ],
          },
        ],
      },
    ],
  });

  const parsed = deserialize(v1Json);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.schemaVersion, SCHEMA_VERSION);

  const job = buildFreeCutJob(parsed.value, { sceneId: 'sc1', projectDir: dir });
  assert.equal(job.layers.length, 2);
  const textLayer = job.layers[1]!;
  assert.equal(textLayer.kind, 'text');
  if (textLayer.kind === 'text') {
    assert.equal(textLayer.text, 'Proyecto Legacy v1');
  }
});

test('buildFreeCutJob y buildDirectClipJob: rechazan path traversal, escena inexistente y capas no soportadas', () => {
  const dir = newWorkDir('map-err');
  const project = createProjectFixture(dir);

  assert.throws(
    () => buildFreeCutJob(project, { sceneId: 'no-existe', projectDir: dir }),
    (e) => e instanceof MappingError && e.code === 'scene-not-found',
  );

  const traversalProject: Project = {
    ...project,
    assets: [{ id: 'v1', type: 'video', uri: '../secreto.mp4' }, project.assets[1]!],
  };
  assert.throws(
    () => buildFreeCutJob(traversalProject, { sceneId: 'esc-1', projectDir: dir }),
    (e) => e instanceof MappingError && e.code === 'asset-outside-project',
  );

  const absProject: Project = {
    ...project,
    assets: [{ id: 'v1', type: 'video', uri: 'C:\\Windows\\System32\\cmd.exe' }, project.assets[1]!],
  };
  assert.throws(
    () => buildFreeCutJob(absProject, { sceneId: 'esc-1', projectDir: dir }),
    (e) => e instanceof MappingError && e.code === 'asset-outside-project',
  );

  assert.throws(
    () =>
      buildDirectClipJob({
        clipPath: '../fuera.mp4',
        projectDir: dir,
        width: 1280,
        height: 720,
        fps: 30,
        durationFrames: 30,
      }),
    (e) => e instanceof MappingError && e.code === 'asset-outside-project',
  );

  const modelProject: Project = {
    ...project,
    assets: [{ id: 'm1', type: 'model3d', uri: 'assets/bg.mp4' }],
    sequences: [
      {
        id: 'seq-1',
        scenes: [
          {
            id: 'esc-3d',
            durationFrames: 30,
            layers: [
              {
                id: 'l3d',
                kind: 'model3d',
                assetId: 'm1',
                startFrame: 0,
                durationFrames: 30,
                zIndex: 0,
                techniques: ['3d'],
                channels: {},
              },
            ],
          },
        ],
      },
    ],
  };
  assert.throws(
    () => buildFreeCutJob(modelProject, { sceneId: 'esc-3d', projectDir: dir }),
    (e) => e instanceof MappingError && e.code === 'unsupported-layer',
  );
});

test('FreeCutAdapter: rechaza operación no soportada, requirements/inputs inválidos y freecutDir inexistente', async () => {
  const dir = newWorkDir('adapter-neg');
  const projPath = join(dir, 'project.fme.json');
  writeFileSync(projPath, JSON.stringify(createProjectFixture(dir)));

  const missingAdapter = new FreeCutAdapter({
    freecutDir: join(workRoot, 'no-existe-freecut'),
    probeWorkDir,
  });
  const p = await missingAdapter.probe();
  assert.equal(p.available, false);
  assert.equal(p.diagnostics[0]?.code, 'engine-missing');

  const ctx = () => ({ jobId: newJobId(), workDir: newWorkDir('ctx'), timeoutMs: 30_000 });

  const badOp = await missingAdapter.run(
    {
      projectId: 'p',
      operation: 'render.video',
      inputs: [{ uri: projPath, type: 'fme/project+json' }],
      requirements: { sceneId: 'esc-1' },
    },
    ctx(),
  );
  assert.equal(badOp.status, 'failed');
  assert.equal(badOp.diagnostics[0]?.code, 'unsupported-operation');
  assert.deepEqual(checkAdapterResult(badOp, missingAdapter), []);

  const badReq = await missingAdapter.run(
    {
      projectId: 'p',
      operation: 'edit.export',
      inputs: [{ uri: projPath, type: 'fme/project+json' }],
      requirements: {},
    },
    ctx(),
  );
  assert.equal(badReq.status, 'failed');
  assert.equal(badReq.diagnostics[0]?.code, 'bad-requirements');
  assert.deepEqual(checkAdapterResult(badReq, missingAdapter), []);

  const missingRun = await missingAdapter.run(
    {
      projectId: 'p',
      operation: 'edit.export',
      inputs: [{ uri: projPath, type: 'fme/project+json' }],
      requirements: { sceneId: 'esc-1' },
    },
    ctx(),
  );
  assert.equal(missingRun.status, 'failed');
  assert.equal(missingRun.diagnostics[0]?.code, 'engine-missing');
  assert.deepEqual(checkAdapterResult(missingRun, missingAdapter), []);
});
