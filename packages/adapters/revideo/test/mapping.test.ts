// Mapeo de canales a la descripción de job de Revideo (sin motor).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { deserialize } from '@fme/project';
import type { Layer, Project } from '@fme/project';
import { MappingError, buildEngineJob, findLayer, sampleCurve, sampleGradientTracks, sampleTracks } from '../src/mapping.ts';

const fixture = new URL('../../../../examples/prueba-hibrida-10s/project.fme.json', import.meta.url);
function load(): Project {
  const r = deserialize(readFileSync(fixture, 'utf8'));
  assert.ok(r.ok, 'la fixture híbrida debe validar');
  return r.value;
}

const approx = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test('sampleCurve: sin curva usa el valor por defecto; sin claves, defaultValue', () => {
  assert.equal(sampleCurve(undefined, 5, 7), 7);
  assert.equal(sampleCurve({ defaultValue: 3, keyframes: [] }, 5, 7), 3);
});

test('sampleCurve: lineal, smooth y hold (el easing gobierna el tramo que llega a la clave)', () => {
  const lin = { defaultValue: 0, keyframes: [{ frame: 0, value: 0 }, { frame: 10, value: 10, easing: 'linear' as const }] };
  approx(sampleCurve(lin, 5, 0), 5);
  const smooth = { defaultValue: 0, keyframes: [{ frame: 0, value: 0 }, { frame: 10, value: 1, easing: 'smooth' as const }] };
  approx(sampleCurve(smooth, 5, 0), 0.5);
  approx(sampleCurve(smooth, 2.5, 0), 0.15625); // smoothstep(0.25)
  const hold = { defaultValue: 0, keyframes: [{ frame: 0, value: 2 }, { frame: 10, value: 9, easing: 'hold' as const }] };
  assert.equal(sampleCurve(hold, 9, 0), 2);
  assert.equal(sampleCurve(hold, 10, 0), 9);
});

test('sampleCurve: antes de la primera clave y tras la última se mantienen sus valores', () => {
  const c = { defaultValue: 0, keyframes: [{ frame: 5, value: 1 }, { frame: 8, value: 4 }] };
  assert.equal(sampleCurve(c, 0, 0), 1);
  assert.equal(sampleCurve(c, 100, 0), 4);
});

test('sampleCurve: ordena claves desordenadas', () => {
  const c = { defaultValue: 0, keyframes: [{ frame: 10, value: 10 }, { frame: 0, value: 0 }] };
  approx(sampleCurve(c, 5, 0), 5);
});

test('capa de título de la fixture híbrida: 120 fotogramas, opacidad smooth 0→1 en 20 y resto por defecto', () => {
  const project = load();
  const layer = findLayer(project, 'capa-titulo');
  const job = buildEngineJob(project, layer, { text: 'Título' });
  assert.equal(job.frames, 120);
  assert.equal(job.tracks.opacity.length, 120);
  assert.equal(job.tracks.opacity[0], 0);
  approx(job.tracks.opacity[10]!, 0.5);
  assert.equal(job.tracks.opacity[20], 1);
  assert.equal(job.tracks.opacity[119], 1);
  assert.ok(job.tracks.x.every((v) => v === 0) && job.tracks.scale.every((v) => v === 1) && job.tracks.rotation.every((v) => v === 0));
  assert.deepEqual([job.width, job.height, job.fps, job.kind, job.text], [1920, 1080, 30, 'text', 'Título']);
});

test('el título sale de layer.text (contenido, tipografía, tamaño y color) y requirements lo sobrescribe', () => {
  const project = load();
  const layer = findLayer(project, 'capa-titulo');
  assert.ok(layer.text, 'la fixture v2 trae el texto real');
  const job = buildEngineJob(project, layer);
  assert.equal(job.text, layer.text.content);
  assert.equal(job.fontFamily, layer.text.fontFamily);
  assert.equal(job.fontSize, layer.text.fontSize);
  assert.equal(job.fill, layer.text.color);
  const over = buildEngineJob(project, layer, { text: 'Otro', fontSize: 40, fill: '#ff0000' });
  assert.deepEqual([over.text, over.fontSize, over.fill], ['Otro', 40, '#ff0000']);
  assert.equal(over.fontFamily, layer.text.fontFamily);
});

