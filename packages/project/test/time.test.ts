import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Fps } from '../src/index.ts';
import {
  framesToSeconds,
  framesToTimecode,
  rescaleFrames,
  secondsToFrames,
  timecodeToFrames,
} from '../src/time.ts';

const ntsc: Fps = { num: 30000, den: 1001 };
const fps30: Fps = { num: 30, den: 1 };
const fps60: Fps = { num: 60, den: 1 };

for (const fps of [{ num: 24, den: 1 }, { num: 25, den: 1 }, fps30, fps60, ntsc]) {
  test('ida y vuelta para cada fotograma de una hora a ' + fps.num + '/' + fps.den, () => {
    const lastFrame = Math.floor(3600 * fps.num / fps.den);
    for (let frame = 0; frame <= lastFrame; frame++) {
      const seconds = framesToSeconds(frame, fps);
      assert.equal(secondsToFrames(seconds, fps, 'nearest'), frame);
      assert.equal(timecodeToFrames(framesToTimecode(frame, fps), fps), frame);
      if (fps === ntsc) {
        assert.equal(timecodeToFrames(framesToTimecode(frame, fps, true), fps), frame);
      }

      // El destino usa una tasa mayor y recupera la posición original al volver.
      const upscaled = rescaleFrames(frame, fps, fps60);
      assert.equal(upscaled, Math.round(frame * fps.den * fps60.num / fps.num));
      assert.equal(rescaleFrames(upscaled, fps60, fps), frame);
    }
  });
}

test('cambia las etiquetas drop-frame en los límites de minuto, diez minutos, hora y día', () => {
  const cases = [
    [0, '00:00:00;00'],
    [1799, '00:00:59;29'],
    [1800, '00:01:00;02'],
    [1801, '00:01:00;03'],
    [3597, '00:01:59;29'],
    [3598, '00:02:00;02'],
    [17981, '00:09:59;29'],
    [17982, '00:10:00;00'],
    [17983, '00:10:00;01'],
    [19782, '00:11:00;02'],
    [107891, '00:59:59;29'],
    [107892, '01:00:00;00'],
    [2589407, '23:59:59;29'],
    [2589408, '24:00:00;00'],
  ] as const;

  for (const [frame, timecode] of cases) {
    assert.equal(framesToTimecode(frame, ntsc, true), timecode);
    assert.equal(timecodeToFrames(timecode, ntsc), frame);
  }
  const equivalentNtsc = { num: 60000, den: 2002 };
  assert.equal(framesToTimecode(1800, equivalentNtsc, true), '00:01:00;02');
  assert.equal(timecodeToFrames('00:01:00;02', equivalentNtsc), 1800);
});

test('usa los FPS físicos en segundos y los FPS nominales en timecode sin omisión', () => {
  assert.equal(framesToSeconds(30000, ntsc), 1001);
  assert.equal(secondsToFrames(1001, ntsc, 'nearest'), 30000);
  assert.equal(framesToTimecode(1800, ntsc), '00:01:00:00');
  assert.equal(timecodeToFrames('00:01:00:00', ntsc), 1800);
  assert.equal(framesToTimecode(108000, ntsc), '01:00:00:00');
  assert.equal(framesToSeconds(108000, ntsc), 3603.6);
  const max = Number.MAX_SAFE_INTEGER;
  assert.equal(timecodeToFrames(framesToTimecode(max, ntsc, true), ntsc), max);
  assert.equal(timecodeToFrames(framesToTimecode(max, fps60), fps60), max);
});

test('aplica piso, techo y empate al más cercano con segundos y fotogramas de ambos signos', () => {
  const cases = [
    [3, 1, 2, 2],
    [-3, -2, -1, -2],
    [1, 0, 1, 1],
    [-1, -1, 0, -1],
    [0, 0, 0, 0],
  ] as const;
  for (const [frame, floor, ceil, nearest] of cases) {
    const seconds = framesToSeconds(frame, fps60);
    assert.equal(secondsToFrames(seconds, fps30, 'floor'), floor);
    assert.equal(secondsToFrames(seconds, fps30, 'ceil'), ceil);
    assert.equal(secondsToFrames(seconds, fps30, 'nearest'), nearest);
    assert.equal(rescaleFrames(frame, fps60, fps30, 'floor'), floor);
    assert.equal(rescaleFrames(frame, fps60, fps30, 'ceil'), ceil);
    assert.equal(rescaleFrames(frame, fps60, fps30, 'nearest'), nearest);
    assert.equal(rescaleFrames(frame, fps60, fps30), nearest);
  }
  assert.equal(secondsToFrames(3600, ntsc, 'floor'), 107892);
  assert.equal(secondsToFrames(3600, ntsc, 'ceil'), 107893);
  assert.equal(secondsToFrames(3600, ntsc, 'nearest'), 107892);
  const slow = { num: 1, den: 2 };
  assert.equal(secondsToFrames(Number.MIN_VALUE, slow, 'ceil'), 1);
  assert.equal(secondsToFrames(-Number.MIN_VALUE, slow, 'floor'), -1);
});

