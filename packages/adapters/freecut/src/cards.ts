import type { CardAdvanced, CardSimple } from '@fme/connectors';

export const ADAPTER_VERSION = '0.0.0';

/** Tarjeta simple de FreeCut (FDN-012 / FDN-041). */
export const simple: CardSimple = {
  id: 'adapter.freecut',
  name: 'FreeCut',
  version: ADAPTER_VERSION,
  contractVersion: '0.1',
  capabilities: ['edit.export', 'edit.timeline', 'compose.video', 'render.video'],
  accepts: [
    'fme/project+json',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'audio/mpeg',
    'audio/aac',
    'audio/wav',
    'image/png',
  ],
  produces: ['video/mp4'],
  executor: 'cli',
};

/** Tarjeta avanzada fiel a los hallazgos verificados localmente en FDN-012. */
export const advanced: CardAdvanced = {
  pluginId: 'adapter.freecut',
  technical: {
    alpha: 'no',
    depth: 'no',
    keyframes: 'unknown',
    audio: 'yes',
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
    minFps: 1,
    maxFps: 240,
    browserNote: 'Requiere Chrome, Edge (msedge) o caché Playwright Chromium con WebGPU/WebCodecs',
  },
  permissions: ['fs:workspace', 'spawn:node', 'spawn:browser-headless', 'net:loopback-harness'],
  editability: 'native',
  licenseReview: 'pending',
};
