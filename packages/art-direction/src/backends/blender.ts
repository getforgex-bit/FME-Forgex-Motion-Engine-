/**
 * Traducción PROPUESTA de los gradientes a operaciones de Blender (FDN-061).
 *
 * Estado: PROPUESTO. Ningún adaptador la consume todavía (el código del adaptador Blender es de Codex) y no se ha
 * verificado con un render real. Solo se fija el vocabulario para que lo implemente una tarea posterior.
 *
 * - `expression` → grosor y opacidad de las líneas de Freestyle (contorno de dibujo).
 * - `integration` → mezcla del material físico con la iluminación de escena y fuerza de las sombras.
 */

export type BlenderGradientOps = {
  /** Grosor de línea de Freestyle, en px (0 = desactivado). */
  freestyleThickness: number;
  /** Opacidad de las líneas de Freestyle, 0–1. */
  freestyleAlpha: number;
  /** Mezcla del material hacia la iluminación de la escena, 0–1. */
  materialMix: number;
  /** Intensidad de la luz de relleno/sombra, 0–1. */
  shadowStrength: number;
};

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

export function blenderGradientOps(expression: number, integration: number): BlenderGradientOps {
  const e = clamp01(expression);
  const i = clamp01(integration);
  return { freestyleThickness: 4 * e, freestyleAlpha: e, materialMix: i, shadowStrength: i };
}
