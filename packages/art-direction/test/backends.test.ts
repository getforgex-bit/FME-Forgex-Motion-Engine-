// Traducción de gradientes y técnicas a operaciones por backend (FDN-061). Sin motor.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blenderGradientOps, depthScale, parallaxFactor, revideoGradientOps, supportedTechniques, techniqueSupport } from '../src/backends/index.ts';

const steps = [0, 0.25, 0.5, 0.75, 1];

test('Revideo: expression sube contorno y jitter de forma monótona sin tocar la sombra', () => {
  const ops = steps.map((e) => revideoGradientOps(e, 0.5));
  for (let k = 1; k < ops.length; k++) {
    assert.ok(ops[k]!.strokeWidth > ops[k - 1]!.strokeWidth);
    assert.ok(ops[k]!.strokeOpacity > ops[k - 1]!.strokeOpacity);
    assert.ok(ops[k]!.jitterAmplitude > ops[k - 1]!.jitterAmplitude);
    assert.equal(ops[k]!.shadowBlur, ops[0]!.shadowBlur);
  }
  assert.equal(ops[0]!.strokeWidth, 0);
});

test('Revideo: integration sube la sombra de forma monótona sin tocar el contorno (gradientes independientes)', () => {
  const ops = steps.map((i) => revideoGradientOps(0.5, i));
  for (let k = 1; k < ops.length; k++) {
    assert.ok(ops[k]!.shadowBlur > ops[k - 1]!.shadowBlur);
    assert.ok(ops[k]!.shadowOffset > ops[k - 1]!.shadowOffset);
    assert.ok(ops[k]!.shadowOpacity > ops[k - 1]!.shadowOpacity);
    assert.equal(ops[k]!.strokeWidth, ops[0]!.strokeWidth);
  }
  assert.deepEqual([ops[0]!.shadowBlur, ops[0]!.shadowOpacity], [0, 0]);
});

test('valores fuera de 0–1 o no finitos se recortan; es determinista', () => {
  assert.deepEqual(revideoGradientOps(-3, 9), revideoGradientOps(0, 1));
  assert.deepEqual(revideoGradientOps(Number.NaN, Number.POSITIVE_INFINITY), revideoGradientOps(0, 0));
  assert.deepEqual(revideoGradientOps(0.3, 0.7), revideoGradientOps(0.3, 0.7));
});

test('Blender (propuesto): freestyle sigue a expression y el material a integration', () => {
  const a = blenderGradientOps(0, 1);
  const b = blenderGradientOps(1, 0);
  assert.deepEqual([a.freestyleThickness, a.materialMix], [0, 1]);
  assert.deepEqual([b.freestyleThickness, b.materialMix], [4, 0]);
});

test('técnicas: soporte explícito, `unknown` donde no hay evidencia y copia defensiva', () => {
  assert.equal(techniqueSupport('revideo', '2d').support, 'yes');
  assert.equal(techniqueSupport('revideo', '3d').support, 'no');
  assert.equal(techniqueSupport('blender', '3d').support, 'yes');
  assert.equal(techniqueSupport('blender', '2.5d').support, 'unknown');
  assert.deepEqual(supportedTechniques('revideo'), ['2d', '2.5d', '2d-guided-by-3d', '3d-with-2d']);
  const t = techniqueSupport('revideo', '2d');
  t.support = 'no';
  assert.equal(techniqueSupport('revideo', '2d').support, 'yes');
});

test('2.5d: el parallax y la escala decrecen de forma monótona con la profundidad', () => {
  const depths = [0, 0.5, 1, 2, 4, 8];
  for (let k = 1; k < depths.length; k++) {
    assert.ok(parallaxFactor(depths[k]!) < parallaxFactor(depths[k - 1]!));
    assert.ok(depthScale(depths[k]!) < depthScale(depths[k - 1]!));
  }
  assert.equal(parallaxFactor(0), 1);
  assert.equal(parallaxFactor(1), 0.5);
  assert.equal(depthScale(0), 1);
  assert.equal(parallaxFactor(-5), 1);
  assert.equal(parallaxFactor(Number.NaN), 1);
});
