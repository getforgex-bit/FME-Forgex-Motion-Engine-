import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkAdapterResult } from '@fme/connectors';
import { SCHEMA_VERSION, type Project } from '@fme/project';
import {
  FreeCutAdapter,
  MappingError,
  advanced,
  buildFreeCutComposeJob,
  buildFreeCutJob,
  newJobId,
  simple,
} from '../src/index.ts';
import { newWorkDir, probeWorkDir, workRoot } from './workroot.ts';

function createHybridComposeProject(dir: string): Project {
  mkdirSync(join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, 'assets', 'bg.mp4'), 'placeholder-bg');
  writeFileSync(join(dir, 'assets', 'bgm.wav'), 'placeholder-wav');
  writeFileSync(join(dir, 'assets', 'drawing.svg'), '<svg/>');
  writeFileSync(join(dir, 'assets', 'obj.glb'), 'glb-bytes');

  return {
    schemaVersion: SCHEMA_VERSION,
    id: 'proj-compose-unit',
    name: 'Compose Unit Test',
    fps: { num: 30, den: 1 },
    width: 1280,
    height: 720,
    seed: 7,
    assets: [
      { id: 'bg', type: 'video', uri: 'assets/bg.mp4' },
      { id: 'aud', type: 'audio', uri: 'assets/bgm.wav' },
      { id: 'vec', type: 'drawing', uri: 'assets/drawing.svg' },
      { id: 'm3d', type: 'model3d', uri: 'assets/obj.glb' },
    ],
    sequences: [
      {
        id: 'seq-1',
        scenes: [
          {
            id: 'esc-compose',
            durationFrames: 90,
            layers: [
              {
                id: 'titulo',
                kind: 'text',
                startFrame: 45,
                durationFrames: 30,
                zIndex: 4,
                techniques: ['2d'],
                channels: {},
                text: { content: 'Overlay Título' },
              },
              {
                id: 'capa-3d',
                kind: 'model3d',
                assetId: 'm3d',
                startFrame: 20,
                durationFrames: 40,
                zIndex: 3,
                techniques: ['3d'],
                channels: {},
              },
              {
                id: 'capa-2d',
                kind: 'drawing',
                assetId: 'vec',
                startFrame: 10,
                durationFrames: 50,
                sourceInFrame: 4,
                zIndex: 2,
                techniques: ['2d'],
                channels: {},
              },
              {
                id: 'capa-audio',
                kind: 'audio',
                assetId: 'aud',
                startFrame: 0,
                durationFrames: 90,
                zIndex: 1,
                techniques: ['2d'],
                channels: {},
              },
              {
                id: 'capa-fondo',
                kind: 'video',
                assetId: 'bg',
                startFrame: 0,
                durationFrames: 90,
                zIndex: 0,
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

test('cards: expone edit.compose y alinea capacidades empíricas de alpha', () => {
  assert.ok(simple.capabilities.includes('edit.compose'));
  assert.ok(simple.capabilities.includes('edit.export'));
  assert.equal(simple.accepts.includes('image/png-sequence'), false);

  assert.equal(advanced.technical.alpha, 'no');
  assert.equal(advanced.technical.alphaInputWebm, 'yes');
  assert.equal(advanced.technical.alphaInputProRes4444, 'yes');
  assert.equal(advanced.technical.alphaInputPng, 'yes');
  assert.equal(advanced.technical.pngSequenceInput, 'no');
  assert.equal(advanced.technical.multiTrackCompose, 'yes');
});

test('buildFreeCutComposeJob: resuelve inputs[] externos, ordena por zIndex y aplica opacity 0.999 en PNG alpha', () => {
  const dir = newWorkDir('compose-map');
  const extDir = newWorkDir('compose-ext');
  const project = createHybridComposeProject(dir);

  const proresMov = join(extDir, 'revideo-overlay.mov');
  const pngOverlay = join(extDir, 'blender-frame.png');
  writeFileSync(proresMov, 'mov-bytes');
  writeFileSync(pngOverlay, 'png-bytes');

  const job = buildFreeCutComposeJob(project, {
    sceneId: 'esc-compose',
    projectDir: dir,
    inputs: [
      { uri: proresMov, type: 'video/quicktime' },
      { uri: pngOverlay, type: 'image/png' },
    ],
    layerInputMap: {
      'capa-2d': proresMov,
      'capa-3d': pngOverlay,
    },
  });

  assert.equal(job.layers.length, 5);
  assert.deepEqual(
    job.layers.map((l) => l.id),
    ['capa-fondo', 'capa-audio', 'capa-2d', 'capa-3d', 'titulo'],
  );

  const capa2d = job.layers[2]!;
  assert.equal(capa2d.kind, 'video');
  if (capa2d.kind === 'video') {
    assert.equal(capa2d.startFrame, 10);
    assert.equal(capa2d.durationFrames, 50);
    assert.equal(capa2d.sourceInFrame, 4);
    assert.equal(capa2d.mimeType, 'video/quicktime');
  }

  const capa3d = job.layers[3]!;
  assert.equal(capa3d.kind, 'image');
  if (capa3d.kind === 'image') {
    assert.equal(capa3d.preserveAlpha, true);
    assert.equal(capa3d.opacity, 0.999);
    assert.equal(capa3d.mimeType, 'image/png');
  }
});

test('buildFreeCutComposeJob: rechaza path traversal en entradas y escapes de allowedInputRoots', () => {
  const dir = newWorkDir('compose-sec');
  const extDir = newWorkDir('compose-sec-ext');
  const outsideDir = newWorkDir('compose-sec-outside');
  const project = createHybridComposeProject(dir);

  const validMov = join(extDir, 'capa-2d.mov');
  const outsidePng = join(outsideDir, 'capa-3d.png');
  writeFileSync(validMov, 'mov');
  writeFileSync(outsidePng, 'png');

  assert.throws(
    () =>
      buildFreeCutComposeJob(project, {
        sceneId: 'esc-compose',
        projectDir: dir,
        layerInputMap: {
          'capa-2d': '../escape.mov',
          'capa-3d': outsidePng,
        },
      }),
    (e) => e instanceof MappingError && e.code === 'asset-outside-project',
  );

  assert.throws(
    () =>
      buildFreeCutComposeJob(project, {
        sceneId: 'esc-compose',
        projectDir: dir,
        inputs: [
          { uri: validMov, type: 'video/quicktime' },
          { uri: outsidePng, type: 'image/png' },
        ],
        allowedInputRoots: [dir, extDir],
      }),
    (e) => e instanceof MappingError && e.code === 'asset-outside-project',
  );
});

test('edit.compose: detecta image/png-sequence y falla con unsupported-alpha proponiendo alternativa sin simular', async () => {
  const dir = newWorkDir('compose-unsup-alpha');
  const seqDir = join(dir, 'png-seq');
  mkdirSync(seqDir, { recursive: true });
  writeFileSync(join(seqDir, '0001.png'), 'png1');

  const project = createHybridComposeProject(dir);
  const projPath = join(dir, 'project.fme.json');
  writeFileSync(projPath, JSON.stringify(project));

  const overlayWebm = join(dir, 'assets', 'overlay.webm');
  writeFileSync(overlayWebm, 'webm-bytes');

  const adapter = new FreeCutAdapter({
    freecutDir: join(workRoot, 'no-necesita-browser'),
    probeWorkDir,
  });

  const result = await adapter.run(
    {
      projectId: project.id,
      operation: 'edit.compose',
      inputs: [
        { uri: projPath, type: 'fme/project+json' },
        { uri: overlayWebm, type: 'video/webm' },
        { uri: seqDir, type: 'image/png-sequence' },
      ],
      requirements: {
        sceneId: 'esc-compose',
        'input.capa-2d': overlayWebm,
        'input.capa-3d': seqDir,
      },
    },
    { jobId: newJobId(), workDir: newWorkDir('ctx-unsup'), timeoutMs: 30_000 },
  );

  assert.equal(result.status, 'failed');
  assert.deepEqual(result.outputs, []);
  assert.deepEqual(result.provenance, []);
  assert.equal(result.diagnostics[0]?.code, 'unsupported-alpha');
  assert.match(result.diagnostics[0]?.message ?? '', /ProRes 4444|WebM VP9|FFmpeg/i);
  assert.deepEqual(checkAdapterResult(result, adapter), []);
});

test('edit.export sigue intacto y retrocompatible tras añadir edit.compose', () => {
  const dir = newWorkDir('compat-export');
  mkdirSync(join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, 'assets', 'bg.mp4'), 'mp4');

  const proj: Project = {
    schemaVersion: SCHEMA_VERSION,
    id: 'p-compat',
    name: 'Compat',
    fps: { num: 30, den: 1 },
    width: 1280,
    height: 720,
    seed: 1,
    assets: [{ id: 'v', type: 'video', uri: 'assets/bg.mp4' }],
    sequences: [
      {
        id: 's',
        scenes: [
          {
            id: 'sc',
            durationFrames: 30,
            layers: [
              {
                id: 'l1',
                kind: 'video',
                assetId: 'v',
                startFrame: 0,
                durationFrames: 30,
                zIndex: 0,
                techniques: ['2d'],
                channels: {},
              },
            ],
          },
        ],
      },
    ],
  };

  const job = buildFreeCutJob(proj, { sceneId: 'sc', projectDir: dir });
  assert.equal(job.layers.length, 1);
  assert.equal(job.layers[0]?.kind, 'video');
});
