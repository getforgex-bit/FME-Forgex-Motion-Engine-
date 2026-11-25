// FDN-074 · criterio #7: exportación híbrida de 10 s con audio y sincronía A/V medida en los 3 pulsos (frames 30, 150 y 270).
// SKIP con motivo si falta alguno de los tres motores (Revideo, Blender o FreeCut) o la caché de Chrome para Puppeteer.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { DEFAULT_AUDIO_SAMPLE_RATE, measureAvSync } from '@fme/adapter-freecut';
import { RevideoAdapter } from '@fme/adapter-revideo';
import { checkAdapterResult } from '@fme/connectors';
import type { ArtifactProvenance } from '@fme/connectors';
import { deserialize, parseProject, serialize } from '@fme/project';
import { createHybridAdapters, runHybrid } from '../src/index.ts';
import type { HybridOptions } from '../src/index.ts';

const execFileAsync = promisify(execFile);
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const fixturePath = join(repo, 'examples', 'prueba-hibrida-10s', 'project.fme.json');
const phase1Cache = join(repo, 'examples', 'fase1', 'revideo', 'out', '.puppeteer');
const puppeteerCacheDir =
  process.env.FME_PUPPETEER_CACHE_DIR ?? (existsSync(phase1Cache) ? phase1Cache : undefined);
const revideoEngineDir = process.env.FME_REVIDEO_ENGINE_DIR;
const ffmpeg = process.env.FME_FFMPEG_PATH ?? 'ffmpeg';
const ffprobe = process.env.FME_FFPROBE_PATH ?? 'ffprobe';

const workRoot = join(fileURLToPath(new URL('../', import.meta.url)), '.test-work');
mkdirSync(workRoot, { recursive: true });
const newDir = (name: string): string => realpathSync(mkdtempSync(join(workRoot, `${name}-`)));

const W = 1280;
const H = 720;
const FPS = 30;
const FLASH_W = 64;
const FLASH_H = 36;
const FLASH_FRAME_BYTES = FLASH_W * FLASH_H;
const PULSE_FRAMES = [30, 150, 270] as const;

const probeDir = newDir('av-probe');
const revideoProbeDir = join(probeDir, 'revideo');
mkdirSync(revideoProbeDir, { recursive: true });
const injectedRevideo = new RevideoAdapter({
  ...(revideoEngineDir ? { engineDir: revideoEngineDir } : {}),
  probeWorkDir: revideoProbeDir,
  ...(ffmpeg !== 'ffmpeg' ? { ffmpegPath: ffmpeg } : {}),
  ...(ffprobe !== 'ffprobe' ? { ffprobePath: ffprobe } : {}),
  ...(puppeteerCacheDir ? { puppeteerCacheDir } : {}),
});

const hybridOptions: HybridOptions = {
  blenderResolution: '640x360',
  ...(puppeteerCacheDir ? { puppeteerCacheDir } : {}),
  adapters: { revideo: injectedRevideo },
};

const probes = await (async () => {
  const adapters = createHybridAdapters(probeDir, probeDir, {
    ...hybridOptions,
    probeWorkDir: join(probeDir, 'p'),
  });
  const missing: string[] = [];
  for (const [name, adapter] of Object.entries(adapters)) {
    const p = await adapter.probe();
    if (!p.available) {
      missing.push(`${name}: ${p.diagnostics.map((d) => d.message).join(' | ')}`);
    }
  }
  return missing;
})();

const skip =
  probes.length > 0
    ? `motor no disponible → ${probes.join(' || ')}`
    : !puppeteerCacheDir
      ? 'no se indicó dónde está Chrome (FME_PUPPETEER_CACHE_DIR)'
      : false;

