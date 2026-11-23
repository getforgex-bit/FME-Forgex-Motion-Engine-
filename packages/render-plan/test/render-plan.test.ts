import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { deserialize, type Project } from '@fme/project';
import { affectedSegments, planSceneRender } from '../src/index.ts';
import type { RenderPlan, RenderPlanOptions } from '../src/index.ts';

const fixturePath = new URL('../../../examples/prueba-hibrida-10s/project.fme.json', import.meta.url);
const options: RenderPlanOptions = { sequenceId: 'seq-1', sceneId: 'esc-1', segmentFrames: 60, vramBudgetMiB: 4096 };

function fixture(): Project {
  const result = deserialize(readFileSync(fixturePath, 'utf8'));
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

function scene(project: Project) {
  return project.sequences[0]!.scenes[0]!;
}

function layer(project: Project, id: string) {
  return scene(project).layers.find((item) => item.id === id)!;
}

function changedKeys(original: RenderPlan, updated: RenderPlan): string[] {
  const updatedKeys = new Map(updated.segments.map(({ id, cacheKey }) => [id, cacheKey]));
  return original.segments.filter(({ id, cacheKey }) => updatedKeys.get(id) !== cacheKey).map(({ id }) => id);
}

test('cubre exactamente los rangos de todas las capas de la fixture híbrida', () => {
  const project = fixture();
  const plan = planSceneRender(project, options);

  assert.equal(plan.segments.length, 19);
  assert.equal(new Set(plan.segments.map(({ id }) => id)).size, plan.segments.length);
  for (const layer of scene(project).layers) {
    const segments = plan.segments.filter(({ layerId }) => layerId === layer.id);
    let next = layer.startFrame;
    for (const segment of segments) {
      assert.equal(segment.startFrame, next);
      assert.ok(segment.endFrameExclusive > segment.startFrame);
      assert.ok(segment.endFrameExclusive - segment.startFrame <= options.segmentFrames);
      assert.match(segment.cacheKey, /^[0-9a-f]{64}$/);
      next = segment.endFrameExclusive;
    }
    assert.equal(next, layer.startFrame + layer.durationFrames);
  }
});

test('el plan es determinista, puro y usa el perfil efectivo en sus claves', () => {
  const project = fixture();
  const snapshot = structuredClone(project);
  const original = planSceneRender(project, options);
  assert.deepEqual(planSceneRender(project, options), original);
  assert.deepEqual(project, snapshot);
  assert.deepEqual(planSceneRender(project, { ...options, vramBudgetMiB: 8192 }), original);
  assert.ok(original.profile.estimatedVramBytes <= options.vramBudgetMiB * 2 ** 20);

  const lowerBudget = planSceneRender(project, { ...options, vramBudgetMiB: 280 });
  assert.ok(lowerBudget.profile.estimatedVramBytes <= 280 * 2 ** 20);
  assert.ok(lowerBudget.profile.width < original.profile.width);
  assert.deepEqual(lowerBudget.segments.map(({ id }) => id), original.segments.map(({ id }) => id));
  assert.deepEqual(changedKeys(original, lowerBudget), original.segments.map(({ id }) => id));

  const slower = { ...project, fps: { num: 30000, den: 1001 } };
  assert.deepEqual(changedKeys(original, planSceneRender(slower, options)), original.segments.map(({ id }) => id));
});

test('editar el contenido real del título v2 invalida solo sus segmentos', () => {
  const project = fixture();
  assert.equal(project.schemaVersion, 3);
  const original = planSceneRender(project, options);
  const title = layer(project, 'capa-titulo');
  assert.ok(title.text);
  title.text.content += ' · título nuevo';
  const updated = planSceneRender(project, options);

  const affected = affectedSegments(updated, [{ kind: 'layer', id: title.id }]);
  assert.deepEqual(affected.map(({ startFrame, endFrameExclusive }) => [startFrame, endFrameExclusive]),
    [[180, 240], [240, 300]]);
  assert.ok(affected.every(({ layerId }) => layerId === title.id));
  assert.deepEqual(changedKeys(original, updated), affected.map(({ id }) => id));
  assert.deepEqual(affectedSegments(updated, [{ kind: 'layer', id: 'no-existe' }]), []);
});

test('incluye el nombre del proyecto solo como texto de respaldo en capas sin contenido', () => {
  const project = fixture();
  const givenTitle = planSceneRender(project, options);
  const renamed = { ...project, name: 'Nombre actualizado' };
  assert.deepEqual(changedKeys(givenTitle, planSceneRender(renamed, options)), []);

  delete layer(project, 'capa-titulo').text;
  const withFallback = planSceneRender(project, options);
  const changed = planSceneRender(renamed, options);
  assert.deepEqual(changedKeys(withFallback, changed),
    withFallback.segments.filter(({ layerId }) => layerId === 'capa-titulo').map(({ id }) => id));
});

test('propaga cambios de la guía o su asset solo a ventanas guiadas superpuestas', () => {
  const project = fixture();
  const shortWindows = { ...options, segmentFrames: 30 };
  const original = planSceneRender(project, shortWindows);
  const guide = layer(project, 'capa-3d');
  const asset = project.assets.find(({ id }) => id === guide.assetId)!;
  asset.hash = 'hash-actualizado';
  const updated = planSceneRender(project, shortWindows);
  const changedAsset = { kind: 'asset', id: asset.id } as const;
  const affected = affectedSegments(updated, [changedAsset, changedAsset]);
  const titles = affected.filter(({ layerId }) => layerId === 'capa-titulo');

  assert.deepEqual(titles.map(({ startFrame }) => startFrame), [180, 210, 240]);
  assert.ok(affected.every(({ layerId }) => layerId === guide.id || layerId === 'capa-titulo'));
  assert.deepEqual(changedKeys(original, updated), affected.map(({ id }) => id));

  layer(project, 'capa-titulo').techniques = ['2d'];
  const unlinked = planSceneRender(project, shortWindows);
  assert.ok(affectedSegments(unlinked, [changedAsset]).every(({ layerId }) => layerId === guide.id));
});

test('las versiones y parámetros de adaptadores afectan solo a las capas que los usan', () => {
  const project = fixture();
  const original = planSceneRender(project, {
    ...options,
    layerInputs: {
      'capa-titulo': { adapters: [{ pluginId: 'adapter.revideo', version: '0.11.0' }] },
    },
  });
  const updated = planSceneRender(project, {
    ...options,
    layerInputs: {
      'capa-titulo': {
        adapters: [{ pluginId: 'adapter.revideo', version: '0.11.1' }],
        parameters: { transparent: true },
      },
    },
  });
  const changed = affectedSegments(updated, [{ kind: 'adapter', id: 'adapter.revideo' }]);
  assert.equal(changed.length, 2);
  assert.ok(changed.every(({ layerId }) => layerId === 'capa-titulo'));
  assert.deepEqual(changedKeys(original, updated), changed.map(({ id }) => id));
});

test('recorta las capas al final de la escena y permite ventanas vacías', () => {
  const project = fixture();
  const layers = scene(project).layers;
  const background = layer(project, 'capa-fondo');
  layers.push({ ...background, id: 'clipped', startFrame: 290, durationFrames: 40 });
  layers.push({ ...background, id: 'outside', startFrame: 305, durationFrames: 30 });
  layers.push({ ...background, id: 'empty', startFrame: 120, durationFrames: 0 });
  const plan = planSceneRender(project, options);
  assert.deepEqual(plan.segments.filter(({ layerId }) => layerId === 'clipped')
    .map(({ startFrame, endFrameExclusive }) => [startFrame, endFrameExclusive]), [[290, 300]]);
  assert.ok(!plan.segments.some(({ layerId }) => layerId === 'outside' || layerId === 'empty'));
  assert.throws(() => planSceneRender(project, { ...options, segmentFrames: 0 }), RangeError);
});

test('rechaza dependencias guiadas cíclicas y guías activas sin referencia válida', () => {
  const project = fixture();
  const guide = layer(project, 'capa-3d');
  const title = layer(project, 'capa-titulo');
  guide.techniques.push('2d-guided-by-3d');
  guide.guide3DLayerId = title.id;
  assert.throws(() => planSceneRender(project, options), /cíclica/);
  guide.guide3DLayerId = 'no-existe';
  assert.throws(() => planSceneRender(project, options), /no existe/);
});
