import type { CardAdvanced, CardSimple } from '@fme/connectors';
import { DEFAULT_AUDIO_SAMPLE_RATE } from './audio-sync.ts';

export const ADAPTER_VERSION = '0.0.0';

/** Tarjeta simple de FreeCut (FDN-012 / FDN-041 / FDN-042a / FDN-074a). */
export const simple: CardSimple = {
  id: 'adapter.freecut',
  name: 'FreeCut',
  version: ADAPTER_VERSION,
  contractVersion: '0.1',
  capabilities: [
    'edit.export',
    'edit.compose',
    'edit.timeline',
    'compose.video',
    'render.video',
  ],
  accepts: [
    'fme/project+json',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'audio/mpeg',
    'audio/aac',
    'audio/wav',
    'audio/x-wav',
    'image/png',
  ],
  produces: ['video/mp4'],
  executor: 'cli',
};

/**
 * Tarjeta avanzada fiel a los hallazgos verificados localmente en FDN-012, FDN-042a y FDN-074a.
 *
 * Distingue `alpha: 'no'` (exportación MP4 yuv420p sin canal alfa) de los formatos
 * de entrada con alpha verificados en composición (`alphaInputWebm`, `alphaInputProRes4444`,
 * `alphaInputPng` con opacidad < 1 para evitar oclusión de pistas, y `pngSequenceInput: 'no'`),
 * así como el pipeline de audio fijado a 48 kHz AAC estéreo (`audioSampleRate48k`, `wavAudioInput`, `avSyncVerified`).
 */
export const advanced: CardAdvanced = {
  pluginId: 'adapter.freecut',
  technical: {
    alpha: 'no',
    alphaInputWebm: 'yes',
    alphaInputProRes4444: 'yes',
    alphaInputPng: 'yes',
    pngSequenceInput: 'no',
    multiTrackCompose: 'yes',
    depth: 'no',
    keyframes: 'unknown',
    audio: 'yes',
    audioSampleRate48k: 'yes',
    wavAudioInput: 'yes',
    avSyncVerified: 'yes',
    mp4Export: 'yes',
    h264Export: 'yes',
    aacAudioExport: 'yes',
    webmExport: 'unknown',
    webgpu: 'yes',
    webcodecs: 'yes',
    headlessCli: 'yes',
    headlessHttpApi: 'unknown',
    projectJsonImportExport: 'yes',
    reopenEditable: 'yes',
    deterministicContainer: 'no',
    deterministicOutput: 'unknown',
  },
  limits: {
    verifiedWidth: 1280,
    verifiedHeight: 720,
    verifiedFps: 30,
    verifiedFrames: 150,
    verifiedAudioSampleRate: DEFAULT_AUDIO_SAMPLE_RATE,
    minFps: 1,
    maxFps: 240,
    pngAlphaOpacityWorkaround: 0.999,
    browserNote: 'Requiere Chrome, Edge (msedge) o caché Playwright Chromium con WebGPU/WebCodecs',
  },
  permissions: ['fs:workspace', 'spawn:node', 'spawn:browser-headless', 'net:loopback-harness'],
  editability: 'native',
  licenseReview: 'pending',
};