async function runFfmpeg(args: string[]): Promise<Buffer> {
  const { stdout } = await execFileAsync(
    ffmpeg,
    ['-y', '-hide_banner', '-loglevel', 'error', ...args],
    {
      shell: false,
      windowsHide: true,
      encoding: 'buffer',
      timeout: 120_000,
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  return stdout;
}

type PulseMeasurement = {
  expectedFrame: number;
  expectedSec: number;
  flashFrame: number;
  flashSec: number;
  baselineRms: number;
  peakRms: number;
  audioPulseSec: number;
  avOffsetMs: number;
};

async function measureAllPulses(mp4Path: string): Promise<PulseMeasurement[]> {
  const grayBuf = await runFfmpeg([
    '-i',
    mp4Path,
    '-vf',
    `scale=${FLASH_W}:${FLASH_H}`,
    '-f',
    'rawvideo',
    '-pix_fmt',
    'gray',
    '-',
  ]);
  const totalVideoFrames = Math.floor(grayBuf.length / FLASH_FRAME_BYTES);
  const frameLuma = new Float64Array(totalVideoFrames);
  for (let f = 0; f < totalVideoFrames; f += 1) {
    const off = f * FLASH_FRAME_BYTES;
    let sum = 0;
    for (let i = 0; i < FLASH_FRAME_BYTES; i += 1) {
      sum += grayBuf[off + i] ?? 0;
    }
    frameLuma[f] = sum / FLASH_FRAME_BYTES;
  }

  const pcmBuf = await runFfmpeg([
    '-i',
    mp4Path,
    '-vn',
    '-f',
    'f32le',
    '-ar',
    String(DEFAULT_AUDIO_SAMPLE_RATE),
    '-ac',
    '1',
    '-',
  ]);
  const sampleCount = Math.floor(pcmBuf.byteLength / 4);
  const aligned = new Uint8Array(sampleCount * 4);
  aligned.set(pcmBuf.subarray(0, sampleCount * 4));
  const samples = new Float32Array(aligned.buffer);
  const winSamples = Math.max(1, Math.round(0.001 * DEFAULT_AUDIO_SAMPLE_RATE)); // 1 ms = 48 samples
  const winCount = Math.floor(sampleCount / winSamples);
  const rmsPerMs = new Float64Array(winCount);
  for (let w = 0; w < winCount; w += 1) {
    const start = w * winSamples;
    let sumSq = 0;
    for (let j = 0; j < winSamples; j += 1) {
      const s = samples[start + j] ?? 0;
      sumSq += s * s;
    }
    rmsPerMs[w] = Math.sqrt(sumSq / winSamples);
  }

  const results: PulseMeasurement[] = [];
  for (const expectedFrame of PULSE_FRAMES) {
    const expectedSec = expectedFrame / FPS;
    const minFrame = Math.max(0, expectedFrame - 15);
    const maxFrame = Math.min(totalVideoFrames - 1, expectedFrame + 30);
    let flashFrame = -1;
    for (let f = minFrame; f <= maxFrame; f += 1) {
      if ((frameLuma[f] ?? 0) > 128) {
        flashFrame = f;
        break;
      }
    }
    assert.ok(flashFrame >= 0, `No se detectó destello blanco alrededor del frame ${expectedFrame}`);
    const flashSec = flashFrame / FPS;

    const baseStartMs = Math.max(0, Math.round((expectedSec - 0.8) * 1000));
    const baseEndMs = Math.max(baseStartMs + 1, Math.min(winCount, Math.round((expectedSec - 0.2) * 1000)));
    let baseSq = 0;
    for (let ms = baseStartMs; ms < baseEndMs; ms += 1) {
      const v = rmsPerMs[ms] ?? 0;
      baseSq += v * v;
    }
    const baselineRms = Math.sqrt(baseSq / (baseEndMs - baseStartMs));
    const threshold = Math.max(baselineRms * 3, 0.02);

    const searchStartMs = Math.max(0, Math.round((expectedSec - 0.5) * 1000));
    const searchEndMs = Math.min(winCount, Math.round((expectedSec + 0.5) * 1000));
    let peakRms = 0;
    let pulseMs = -1;
    for (let ms = searchStartMs; ms < searchEndMs; ms += 1) {
      const rms = rmsPerMs[ms] ?? 0;
      if (rms > peakRms) peakRms = rms;
      if (pulseMs === -1 && rms >= threshold) {
        pulseMs = ms;
      }
    }
    assert.ok(pulseMs >= 0, `No se detectó pulso acústico en la ventana de ${expectedSec.toFixed(1)} s`);
    const audioPulseSec = pulseMs / 1000;
    const avOffsetMs = (audioPulseSec - flashSec) * 1000;

    results.push({
      expectedFrame,
      expectedSec,
      flashFrame,
      flashSec,
      baselineRms,
      peakRms,
      audioPulseSec,
      avOffsetMs,
    });
  }
  return results;
}

test(
  'exportación híbrida de 10 s (criterio #7): audio 48 kHz estéreo, streams alineados y desfase/deriva A/V <= 1 fotograma en los 3 pulsos',
  { skip, timeout: 1_800_000 },
  async () => {
    const inDir = newDir('av-in');
    mkdirSync(join(inDir, 'assets'), { recursive: true });

    const bgExpr =
      '0.02*sin(2*PI*220*t)+if(between(t\\,1.0\\,1.1)+between(t\\,5.0\\,5.1)+between(t\\,9.0\\,9.1)\\,0.7*sin(2*PI*1000*t)\\,0)';
    await runFfmpeg([
      '-f',
      'lavfi',
      '-i',
      `color=c=#000000:size=${W}x${H}:rate=${FPS}:duration=10,drawbox=x=0:y=0:w=iw:h=ih:color=white:t=fill:enable='between(n,30,32)+between(n,150,152)+between(n,270,272)'`,
      '-f',
      'lavfi',
      '-i',
      `aevalsrc=${bgExpr}|${bgExpr}:s=${DEFAULT_AUDIO_SAMPLE_RATE}:d=10`,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-r',
      String(FPS),
      '-g',
      '30',
      '-c:a',
      'aac',
      '-ar',
      String(DEFAULT_AUDIO_SAMPLE_RATE),
      '-ac',
      '2',
      '-b:a',
      '192k',
      '-shortest',
      join(inDir, 'assets', 'fondo.mp4'),
    ]);

    await runFfmpeg([
      '-f',
      'lavfi',
      '-i',
      `aevalsrc=0.01*sin(2*PI*110*t)|0.01*sin(2*PI*110*t):s=${DEFAULT_AUDIO_SAMPLE_RATE}:d=10`,
      '-c:a',
      'pcm_s16le',
      '-ar',
      String(DEFAULT_AUDIO_SAMPLE_RATE),
      '-ac',
      '2',
      join(inDir, 'assets', 'base.wav'),
    ]);

    writeFileSync(
      join(inDir, 'assets', 'ilustracion.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360"><circle cx="180" cy="180" r="170" fill="#000000"/></svg>',
      'utf8',
    );

    const parsed = deserialize(readFileSync(fixturePath, 'utf8'));
    assert.ok(parsed.ok);
    const project = { ...parsed.value, width: W, height: H };
    const projectPath = join(inDir, 'project.fme.json');
    writeFileSync(projectPath, serialize(project), 'utf8');

    const outDir = newDir('av-out');
    const t0 = Date.now();
    const result = await runHybrid(projectPath, outDir, hybridOptions);
    const elapsedSec = (Date.now() - t0) / 1000;
    assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics));
    assert.ok(result.mp4 && result.projectPath && result.project);

    // Verificar procedencia de los 3 adaptadores + paso ProRes y conformidad checkAdapterResult.
    const provIds = new Set(result.adaptersInProvenance);
    for (const id of ['revideo', 'adapter.blender', 'adapter.freecut', 'fme.pipeline.prores']) {
      assert.ok(provIds.has(id), `Falta ${id} en adaptersInProvenance: ${[...provIds].join(', ')}`);
    }
    const checkAdapters = createHybridAdapters(inDir, outDir, {
      ...hybridOptions,
      probeWorkDir: join(probeDir, 'check'),
    });
    const byId = {
      revideo: checkAdapters.revideo,
      'adapter.blender': checkAdapters.blender,
      'adapter.freecut': checkAdapters.freecut,
    } as const;
    for (const step of result.steps) {
      const adapter = byId[step.adapterId as keyof typeof byId];
      if (!adapter) continue;
      const issues = checkAdapterResult(
        {
          jobId: step.id,
          status: step.status,
          outputs: step.provenance.map((p: ArtifactProvenance) => ({ uri: p.uri, type: p.type })),
          provenance: step.provenance,
          diagnostics: step.diagnostics,
        },
        adapter,
      );
      assert.deepEqual(issues, [], `${step.id}: ${issues.join('; ')}`);
    }
    const savedRaw = JSON.parse(readFileSync(result.projectPath, 'utf8'));
    assert.ok(parseProject(savedRaw).ok, 'El proyecto guardado debe pasar parseProject');

    // Medición oficial con measureAvSync (@fme/adapter-freecut) sobre el MP4 final.
    const sync = await measureAvSync(result.mp4, {
      ffmpegPath: ffmpeg,
      ffprobePath: ffprobe,
      detectFlashAndPulse: true,
    });
    assert.equal(sync.frames, 300);
    assert.equal(sync.fps, 30);
    assert.equal(sync.videoCodec, 'h264');
    assert.equal(sync.audioCodec, 'aac');
    assert.equal(sync.audioSampleRate, DEFAULT_AUDIO_SAMPLE_RATE);
    assert.equal(sync.audioChannels, 2);
    assert.ok(
      Math.abs(sync.streamStartDeltaMs) <= 33.34,
      `streamStartDeltaMs fuera de 1 fotograma: ${sync.streamStartDeltaMs} ms`,
    );
    assert.equal(sync.videoFlashFrame, 30, `Primer flash inesperado: ${sync.videoFlashFrame}`);
    assert.ok(sync.avOffsetMs !== null, 'sync.avOffsetMs no debe ser null');
    assert.ok(
      Math.abs(sync.avOffsetMs) <= 33.34,
      `Primer pulso fuera de 1 fotograma: ${sync.avOffsetMs} ms`,
    );

    // Medición de los 3 pulsos (frames 30, 150, 270) y deriva a lo largo de los 10 s.
    const pulses = await measureAllPulses(result.mp4);
    assert.equal(pulses.length, 3);
    assert.equal(pulses[0]!.flashFrame, sync.videoFlashFrame);
    assert.ok(
      Math.abs(pulses[0]!.avOffsetMs - sync.avOffsetMs) < 1,
      `Pulso 1 (${pulses[0]!.avOffsetMs} ms) difiere de measureAvSync (${sync.avOffsetMs} ms)`,
    );

    for (const p of pulses) {
      assert.equal(p.flashFrame, p.expectedFrame, `Destello desplazado en frame ${p.expectedFrame}: ${p.flashFrame}`);
      assert.ok(
        Math.abs(p.avOffsetMs) <= 33.34,
        `Desfase A/V fuera de 1 fotograma en frame ${p.expectedFrame}: ${p.avOffsetMs} ms`,
      );
      assert.ok(
        p.peakRms > p.baselineRms * 5,
        `SNR insuficiente en frame ${p.expectedFrame}: baseline=${p.baselineRms}, peak=${p.peakRms}`,
      );
    }

    const offsets = pulses.map((p) => p.avOffsetMs);
    const endToEndDriftMs = Math.abs(pulses[2]!.avOffsetMs - pulses[0]!.avOffsetMs);
    const spreadMs = Math.max(...offsets) - Math.min(...offsets);
    assert.ok(
      endToEndDriftMs < 33.34,
      `Deriva pulso 3 vs pulso 1 >= 1 fotograma: ${endToEndDriftMs.toFixed(3)} ms`,
    );
    assert.ok(
      spreadMs < 33.34,
      `Rango total de offsets >= 1 fotograma: ${spreadMs.toFixed(3)} ms`,
    );

    console.log(
      'FDN-074_AV_SYNC_SUMMARY',
      JSON.stringify({
        elapsedSec: Number(elapsedSec.toFixed(2)),
        adaptersInProvenance: result.adaptersInProvenance,
        streams: {
          videoCodec: sync.videoCodec,
          audioCodec: sync.audioCodec,
          fps: sync.fps,
          frames: sync.frames,
          audioSampleRate: sync.audioSampleRate,
          audioChannels: sync.audioChannels,
          videoStartSec: sync.videoStartSec,
          audioStartSec: sync.audioStartSec,
          streamStartDeltaMs: Number(sync.streamStartDeltaMs.toFixed(3)),
          videoDurationSec: sync.videoDurationSec,
          audioDurationSec: sync.audioDurationSec,
        },
        measureAvSyncPulse1: {
          videoFlashFrame: sync.videoFlashFrame,
          videoFlashSec: sync.videoFlashSec,
          baselineRms: sync.baselineRms !== null ? Number(sync.baselineRms.toFixed(5)) : null,
          peakRms: sync.peakRms !== null ? Number(sync.peakRms.toFixed(5)) : null,
          audioPulseSec: sync.audioPulseSec,
          avOffsetMs: Number(sync.avOffsetMs.toFixed(3)),
        },
        pulses: pulses.map((p) => ({
          ...p,
          baselineRms: Number(p.baselineRms.toFixed(5)),
          peakRms: Number(p.peakRms.toFixed(5)),
          avOffsetMs: Number(p.avOffsetMs.toFixed(3)),
        })),
        endToEndDriftMs: Number(endToEndDriftMs.toFixed(3)),
        spreadMs: Number(spreadMs.toFixed(3)),
      }),
    );
  },
);
