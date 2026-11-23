import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { checkAdapterResult } from '@fme/connectors';
import { SCHEMA_VERSION, serialize, type Project } from '@fme/project';
import { DEFAULT_AUDIO_SAMPLE_RATE, FreeCutAdapter, measureAvSync, newJobId } from '../src/index.ts';
import { newWorkDir, probeWorkDir } from './workroot.ts';

const execFileAsync = promisify(execFile);
const adapter = new FreeCutAdapter({ probeWorkDir });
const probe = await adapter.probe();
const skip = !probe.available
  ? `FreeCut no disponible: ${probe.diagnostics.map((d) => d.message).join(' | ')}`
  : false;

const ffmpeg = process.env.FME_FFMPEG_PATH ?? 'ffmpeg';
const ffprobe = process.env.FME_FFPROBE_PATH ?? 'ffprobe';

async function runFfmpeg(args: string[]): Promise<void> {
  await execFileAsync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', ...args], {
    shell: false,
    windowsHide: true,
    encoding: 'buffer',
    timeout: 60_000,
    maxBuffer: 16 * 1024 * 1024,
  });
}

async function generateFlashBgMp4(targetPath: string, withBackgroundAudio: boolean): Promise<void> {
  const args = [
    '-f',
    'lavfi',
    '-i',
    "color=c=#000000:size=1280x720:rate=30:duration=3,drawbox=x=0:y=0:w=iw:h=ih:color=white:t=fill:enable='between(n,30,32)'",
  ];
  if (withBackgroundAudio) {
    args.push(
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=220:sample_rate=48000:duration=3',
      '-af',
      'aformat=channel_layouts=stereo,volume=-24dB',
      '-c:a',
      'aac',
      '-ar',
      '48000',
      '-ac',
      '2',
      '-b:a',
      '192k',
      '-shortest',
    );
  }
  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', '-map_metadata', '-1', targetPath);
  await runFfmpeg(args);
}

async function generatePulseWav(
  targetPath: string,
  options: { sampleRate: number; channels: number; amplitude: number },
): Promise<void> {
  const { sampleRate, channels, amplitude } = options;
  const layout = channels === 1 ? 'mono' : 'stereo';
  await runFfmpeg([
    '-f',
    'lavfi',
    '-i',
    `aevalsrc=${amplitude}*sin(2*PI*1000*t):s=${sampleRate}:d=0.1`,
    '-af',
    `aformat=channel_layouts=${layout}`,
    '-c:a',
    'pcm_s16le',
    '-ar',
    String(sampleRate),
    '-ac',
    String(channels),
    targetPath,
  ]);
}

