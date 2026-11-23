import { blenderGradientOps } from '@fme/art-direction';
import type { BlenderGradientOps } from '@fme/art-direction';
import type { Curve, Layer } from '@fme/project';

// Scene.frame_current y frame_end de Blender 5.2 tienen este máximo.
const maxBlenderFrames = 1_048_574;

function gradientSampler(curve: Curve | undefined, fallback: number): (frame: number) => number {
  if (!curve) return () => fallback;

  const byFrame = new Map(curve.keyframes.map((key) => [key.frame, key]));
  const keys = [...byFrame.values()].sort((a, b) => a.frame - b.frame);
  let index = 0;
  // El trabajo solicita los fotogramas ordenados, así cada clave se visita una vez.
  return (frame) => {
    while (keys[index + 1] && keys[index + 1]!.frame <= frame) index++;
    const left = keys[index];
    const right = keys[index + 1];
    if (!left || frame < left.frame) return curve.defaultValue;
    if (!right || right.easing === 'hold') return left.value;

    const progress = (frame - left.frame) / (right.frame - left.frame);
    const weight = right.easing === 'smooth' ? progress * progress * (3 - 2 * progress) : progress;
    return left.value * (1 - weight) + right.value * weight;
  };
}

export function prepareGradientOps(layer: Layer): BlenderGradientOps[] | undefined {
  const { expression, integration } = layer.channels;
  if (expression === undefined && integration === undefined) return undefined;
  if (layer.durationFrames > maxBlenderFrames) {
    throw new Error('La capa supera el límite de fotogramas de Blender para los gradientes.');
  }

  const sampleExpression = gradientSampler(expression, 0);
  const sampleIntegration = gradientSampler(integration, 1);
  return Array.from({ length: layer.durationFrames }, (_, frame) =>
    blenderGradientOps(sampleExpression(frame), sampleIntegration(frame)),
  );
}
