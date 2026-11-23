import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { test } from 'node:test';
import { checkAdapterResult } from '@fme/connectors';
import { SCHEMA_VERSION, type Project } from '@fme/project';
import {
  DEFAULT_AUDIO_SAMPLE_RATE,
  FreeCutAdapter,
  MappingError,
  advanced,
  buildFreeCutComposeJob,
  buildFreeCutJob,
  measureAvSync,
  newJobId,
  simple,
} from '../src/index.ts';
import { newWorkDir, probeWorkDir, workRoot } from './workroot.ts';

function findBinary(name: string, envKey: string): string | undefined {
  const fromEnv = process.env[envKey];
  if (fromEnv) return fromEnv;
  const ext = process.platform === 'win32' ? '.exe' : '';
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (!dir) continue;
    const candidate = join(dir, name + ext);
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // ignore
    }
  }
  return undefined;
}

function createAudioComposeProject(dir: string): Project {
  mkdirSync(join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, 'assets', 'bg.mp4'), 'placeholder-bg');
  writeFileSync(join(dir, 'assets', 'base.wav'), 'placeholder-wav');

  return {
    schemaVersion: SCHEMA_VERSION,
    id: 'proj-audio-sync-unit',
    name: 'Audio Sync Unit',
    fps: { num: 30, den: 1 },
    width: 1280,
    height: 720,
    seed: 12,
    assets: [
      { id: 'v-bg', type: 'video', uri: 'assets/bg.mp4' },
      { id: 'a-base', type: 'audio', uri: 'assets/base.wav' },
      { id: 'a-pulse', type: 'audio', uri: 'assets/pulse-placeholder.wav' },
    ],
    sequences: [
      {
        id: 'seq-1',
        scenes: [
          {
            id: 'esc-av',
            durationFrames: 90,
            layers: [
              {
                id: 'fondo',
                kind: 'video',
                assetId: 'v-bg',
                startFrame: 0,
                durationFrames: 90,
                zIndex: 0,
                techniques: ['2d'],
                channels: {
                  volume: { defaultValue: 0.25, keyframes: [] },
                },
              },
              {
                id: 'audio-externo',
                kind: 'audio',
                assetId: 'a-pulse',
                startFrame: 30,
                durationFrames: 3,
                zIndex: 2,
                techniques: ['2d'],
                channels: {
                  volume: { defaultValue: 1.0, keyframes: [] },
                },
              },
              {
                id: 'audio-base',
                kind: 'audio',
                assetId: 'a-base',
                startFrame: 0,
                durationFrames: 90,
                zIndex: 1,
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
}

test('cards: declara audio 48 kHz, WAV y sincronía A/V verificada', () => {
  assert.ok(simple.accepts.includes('audio/wav'));
  assert.ok(simple.accepts.includes('audio/x-wav'));
  assert.equal(advanced.technical.audioSampleRate48k, 'yes');
  assert.equal(advanced.technical.wavAudioInput, 'yes');
  assert.equal(advanced.technical.avSyncVerified, 'yes');
  assert.equal(advanced.limits?.verifiedAudioSampleRate, 48_000);
  assert.equal(DEFAULT_AUDIO_SAMPLE_RATE, 48_000);
});

test('buildFreeCutComposeJob: soporta audio/wav y audio/x-wav en inputs[], audioSampleRate 48000, zIndex y volume', () => {
  const dir = newWorkDir('audio-map');
  const extDir = newWorkDir('audio-ext');
  const project = createAudioComposeProject(dir);

  const extWav = join(extDir, 'pulse.wav');
  writeFileSync(extWav, 'RIFF-wav-bytes');

  const jobWav = buildFreeCutComposeJob(project, {
    sceneId: 'esc-av',
    projectDir: dir,
    inputs: [{ uri: extWav, type: 'audio/wav' }],
    layerInputMap: { 'audio-externo': extWav },
  });

  assert.equal(jobWav.audioSampleRate, 48_000);
  assert.deepEqual(
    jobWav.layers.map((l) => l.id),
    ['fondo', 'audio-base', 'audio-externo'],
  );

  const fondo = jobWav.layers[0]!;
  assert.equal(fondo.kind, 'video');
  if (fondo.kind === 'video') {
    assert.equal(fondo.volume, 0.25);
  }

  const baseAudio = jobWav.layers[1]!;
  assert.equal(baseAudio.kind, 'audio');
  if (baseAudio.kind === 'audio') {
    assert.equal(baseAudio.volume, 0.5);
    assert.equal(baseAudio.mimeType, 'audio/wav');
  }

  const extAudio = jobWav.layers[2]!;
  assert.equal(extAudio.kind, 'audio');
  if (extAudio.kind === 'audio') {
    assert.equal(extAudio.startFrame, 30);
    assert.equal(extAudio.durationFrames, 3);
    assert.equal(extAudio.volume, 1.0);
    assert.equal(extAudio.mimeType, 'audio/wav');
  }

  // También acepta MIME audio/x-wav y audioSampleRate explícito 48000
  const jobXWav = buildFreeCutComposeJob(project, {
    sceneId: 'esc-av',
    projectDir: dir,
    audioSampleRate: 48_000,
    inputs: [{ uri: extWav, type: 'audio/x-wav' }],
    layerInputMap: { 'audio-externo': extWav },
  });
  assert.equal(jobXWav.audioSampleRate, 48_000);
  const extXWav = jobXWav.layers[2]!;
  if (extXWav.kind === 'audio') {
    assert.equal(extXWav.mimeType, 'audio/wav');
  }
});

test('rechaza audioSampleRate no soportado y volume negativo en mapping y FreeCutAdapter', async () => {
  const dir = newWorkDir('audio-neg');
  const project = createAudioComposeProject(dir);
  writeFileSync(join(dir, 'assets', 'pulse-placeholder.wav'), 'wav');

  assert.throws(
    () =>
      buildFreeCutJob(project, {
        sceneId: 'esc-av',
        projectDir: dir,
        audioSampleRate: 44_100,
      }),
    (e) => e instanceof MappingError && e.code === 'bad-requirements',
  );

  assert.throws(
    () =>
      buildFreeCutComposeJob(project, {
        sceneId: 'esc-av',
        projectDir: dir,
        audioSampleRate: 22_050,
      }),
    (e) => e instanceof MappingError && e.code === 'bad-requirements',
  );

  const badVolumeProj: Project = {
    ...project,
    sequences: [
      {
        id: 'seq-1',
        scenes: [
          {
            id: 'esc-av',
            durationFrames: 90,
            layers: project.sequences[0]!.scenes[0]!.layers.map((l) =>
              l.id === 'audio-base'
                ? { ...l, channels: { volume: { defaultValue: -0.5, keyframes: [] } } }
                : l,
            ),
          },
        ],
      },
    ],
  };

  assert.throws(
    () => buildFreeCutComposeJob(badVolumeProj, { sceneId: 'esc-av', projectDir: dir }),
    (e) => e instanceof MappingError && e.code === 'bad-layer',
  );

  const projPath = join(dir, 'project.fme.json');
  writeFileSync(projPath, JSON.stringify(project));
  const adapter = new FreeCutAdapter({
    freecutDir: join(workRoot, 'no-necesita-freecut'),
    probeWorkDir,
  });

  const res = await adapter.run(
    {
      projectId: project.id,
      operation: 'edit.compose',
      inputs: [{ uri: projPath, type: 'fme/project+json' }],
      requirements: { sceneId: 'esc-av', audioSampleRate: 44_100 },
    },
    { jobId: newJobId(), workDir: newWorkDir('ctx-rate'), timeoutMs: 30_000 },
  );
  assert.equal(res.status, 'failed');
  assert.equal(res.diagnostics[0]?.code, 'bad-requirements');
  assert.deepEqual(checkAdapterResult(res, adapter), []);
});

test('measureAvSync: mide flash en frame 30 (1.000 s) y pulso 1000 Hz sobre fondo 220 Hz a 48 kHz en MP4 sintético', async (t) => {
  const ffmpeg = findBinary('ffmpeg', 'FME_FFMPEG_PATH');
  const ffprobe = findBinary('ffprobe', 'FME_FFPROBE_PATH');
  if (!ffmpeg || !ffprobe) {
    t.skip('ffmpeg/ffprobe no disponibles en el entorno.');
    return;
  }

  const dir = newWorkDir('sync-synth');
  const mp4Path = join(dir, 'clapper.mp4');

  // Vídeo: negro 3s 30fps con cuadro blanco en t=[1.0, 1.1) -> frame 30..32
  // Audio: fondo 220Hz suave (-24 dB ~ 0.063) + pulso 1000Hz (-3 dB ~ 0.707) en t=[1.0, 1.1) a 48000 Hz
  execFileSync(
    ffmpeg,
    [
      '-y',
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'color=c=black:s=320x180:r=30:d=3',
      '-f',
      'lavfi',
      '-i',
      'color=c=white:s=320x180:r=30:d=0.1',
      '-f',
      'lavfi',
      '-i',
      'aevalsrc=0.05*sin(2*PI*220*t)+0.7*sin(2*PI*1000*t)*between(t\\,1.0\\,1.1):s=48000:d=3',
      '-filter_complex',
      "[0:v][1:v]overlay=0:0:enable='between(t,1.0,1.099)'[v]",
      '-map',
      '[v]',
      '-map',
      '2:a',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-ar',
      '48000',
      '-ac',
      '2',
      mp4Path,
    ],
    { shell: false, windowsHide: true },
  );

  const sync = await measureAvSync(mp4Path, {
    ffmpegPath: ffmpeg,
    ffprobePath: ffprobe,
    detectFlashAndPulse: true,
  });

  assert.equal(sync.videoCodec, 'h264');
  assert.equal(sync.audioCodec, 'aac');
  assert.equal(sync.fps, 30);
  assert.equal(sync.frames, 90);
  assert.equal(sync.audioSampleRate, 48_000);
  assert.equal(sync.audioChannels, 2);
  assert.equal(sync.videoFlashFrame, 30);
  assert.ok(sync.baselineRms !== null && sync.baselineRms > 0);
  assert.ok(sync.peakRms !== null && sync.baselineRms !== null && sync.peakRms > sync.baselineRms * 3);
  assert.ok(sync.avOffsetMs !== null && Math.abs(sync.avOffsetMs) <= 33.34);
  assert.ok(Math.abs(sync.streamStartDeltaMs) <= 33.34);
});