test('las conversiones con segundos coinciden para FPS racionales equivalentes', () => {
  const value = Number.MAX_SAFE_INTEGER - 1;
  const unit = { num: 25, den: 25 };
  assert.equal(framesToSeconds(value, unit), value);
  assert.equal(secondsToFrames(value, unit, 'nearest'), value);

  const scaled = { num: 300000, den: 10010 };
  const frames = Number.MAX_SAFE_INTEGER - 3;
  assert.equal(framesToSeconds(frames, scaled), framesToSeconds(frames, ntsc));
  const seconds = framesToSeconds(frames, ntsc);
  assert.equal(secondsToFrames(seconds, scaled, 'nearest'), secondsToFrames(seconds, ntsc, 'nearest'));
});

test('reescalar conserva exactitud cuando los productos intermedios exceden Number', () => {
  const max = Number.MAX_SAFE_INTEGER;
  const highTerms = { num: max, den: max - 1 };
  const unit = { num: 1, den: 1 };
  assert.equal(rescaleFrames(max, highTerms, unit), max - 1);
  assert.equal(rescaleFrames(max, highTerms, unit, 'floor'), max - 1);
  assert.equal(rescaleFrames(max - 2, unit, highTerms, 'floor'), max - 2);
  assert.equal(rescaleFrames(max, ntsc, { num: 60000, den: 2002 }), max);
  assert.throws(() => rescaleFrames(max, unit, highTerms), RangeError);
});

test('rechaza tasas inválidas, fotogramas fuera de rango y segundos no finitos', () => {
  for (const fps of [
    { num: 0, den: 1 },
    { num: 30, den: 0 },
    { num: -30, den: 1 },
    { num: 29.97, den: 1 },
    { num: 30, den: NaN },
    { num: Infinity, den: 1 },
    { num: 30, den: Number.MAX_SAFE_INTEGER + 1 },
  ]) {
    assert.throws(() => framesToSeconds(0, fps), RangeError);
    assert.throws(() => secondsToFrames(0, fps, 'nearest'), RangeError);
    assert.throws(() => framesToTimecode(0, fps), RangeError);
    assert.throws(() => timecodeToFrames('00:00:00:00', fps), RangeError);
    assert.throws(() => rescaleFrames(0, fps, fps30), RangeError);
    assert.throws(() => rescaleFrames(0, fps30, fps), RangeError);
  }
  for (const frame of [0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => framesToSeconds(frame, fps30), RangeError);
    assert.throws(() => framesToTimecode(frame, fps30), RangeError);
    assert.throws(() => rescaleFrames(frame, fps30, fps60), RangeError);
  }
  for (const seconds of [NaN, Infinity, Number.MAX_VALUE]) {
    assert.throws(() => secondsToFrames(seconds, fps30, 'nearest'), RangeError);
  }
  assert.throws(() => framesToTimecode(-1, fps30), RangeError);
});

test('rechaza etiquetas omitidas, formatos inválidos y drop-frame a otra tasa', () => {
  for (const timecode of [
    '00:01:00;00',
    '00:01:00;01',
    '01:11:00;00',
    '00:60:00;00',
    '00:00:60;00',
    '00:00:00;30',
    '00:00:00:000',
    '00:00:00:00\n',
    '0:0:0:0',
    '-00:00:00:00',
    '9999999999999:00:00:00',
  ]) {
    assert.throws(() => timecodeToFrames(timecode, ntsc), RangeError);
  }
  assert.throws(() => framesToTimecode(0, fps30, true), RangeError);
  assert.throws(() => timecodeToFrames('00:00:00;00', fps30), RangeError);
});
