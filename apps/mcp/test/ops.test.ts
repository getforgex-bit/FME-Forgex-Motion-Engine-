// FDN-080b: lógica compartida de preview (sin motor): perfil de 4 GB, rango de fotogramas y proyecto derivado.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, test } from 'node:test';
import { sampleCurve } from '@fme/adapter-revideo';
import { parseProject } from '@fme/project';
import { OpsError, buildPreviewProject, findLayer, loadProjectFile } from '../src/ops.ts';

const repo = resolve(import.meta.dirname, '..', '..', '..');
const hibrida = join(repo, 'examples', 'prueba-hibrida-10s', 'project.fme.json');
const scratch = mkdtempSync(join(tmpdir(), 'fme-ops-test-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

const { project } = loadProjectFile(hibrida);
const opts = { projectDir: join(repo, 'examples', 'prueba-hibrida-10s'), assetsDir: join(scratch, 'assets') };

test('preview del título: resolución del perfil de 4 GB y proyecto derivado válido', () => {
  const located = findLayer(project, 'capa-titulo');
  const build = buildPreviewProject(project, located, opts);
  assert.deepEqual([build.profile.width, build.profile.height], [960, 540]);
  assert.equal(build.scale, 0.5);
  assert.equal(build.project.width, 960);
  assert.equal(build.project.height, 540);
  assert.equal(parseProject(build.project).ok, true);
  const layer = build.project.sequences[0]!.scenes[0]!.layers[0]!;
  assert.equal(layer.id, 'capa-titulo');
  assert.equal(layer.durationFrames, 120);
  assert.equal(layer.text?.content, 'Forgex Motion Engine');
  assert.equal(layer.text?.fontSize, 48, 'fontSize 96 escalado a la mitad');
  assert.equal(layer.externalProject, undefined, 'sin enlaces a artefactos que el derivado no tiene');
  assert.equal(build.project.artifacts, undefined);
  assert.ok(build.plan.segments.some((s) => s.layerId === 'capa-titulo'));
});

test('rango de fotogramas: las curvas se muestrean exactamente y x/y se escalan', () => {
  // capa-2d es `drawing` con un asset de ejemplo inexistente: se usa como capa de texto con las mismas curvas.
  const p2 = structuredClone(project);
  const capa2d = findLayer(p2, 'capa-2d').layer;
  capa2d.kind = 'text';
  delete capa2d.assetId;
  const located = findLayer(p2, 'capa-2d');
  const full = located.layer;
  const build = buildPreviewProject(p2, located, { ...opts, startFrame: 40, endFrameExclusive: 80 });
  const layer = build.project.sequences[0]!.scenes[0]!.layers[0]!;
  assert.equal(layer.durationFrames, 40);
  assert.deepEqual(build.range, { startFrame: 40, endFrameExclusive: 80 });
  for (const f of [0, 1, 17, 39]) {
    assert.equal(sampleCurve(layer.channels.x, f, 0), sampleCurve(full.channels.x, f + 40, 0) * 0.5, `x en ${f}`);
    assert.equal(sampleCurve(layer.channels.expression, f, 0), sampleCurve(full.channels.expression, f + 40, 0), `expression en ${f}`);
    assert.equal(sampleCurve(layer.channels.integration, f, 0), sampleCurve(full.channels.integration, f + 40, 0), `integration en ${f}`);
  }
  assert.equal(layer.channels.volume, undefined);
});

test('rangos inválidos y capas inexistentes dan errores estructurados', () => {
  const located = findLayer(project, 'capa-titulo');
  for (const [s, e] of [[-1, 10], [10, 10], [0, 121], [5, 3], [1.5, 4]] as const) {
    assert.throws(() => buildPreviewProject(project, located, { ...opts, startFrame: s, endFrameExclusive: e }),
      (err) => err instanceof OpsError && err.code === 'INVALID_RANGE', `${s}-${e}`);
  }
  assert.throws(() => findLayer(project, 'nadie'), (err) => err instanceof OpsError && err.code === 'LAYER_NOT_FOUND');
  assert.throws(() => buildPreviewProject(project, located, { ...opts, vramBudgetMiB: 0.0001 }),
    (err) => err instanceof OpsError && err.code === 'PREVIEW_PLAN_FAILED');
});

test('un presupuesto de VRAM menor da una resolución menor', () => {
  const located = findLayer(project, 'capa-titulo');
  const small = buildPreviewProject(project, located, { ...opts, vramBudgetMiB: 270 });
  assert.ok(small.profile.width < 960, `ancho ${small.profile.width}`);
  assert.equal(small.project.width, small.profile.width);
});

test('capa svg: el asset se copia junto al proyecto derivado y no se admite salir de la carpeta', () => {
  const dir = join(scratch, 'svgproj');
  mkdirSync(join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, 'assets', 'f.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
  writeFileSync(join(scratch, 'fuera.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  const svgProject = structuredClone(project);
  svgProject.assets = [{ id: 'f', type: 'svg', uri: 'assets/f.svg' }, { id: 'o', type: 'svg', uri: '../fuera.svg' }];
  const scene = svgProject.sequences[0]!.scenes[0]!;
  scene.layers = [
    { id: 'svg1', kind: 'svg', assetId: 'f', startFrame: 0, durationFrames: 30, zIndex: 0, techniques: ['2d'], channels: {} },
    { id: 'svg2', kind: 'svg', assetId: 'o', startFrame: 0, durationFrames: 30, zIndex: 1, techniques: ['2d'], channels: {} },
  ];
  const out = join(scratch, 'svgout');
  const build = buildPreviewProject(svgProject, findLayer(svgProject, 'svg1'), { projectDir: dir, assetsDir: out });
  assert.equal(build.project.assets[0]!.uri, 'f.svg');
  assert.ok(existsSync(join(out, 'f.svg')));
  assert.equal(readFileSync(join(out, 'f.svg'), 'utf8').includes('svg'), true);
  assert.throws(() => buildPreviewProject(svgProject, findLayer(svgProject, 'svg2'), { projectDir: dir, assetsDir: out }),
    (err) => err instanceof OpsError && err.code === 'ASSET_OUTSIDE_PROJECT');
});
