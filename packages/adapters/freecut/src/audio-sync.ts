/**
 * Utilidad pura sin shell para medir propiedades de audio y sincronía A/V en archivos MP4
 * mediante `ffprobe` y `ffmpeg` (FDN-074a).
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const DEFAULT_AUDIO_SAMPLE_RATE = 48_000 as const;

export type MeasureAvSyncOptions = {
  ffprobePath?: string;
  ffmpegPath?: string;
  /** Activa decodificación de vídeo/audio para medir destello blanco y pulso acústico. */
  detectFlashAndPulse?: boolean;
  /** Umbral de luminancia media [0..255] para detectar el destello de vídeo (defecto 128). */
  flashLumaThreshold?: number;
  /** Umbral RMS [0..1] para detectar el pulso de audio; por defecto max(baselineRms * 3, 0.02). */
  pulseRmsThreshold?: number;
  /** Tamaño de ventana RMS en ms (defecto 1 ms). */
  windowMs?: number;
  /** Fin en segundos de la ventana inicial para medir `baselineRms` (defecto 0.8 s). */
  baselineEndSec?: number;
  timeoutMs?: number;
};

export type AvSyncMeasurement = {
  videoCodec: string | null;
  audioCodec: string | null;
  fps: number | null;
  frames: number | null;
  videoStartSec: number;
  audioStartSec: number;
  streamStartDeltaMs: number;
  audioSampleRate: number | null;
  audioChannels: number | null;
  audioDurationSec: number | null;
  videoDurationSec: number | null;
  videoFlashFrame: number | null;
  videoFlashSec: number | null;
  baselineRms: number | null;
  peakRms: number | null;
  audioPulseSec: number | null;
  avOffsetMs: number | null;
};

function runBinary(
  bin: string,
  args: readonly string[],
  timeoutMs: number,
  encoding: 'utf8' | 'buffer',
): Promise<string | Buffer> {
  return new Promise((resolveOut, rejectOut) => {
    execFile(
      bin,
      args,
      {
        shell: false,
        windowsHide: true,
        timeout: timeoutMs,
        maxBuffer: 64 * 1024 * 1024,
        encoding: encoding === 'buffer' ? 'buffer' : 'utf8',
      },
      (err, stdout, stderr) => {
        if (err) {
          const errText = Buffer.isBuffer(stderr)
            ? stderr.toString('utf8').trim()
            : String(stderr).trim();
          rejectOut(new Error(`Error ejecutando ${bin}: ${errText || err.message}`));
          return;
        }
        resolveOut(stdout);
      },
    );
  });
}

function parseFraction(raw: unknown): number | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const parts = raw.split('/');
  const num = Number(parts[0]);
  const den = parts.length === 2 ? Number(parts[1]) : 1;
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  return num / den;
}

function parseFinite(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const FLASH_WIDTH = 64;
const FLASH_HEIGHT = 36;
const FLASH_FRAME_BYTES = FLASH_WIDTH * FLASH_HEIGHT;

function detectVideoFlashFrame(grayBuffer: Buffer, threshold: number): number | null {
  const frameCount = Math.floor(grayBuffer.length / FLASH_FRAME_BYTES);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const offset = frame * FLASH_FRAME_BYTES;
    let sum = 0;
    for (let i = 0; i < FLASH_FRAME_BYTES; i += 1) {
      sum += grayBuffer[offset + i] ?? 0;
    }
    const mean = sum / FLASH_FRAME_BYTES;
    if (mean >= threshold) {
      return frame;
    }
  }
  return null;
}

function analyzeAudioPulse(
  pcmBuffer: Buffer,
  sampleRate: number,
  windowMs: number,
  baselineEndSec: number,
  explicitThreshold?: number,
): {
  baselineRms: number | null;
  peakRms: number | null;
  audioPulseSec: number | null;
} {
  const sampleCount = Math.floor(pcmBuffer.byteLength / 4);
  if (sampleCount === 0) {
    return { baselineRms: null, peakRms: null, audioPulseSec: null };
  }

  const alignedBytes = new Uint8Array(sampleCount * 4);
  alignedBytes.set(pcmBuffer.subarray(0, sampleCount * 4));
  const samples = new Float32Array(alignedBytes.buffer);

  const baselineSamples = Math.min(
    sampleCount,
    Math.max(0, Math.floor(baselineEndSec * sampleRate)),
  );
  let baselineRms = 0;
  if (baselineSamples > 0) {
    let sumSq = 0;
    for (let i = 0; i < baselineSamples; i += 1) {
      const s = samples[i] ?? 0;
      sumSq += s * s;
    }
    baselineRms = Math.sqrt(sumSq / baselineSamples);
  }

  const windowSamples = Math.max(1, Math.round((windowMs / 1000) * sampleRate));
  const windowCount = Math.floor(sampleCount / windowSamples);
  if (windowCount === 0) {
    return { baselineRms, peakRms: baselineRms, audioPulseSec: null };
  }

  const threshold = explicitThreshold ?? Math.max(baselineRms * 3, 0.02);
  let peakRms = 0;
  let audioPulseSec: number | null = null;

  for (let w = 0; w < windowCount; w += 1) {
    const startSample = w * windowSamples;
    let sumSq = 0;
    for (let j = 0; j < windowSamples; j += 1) {
      const s = samples[startSample + j] ?? 0;
      sumSq += s * s;
    }
    const rms = Math.sqrt(sumSq / windowSamples);
    if (rms > peakRms) peakRms = rms;
    if (audioPulseSec === null && rms >= threshold) {
      audioPulseSec = startSample / sampleRate;
    }
  }

  return { baselineRms, peakRms, audioPulseSec };
}