test(
  'edit.compose mezcla audio embebido + WAV 48 kHz externo en startFrame 30 con desfase A/V <= 1 fotograma',
  { skip, timeout: 240_000 },
  async () => {
    const oursRe = /(?:freecut|playwright)/i;
    const tmpBefore = new Set(readdirSync(tmpdir()).filter((n) => oursRe.test(n)));

    const projDir = newWorkDir('av-sync-mix');
    const assetsDir = join(projDir, 'assets');
    const extDir = newWorkDir('av-sync-wav');
    mkdirSync(assetsDir, { recursive: true });

    const bgPath = join(assetsDir, 'bg-flash-220hz.mp4');
    const wavPath = join(extDir, 'pulse-48k.wav');
    await generateFlashBgMp4(bgPath, true);
    await generatePulseWav(wavPath, { sampleRate: 48_000, channels: 2, amplitude: 0.7079 });

    const project: Project = {
      schemaVersion: SCHEMA_VERSION,
      id: 'compose-av-sync-48k',
      name: 'Compose A/V Sync 48k',
      fps: { num: 30, den: 1 },
      width: 1280,
      height: 720,
      seed: 74,
      assets: [
        { id: 'bg', type: 'video', uri: 'assets/bg-flash-220hz.mp4' },
        { id: 'aud', type: 'audio', uri: 'assets/placeholder-pulse.wav' },
      ],
      sequences: [
        {
          id: 'seq-1',
          scenes: [
            {
              id: 'esc-sync',
              durationFrames: 90,
              layers: [
                {
                  id: 'fondo',
                  kind: 'video',
                  assetId: 'bg',
                  startFrame: 0,
                  durationFrames: 90,
                  zIndex: 0,
                  techniques: ['2d'],
                  channels: {},
                },
                {
                  id: 'pulso',
                  kind: 'audio',
                  assetId: 'aud',
                  startFrame: 30,
                  durationFrames: 3,
                  zIndex: 1,
                  techniques: ['2d'],
                  channels: {
                    volume: { defaultValue: 1, keyframes: [] },
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const projPath = join(projDir, 'project.sync.fme.json');
    writeFileSync(projPath, serialize(project), 'utf8');

    const ctx = { jobId: newJobId(), workDir: newWorkDir('av-sync-wd'), timeoutMs: 180_000 };
    const res = await adapter.run(
      {
        projectId: project.id,
        operation: 'edit.compose',
        inputs: [
          { uri: projPath, type: 'fme/project+json' },
          { uri: wavPath, type: 'audio/wav' },
        ],
        requirements: {
          sceneId: 'esc-sync',
          audioSampleRate: DEFAULT_AUDIO_SAMPLE_RATE,
          'input.pulso': wavPath,
        },
      },
      ctx,
    );

    assert.deepEqual(res.diagnostics, [], JSON.stringify(res.diagnostics));
    assert.equal(res.status, 'ok');
    assert.deepEqual(checkAdapterResult(res, adapter), []);
    assert.equal(res.provenance[0]?.params?.audioSampleRate, DEFAULT_AUDIO_SAMPLE_RATE);

    const outPath = fileURLToPath(res.outputs[0]!.uri);
    const sync = await measureAvSync(outPath, {
      ffmpegPath: ffmpeg,
      ffprobePath: ffprobe,
      detectFlashAndPulse: true,
    });

    assert.equal(sync.videoCodec, 'h264');
    assert.equal(sync.audioCodec, 'aac');
    assert.equal(sync.audioSampleRate, DEFAULT_AUDIO_SAMPLE_RATE);
    assert.equal(sync.audioChannels, 2);
    assert.ok(
      Math.abs(sync.streamStartDeltaMs) <= 33.34,
      `streamStartDeltaMs fuera de tolerancia: ${sync.streamStartDeltaMs} ms`,
    );
    assert.equal(sync.videoFlashFrame, 30, `videoFlashFrame inesperado: ${sync.videoFlashFrame}`);
    assert.ok(sync.avOffsetMs !== null, 'avOffsetMs no debe ser null');
    assert.ok(
      Math.abs(sync.avOffsetMs) <= 33.34,
      `avOffsetMs fuera de 1 fotograma (33.34 ms): ${sync.avOffsetMs} ms`,
    );
    assert.ok(
      sync.baselineRms !== null && sync.baselineRms > 0.001,
      `Audio embebido del vídeo de fondo no audible en baseline (RMS=${sync.baselineRms})`,
    );
    assert.ok(
      sync.peakRms !== null && sync.peakRms > sync.baselineRms * 5,
      `Pulso WAV en frame 30 no supera al fondo (baseline=${sync.baselineRms}, peak=${sync.peakRms})`,
    );

    const tmpAfter = readdirSync(tmpdir()).filter((n) => oursRe.test(n) && !tmpBefore.has(n));
    assert.deepEqual(tmpAfter, [], `Se fugaron directorios a os.tmpdir(): ${tmpAfter.join(', ')}`);
  },
);

test(
  'edit.compose remuestrea WAV no-48 kHz (22050 Hz mono, audio/x-wav) y aplica volume lineal a salida 48000 Hz',
  { skip, timeout: 240_000 },
  async () => {
    const oursRe = /(?:freecut|playwright)/i;
    const tmpBefore = new Set(readdirSync(tmpdir()).filter((n) => oursRe.test(n)));

    const projDir = newWorkDir('av-sync-22k');
    const assetsDir = join(projDir, 'assets');
    const extDir = newWorkDir('av-sync-wav22');
    mkdirSync(assetsDir, { recursive: true });

    const bgPath = join(assetsDir, 'bg-flash-silent.mp4');
    const wavPath = join(extDir, 'pulse-22050.wav');
    await generateFlashBgMp4(bgPath, false);
    await generatePulseWav(wavPath, { sampleRate: 22_050, channels: 1, amplitude: 0.7079 });

    const project: Project = {
      schemaVersion: SCHEMA_VERSION,
      id: 'compose-av-resample-48k',
      name: 'Compose Resample 22k to 48k',
      fps: { num: 30, den: 1 },
      width: 1280,
      height: 720,
      seed: 75,
      assets: [
        { id: 'bg', type: 'video', uri: 'assets/bg-flash-silent.mp4' },
        { id: 'aud22', type: 'audio', uri: 'assets/placeholder-pulse-22k.wav' },
      ],
      sequences: [
        {
          id: 'seq-1',
          scenes: [
            {
              id: 'esc-22k',
              durationFrames: 90,
              layers: [
                {
                  id: 'fondo',
                  kind: 'video',
                  assetId: 'bg',
                  startFrame: 0,
                  durationFrames: 90,
                  zIndex: 0,
                  techniques: ['2d'],
                  channels: {},
                },
                {
                  id: 'pulso22k',
                  kind: 'audio',
                  assetId: 'aud22',
                  startFrame: 30,
                  durationFrames: 3,
                  zIndex: 0,
                  techniques: ['2d'],
                  channels: {
                    volume: { defaultValue: 0.5, keyframes: [] },
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const projPath = join(projDir, 'project.22k.fme.json');
    writeFileSync(projPath, serialize(project), 'utf8');

    const ctx = { jobId: newJobId(), workDir: newWorkDir('av-sync-22k-wd'), timeoutMs: 180_000 };
    const res = await adapter.run(
      {
        projectId: project.id,
        operation: 'edit.compose',
        inputs: [
          { uri: projPath, type: 'fme/project+json' },
          { uri: wavPath, type: 'audio/x-wav' },
        ],
        requirements: {
          sceneId: 'esc-22k',
          audioSampleRate: DEFAULT_AUDIO_SAMPLE_RATE,
          'input.pulso22k': wavPath,
        },
      },
      ctx,
    );

    assert.deepEqual(res.diagnostics, [], JSON.stringify(res.diagnostics));
    assert.equal(res.status, 'ok');
    assert.deepEqual(checkAdapterResult(res, adapter), []);
    assert.equal(res.provenance[0]?.params?.audioSampleRate, DEFAULT_AUDIO_SAMPLE_RATE);

    const outPath = fileURLToPath(res.outputs[0]!.uri);
    const sync = await measureAvSync(outPath, {
      ffmpegPath: ffmpeg,
      ffprobePath: ffprobe,
      detectFlashAndPulse: true,
    });

    assert.equal(sync.videoCodec, 'h264');
    assert.equal(sync.audioCodec, 'aac');
    assert.equal(sync.audioSampleRate, DEFAULT_AUDIO_SAMPLE_RATE);
    assert.equal(sync.audioChannels, 2);
    assert.ok(
      Math.abs(sync.streamStartDeltaMs) <= 33.34,
      `streamStartDeltaMs fuera de tolerancia: ${sync.streamStartDeltaMs} ms`,
    );
    assert.equal(sync.videoFlashFrame, 30, `videoFlashFrame inesperado: ${sync.videoFlashFrame}`);
    assert.ok(sync.avOffsetMs !== null, 'avOffsetMs no debe ser null');
    assert.ok(
      Math.abs(sync.avOffsetMs) <= 33.34,
      `avOffsetMs fuera de 1 fotograma (33.34 ms): ${sync.avOffsetMs} ms`,
    );
    assert.ok(
      sync.baselineRms !== null && sync.baselineRms < 0.001,
      `El fondo mudo debería permanecer en silencio antes del pulso (baseline=${sync.baselineRms})`,
    );
    assert.ok(
      sync.peakRms !== null && sync.peakRms > 0.15 && sync.peakRms < 0.42,
      `Pulso remuestreado con volume=0.5 fuera de rango esperado (peak=${sync.peakRms})`,
    );

    const tmpAfter = readdirSync(tmpdir()).filter((n) => oursRe.test(n) && !tmpBefore.has(n));
    assert.deepEqual(tmpAfter, [], `Se fugaron directorios a os.tmpdir(): ${tmpAfter.join(', ')}`);
  },
);
