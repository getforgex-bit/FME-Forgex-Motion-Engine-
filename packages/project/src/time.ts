import type { Fps } from './index.js';

/** Redondeo al entero inferior, superior o más cercano (empates alejándose de cero). */
export type FrameRounding = 'floor' | 'ceil' | 'nearest';

const DROP_FRAMES = 2n;
const FRAMES_PER_DROP_MINUTE = 1798n;
const FRAMES_PER_TEN_MINUTES = 17982n;

function validateFps(fps: Fps): void {
  if (
    !fps ||
    !Number.isSafeInteger(fps.num) || fps.num <= 0 ||
    !Number.isSafeInteger(fps.den) || fps.den <= 0
  ) {
    throw new RangeError('Fps requiere numerador y denominador enteros seguros positivos.');
  }
}

function reduceFps(fps: Fps): Fps {
  validateFps(fps);
  let divisor = fps.num;
  let remainder = fps.den;
  while (remainder !== 0) {
    const nextRemainder = divisor % remainder;
    divisor = remainder;
    remainder = nextRemainder;
  }
  return { num: fps.num / divisor, den: fps.den / divisor };
}

function safeFrame(value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError('El número de fotograma debe ser un entero seguro.');
  }
  return value === 0 ? 0 : value;
}

/** Calcula los segundos de un fotograma directamente a partir del FPS racional. */
export function framesToSeconds(frames: number, fps: Fps): number {
  const { num, den } = reduceFps(fps);
  return safeFrame(frames) * den / num;
}

/** Aplica la política explícita al valor en fotogramas calculado con Number. */
export function secondsToFrames(seconds: number, fps: Fps, rounding: FrameRounding): number {
  const { num, den } = reduceFps(fps);
  if (!Number.isFinite(seconds)) {
    throw new RangeError('Los segundos deben ser finitos.');
  }
  const frames = seconds * num / den;

  switch (rounding) {
    case 'floor':
      return safeFrame(frames === 0 && seconds < 0 ? -1 : Math.floor(frames));
    case 'ceil':
      return safeFrame(frames === 0 && seconds > 0 ? 1 : Math.ceil(frames));
    case 'nearest':
      return safeFrame(Math.sign(frames) * Math.round(Math.abs(frames)));
    default:
      throw new RangeError('Política de redondeo de fotogramas desconocida.');
  }
}

/** Reescala la posición temporal con aritmética entera y redondea una sola vez. */
export function rescaleFrames(
  frames: number,
  fpsA: Fps,
  fpsB: Fps,
  rounding: FrameRounding = 'nearest',
): number {
  validateFps(fpsA);
  validateFps(fpsB);
  const numerator = BigInt(safeFrame(frames)) * BigInt(fpsA.den) * BigInt(fpsB.num);
  const denominator = BigInt(fpsA.num) * BigInt(fpsB.den);
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;

  switch (rounding) {
    case 'floor':
      return safeFrame(Number(remainder < 0n ? quotient - 1n : quotient));
    case 'ceil':
      return safeFrame(Number(remainder > 0n ? quotient + 1n : quotient));
    case 'nearest': {
      const direction = numerator < 0n ? -1n : 1n;
      const roundsAway = 2n * remainder * direction >= denominator;
      return safeFrame(Number(roundsAway ? quotient + direction : quotient));
    }
    default:
      throw new RangeError('Política de redondeo de fotogramas desconocida.');
  }
}

function nominalFps(fps: Fps, dropFrame: boolean): bigint {
  validateFps(fps);
  const numerator = BigInt(fps.num);
  const denominator = BigInt(fps.den);
  if (dropFrame && numerator * 1001n !== denominator * 30000n) {
    throw new RangeError('El timecode drop-frame requiere una tasa equivalente a 30000/1001.');
  }
  const nominal = (2n * numerator + denominator) / (2n * denominator);
  return nominal === 0n ? 1n : nominal;
}

function timecodeFrameWidth(rate: bigint): number {
  return Math.max(2, String(rate - 1n).length);
}

/** Formatea un fotograma no negativo con horas acumuladas, incluso después de 24 h. */
export function framesToTimecode(frames: number, fps: Fps, dropFrame = false): string {
  let label = BigInt(safeFrame(frames));
  if (label < 0n) {
    throw new RangeError('El timecode requiere un fotograma no negativo.');
  }
  const rate = nominalFps(fps, dropFrame);
  if (dropFrame) {
    const tenMinuteBlocks = label / FRAMES_PER_TEN_MINUTES;
    const remainingFrames = label % FRAMES_PER_TEN_MINUTES;
    // Tras un minuto completo, cada minuto del bloque comienza en la etiqueta ;02.
    const dropMinutes = remainingFrames < DROP_FRAMES
      ? 0n
      : (remainingFrames - DROP_FRAMES) / FRAMES_PER_DROP_MINUTE;
    label += DROP_FRAMES * (tenMinuteBlocks * 9n + dropMinutes);
  }

  const wholeSeconds = label / rate;
  const frame = String(label % rate).padStart(timecodeFrameWidth(rate), '0');
  const hour = String(wholeSeconds / 3600n).padStart(2, '0');
  const minute = String(wholeSeconds / 60n % 60n).padStart(2, '0');
  const second = String(wholeSeconds % 60n).padStart(2, '0');
  const separator = dropFrame ? ';' : ':';
  return hour + ':' + minute + ':' + second + separator + frame;
}

/** Lee HH:MM:SS:FF o HH:MM:SS;FF e interpreta el punto y coma como drop-frame. */
export function timecodeToFrames(timecode: string, fps: Fps): number {
  const match = timecode.match(/^(\d{2,}):([0-5]\d):([0-5]\d)([:;])(\d{2,})$/);
  if (!match || match[0] !== timecode) {
    throw new RangeError('El timecode debe usar el formato HH:MM:SS:FF o HH:MM:SS;FF.');
  }

  const hour = BigInt(match[1]!);
  const minute = BigInt(match[2]!);
  const second = BigInt(match[3]!);
  const dropFrame = match[4] === ';';
  const frameText = match[5]!;
  const rate = nominalFps(fps, dropFrame);
  if (frameText.length !== timecodeFrameWidth(rate) || BigInt(frameText) >= rate) {
    throw new RangeError('El campo de fotogramas está fuera de rango para el FPS nominal.');
  }
  const frame = BigInt(frameText);
  const totalMinutes = hour * 60n + minute;
  let count = (totalMinutes * 60n + second) * rate + frame;
  if (dropFrame) {
    if (totalMinutes % 10n !== 0n && second === 0n && frame < DROP_FRAMES) {
      throw new RangeError('El timecode drop-frame omite esa etiqueta.');
    }
    count -= DROP_FRAMES * (totalMinutes - totalMinutes / 10n);
  }
  return safeFrame(Number(count));
}