test('sin layer.text ni sobrescritura: el nombre del proyecto (compatibilidad)', () => {
  const project = load();
  const { text: _omit, ...bare } = findLayer(project, 'capa-titulo');
  void _omit;
  const job = buildEngineJob(project, bare as Layer);
  assert.equal(job.text, project.name);
  assert.equal(job.fontFamily, undefined);
});

test('sampleTracks respeta x, y, scale y rotation', () => {
  const layer: Layer = {
    id: 'l', kind: 'text', startFrame: 50, durationFrames: 11, zIndex: 0, techniques: ['2d'],
    channels: {
      x: { defaultValue: 0, keyframes: [{ frame: 0, value: -100 }, { frame: 10, value: 100, easing: 'linear' }] },
      scale: { defaultValue: 1, keyframes: [{ frame: 0, value: 1 }, { frame: 10, value: 2, easing: 'linear' }] },
      rotation: { defaultValue: 0, keyframes: [{ frame: 0, value: 0 }, { frame: 10, value: 90, easing: 'linear' }] },
      y: { defaultValue: 12, keyframes: [] },
    },
  };
  const t = sampleTracks(layer);
  assert.equal(t.x.length, 11);
  assert.equal(t.x[0], -100);
  approx(t.x[5]!, 0);
  approx(t.scale[10]!, 2);
  approx(t.rotation[5]!, 45);
  assert.ok(t.y.every((v) => v === 12));
  assert.ok(t.opacity.every((v) => v === 1));
});

test('errores estructurados: capa inexistente, tipo no soportado y FPS distinto de 30', () => {
  const project = load();
  assert.throws(() => findLayer(project, 'nada'), (e) => e instanceof MappingError && e.code === 'layer-not-found');
  assert.throws(() => buildEngineJob(project, findLayer(project, 'capa-3d')), (e) => e instanceof MappingError && e.code === 'unsupported-layer');
  const ntsc: Project = { ...project, fps: { num: 30000, den: 1001 } };
  assert.throws(() => buildEngineJob(ntsc, findLayer(ntsc, 'capa-titulo')), (e) => e instanceof MappingError && e.code === 'unsupported-fps');
});

test('capa svg exige el contenido del SVG', () => {
  const project = load();
  const layer = findLayer(project, 'capa-2d'); // kind drawing
  assert.throws(() => buildEngineJob(project, layer), (e) => e instanceof MappingError && e.code === 'unsupported-layer');
  const job = buildEngineJob(project, layer, { svgMarkup: '<svg xmlns="http://www.w3.org/2000/svg"/>' });
  assert.equal(job.kind, 'svg');
  assert.equal(job.frames, 210);
});

test('gradientes: expression sube el contorno y integration baja la sombra por fotograma (FDN-061)', () => {
  const layer: Layer = {
    id: 'g', kind: 'text', startFrame: 0, durationFrames: 11, zIndex: 0, techniques: ['2d'],
    channels: {
      expression: { defaultValue: 0, keyframes: [{ frame: 0, value: 0 }, { frame: 10, value: 1, easing: 'linear' }] },
      integration: { defaultValue: 1, keyframes: [{ frame: 0, value: 1 }, { frame: 10, value: 0, easing: 'linear' }] },
    },
  };
  const g = sampleGradientTracks(layer, 7);
  assert.equal(g.strokeWidth.length, 11);
  for (let f = 1; f < 11; f++) {
    assert.ok(g.strokeWidth[f]! > g.strokeWidth[f - 1]!);
    assert.ok(g.shadowBlur[f]! < g.shadowBlur[f - 1]!);
  }
  assert.equal(g.strokeWidth[0], 0);
  assert.equal(g.shadowOpacity[10], 0);
  // El temblor es determinista (misma semilla → mismos valores) y acotado por la amplitud.
  assert.deepEqual(sampleGradientTracks(layer, 7), g);
  assert.notDeepEqual(sampleGradientTracks(layer, 8).jitterX, g.jitterX);
  assert.ok(g.jitterX.every((v, f) => Math.abs(v) <= 4 * (f / 10) + 1e-9));
});

test('buildEngineJob: sin curvas expression/integration no hay `gradients` (render idéntico al de FDN-032)', () => {
  const project = load();
  const { channels, ...rest } = findLayer(project, 'capa-titulo');
  const bare: Layer = { ...rest, channels: { opacity: channels.opacity! } };
  assert.equal(buildEngineJob(project, bare).gradients, undefined);
  assert.ok(buildEngineJob(project, findLayer(project, 'capa-titulo')).gradients, 'el título de la fixture tiene expression');
});