/**
 * Mide parámetros de stream (`ffprobe`) y opcionalmente la sincronía física entre
 * destello de vídeo y pulso de audio (`ffmpeg`) en un MP4 exportado.
 */
export async function measureAvSync(
  mp4Path: string,
  options: MeasureAvSyncOptions = {},
): Promise<AvSyncMeasurement> {
  const absPath = resolve(mp4Path);
  if (!existsSync(absPath)) {
    throw new Error(`No existe el archivo MP4 a medir: ${absPath}`);
  }

  const ffprobe = options.ffprobePath ?? process.env.FME_FFPROBE_PATH ?? 'ffprobe';
  const ffmpeg = options.ffmpegPath ?? process.env.FME_FFMPEG_PATH ?? 'ffmpeg';
  const timeoutMs = options.timeoutMs ?? 30_000;

  const probeJson = String(
    await runBinary(
      ffprobe,
      ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', absPath],
      timeoutMs,
      'utf8',
    ),
  );

  type RawStream = {
    codec_type?: string;
    codec_name?: string;
    r_frame_rate?: string;
    avg_frame_rate?: string;
    nb_frames?: string;
    start_time?: string;
    duration?: string;
    sample_rate?: string;
    channels?: number;
  };
  const parsed = JSON.parse(probeJson) as {
    streams?: RawStream[];
    format?: { duration?: string };
  };
  const streams = parsed.streams ?? [];
  const video = streams.find((s) => s.codec_type === 'video');
  const audio = streams.find((s) => s.codec_type === 'audio');

  const fps = parseFraction(video?.r_frame_rate) ?? parseFraction(video?.avg_frame_rate);
  const frames = parseFinite(video?.nb_frames);
  const videoStartSec = parseFinite(video?.start_time) ?? 0;
  const audioStartSec = parseFinite(audio?.start_time) ?? 0;
  const streamStartDeltaMs = (audioStartSec - videoStartSec) * 1000;
  const audioSampleRate = parseFinite(audio?.sample_rate);
  const audioChannels =
    typeof audio?.channels === 'number' && Number.isFinite(audio.channels)
      ? audio.channels
      : null;
  const videoDurationSec =
    parseFinite(video?.duration) ?? parseFinite(parsed.format?.duration);
  const audioDurationSec = parseFinite(audio?.duration);

  let videoFlashFrame: number | null = null;
  let videoFlashSec: number | null = null;
  let baselineRms: number | null = null;
  let peakRms: number | null = null;
  let audioPulseSec: number | null = null;
  let avOffsetMs: number | null = null;

  if (options.detectFlashAndPulse === true && video !== undefined && audio !== undefined) {
    const grayOut = await runBinary(
      ffmpeg,
      [
        '-v',
        'error',
        '-i',
        absPath,
        '-vf',
        `scale=${FLASH_WIDTH}:${FLASH_HEIGHT}`,
        '-f',
        'rawvideo',
        '-pix_fmt',
        'gray',
        '-',
      ],
      timeoutMs,
      'buffer',
    );
    const grayBuffer = Buffer.isBuffer(grayOut) ? grayOut : Buffer.from(grayOut);
    videoFlashFrame = detectVideoFlashFrame(
      grayBuffer,
      options.flashLumaThreshold ?? 128,
    );
    if (videoFlashFrame !== null && fps !== null && fps > 0) {
      videoFlashSec = videoFlashFrame / fps;
    }

    const pcmOut = await runBinary(
      ffmpeg,
      [
        '-v',
        'error',
        '-i',
        absPath,
        '-vn',
        '-f',
        'f32le',
        '-ar',
        String(DEFAULT_AUDIO_SAMPLE_RATE),
        '-ac',
        '1',
        '-',
      ],
      timeoutMs,
      'buffer',
    );
    const pcmBuffer = Buffer.isBuffer(pcmOut) ? pcmOut : Buffer.from(pcmOut);
    const pulseStats = analyzeAudioPulse(
      pcmBuffer,
      DEFAULT_AUDIO_SAMPLE_RATE,
      options.windowMs ?? 1,
      options.baselineEndSec ?? 0.8,
      options.pulseRmsThreshold,
    );
    baselineRms = pulseStats.baselineRms;
    peakRms = pulseStats.peakRms;
    audioPulseSec = pulseStats.audioPulseSec;

    if (audioPulseSec !== null && videoFlashSec !== null) {
      avOffsetMs = (audioPulseSec - videoFlashSec) * 1000;
    }
  }

  return {
    videoCodec: video?.codec_name ?? null,
    audioCodec: audio?.codec_name ?? null,
    fps,
    frames,
    videoStartSec,
    audioStartSec,
    streamStartDeltaMs,
    audioSampleRate,
    audioChannels,
    audioDurationSec,
    videoDurationSec,
    videoFlashFrame,
    videoFlashSec,
    baselineRms,
    peakRms,
    audioPulseSec,
    avOffsetMs,
  };
}
