import type { CardAdvanced, CardSimple } from '@fme/connectors';

export const ADAPTER_VERSION = '0.0.0';

// Basadas en examples/fase1/revideo/card.*.json (FDN-010/016) y ajustadas a lo que hace este adaptador.
export const simple: CardSimple = {
  id: 'revideo',
  name: 'Revideo',
  version: ADAPTER_VERSION,
  contractVersion: '0.1',
  capabilities: ['render.video', 'render.video.alpha', 'animate.vector'],
  accepts: ['fme/project+json'],
  produces: ['video/mp4', 'video/quicktime'],
  executor: 'cli',
};

export const advanced: CardAdvanced = {
  pluginId: 'revideo',
  technical: {
    alpha: 'yes',
    depth: 'no',
    keyframes: 'yes',
    textLayers: 'yes',
    svgLayers: 'yes',
    pngSequenceHeadless: 'no',
    gpuAcceleration: 'no',
    audio: 'no',
    ntscFractionalFps: 'no',
    variableFps: 'no',
    deterministicOutput: 'yes',
    reopenEditable: 'no',
  },
  limits: {
    fps: 30,
    channels: 'x,y,opacity,scale,rotation',
    layerKinds: 'text,svg',
    alphaContainer: 'ProRes 4444 .mov (yuva444p12le)',
    ffmpeg: 'del sistema (ADR-0010; FME_FFMPEG_PATH o PATH)',
  },
  permissions: ['spawn:node', 'spawn:chrome-headless', 'spawn:ffmpeg', 'fs:write-workdir', 'net:localhost-vite'],
  editability: 'baked',
  // El ffmpeg del sistema es GPLv3 (ADR-0010, propuesta): pendiente de la auditoría de licencias de A0.
  licenseReview: 'pending',
};
