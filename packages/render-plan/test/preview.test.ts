import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectPreviewProfile } from '../src/preview.ts';

const MiB = 1_048_576;

test('reduce una escena 1080p a preview a 4 GiB y devuelve la estimación reproducible', () => {
  const request = { width: 1920, height: 1080, vramBudgetMiB: 4096 };
  const profile = selectPreviewProfile(request);
  assert.deepEqual(profile, { width: 960, height: 540, samples: 8, estimatedVramBytes: 367_968_256 });
  assert.deepEqual(selectPreviewProfile({ ...request }), profile);
  assert.ok(profile.estimatedVramBytes <= request.vramBudgetMiB * MiB);
});

test('un presupuesto menor reduce muestras y, si hace falta, resolución', () => {
  const size = { width: 1920, height: 1080 };
  const sampleLimited = selectPreviewProfile({ ...size, vramBudgetMiB: 310 });
  assert.equal(sampleLimited.width, 960);
  assert.equal(sampleLimited.height, 540);
  assert.equal(sampleLimited.samples, 2);
  assert.ok(sampleLimited.estimatedVramBytes <= 310 * MiB);

  const resolutionLimited = selectPreviewProfile({ ...size, vramBudgetMiB: 280 });
  assert.ok(resolutionLimited.width < sampleLimited.width);
  assert.ok(resolutionLimited.height < sampleLimited.height);
  assert.equal(resolutionLimited.samples, 1);
  assert.ok(Math.abs(resolutionLimited.height - resolutionLimited.width * 9 / 16) <= 0.5);
  assert.ok(resolutionLimited.estimatedVramBytes <= 280 * MiB);
  const nextWidth = resolutionLimited.width + 1;
  assert.ok(256 * MiB + nextWidth * Math.round(nextWidth * 9 / 16) * 80 > 280 * MiB);
});

test('conserva orientación y no amplía ni aun con lados de un píxel o dimensiones grandes', () => {
  const landscape = selectPreviewProfile({ width: 1921, height: 1081, vramBudgetMiB: 4096 });
  const portrait = selectPreviewProfile({ width: 1081, height: 1921, vramBudgetMiB: 4096 });
  assert.equal(landscape.width, portrait.height);
  assert.equal(landscape.height, portrait.width);
  assert.equal(landscape.estimatedVramBytes, portrait.estimatedVramBytes);
  assert.equal(selectPreviewProfile({ width: 1, height: 2047, vramBudgetMiB: 4096 }).width, 1);

  const input = { width: Number.MAX_SAFE_INTEGER, height: Number.MAX_SAFE_INTEGER - 1, vramBudgetMiB: 4096 };
  const large = selectPreviewProfile(input);
  assert.ok(large.width <= input.width && large.height <= input.height);
  assert.ok(large.estimatedVramBytes <= input.vramBudgetMiB * MiB);
});

test('acepta el encaje exacto, rechaza el presupuesto imposible y rechaza entradas inválidas', () => {
  const minBytes = 256 * MiB + 80;
  assert.deepEqual(selectPreviewProfile({ width: 1, height: 1, vramBudgetMiB: minBytes / MiB }), {
    width: 1, height: 1, samples: 1, estimatedVramBytes: minBytes,
  });
  assert.throws(() => selectPreviewProfile({ width: 1280, height: 720, vramBudgetMiB: (minBytes - 1) / MiB }),
    { name: 'RangeError', message: /insuficiente/ });
  for (const width of [0, -1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => selectPreviewProfile({ width, height: 720, vramBudgetMiB: 4096 }), RangeError);
  }
  for (const vramBudgetMiB of [0, -1, Infinity, NaN, Number.MAX_VALUE]) {
    assert.throws(() => selectPreviewProfile({ width: 1280, height: 720, vramBudgetMiB }), RangeError);
  }
});
