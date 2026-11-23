/**
 * Traducción de los dos gradientes a operaciones observables de Revideo (FDN-061).
 *
 * Entradas normalizadas 0–1 (spec §4, independientes entre sí):
 * - `expression` (grafismo → cinematográfico): más expresión = contorno más grueso y opaco y más temblor (jitter) artesanal.
 * - `integration` (superposición → integración profunda): más integración = sombra proyectada más amplia, desplazada y opaca
 *   (la capa «recibe» iluminación de la escena en lugar de flotar encima).
 *
 * Funciones puras y monótonas: el mismo valor siempre da las mismas operaciones. Los valores fuera de 0–1 se recortan.
 */

export type RevideoGradientOps = {
  /** Grosor del contorno del texto, en px. 0 = sin contorno. */
  strokeWidth: number;
  /** Opacidad del contorno, 0–1. */
  strokeOpacity: number;
  /** Amplitud máxima del temblor de posición, en px (la dirección sale de una semilla determinista). */
  jitterAmplitude: number;
  /** Desenfoque de la sombra proyectada, en px. */
  shadowBlur: number;
  /** Desplazamiento de la sombra (abajo-derecha), en px. */
  shadowOffset: number;
  /** Opacidad de la sombra, 0–1. */
  shadowOpacity: number;
};

/** Rangos de la tabla de mapeo (se documentan en el README del paquete). */
export const REVIDEO_GRADIENT_RANGES = {
  strokeWidth: [0, 8],
  strokeOpacity: [0, 1],
  jitterAmplitude: [0, 4],
  shadowBlur: [0, 24],
  shadowOffset: [0, 18],
  shadowOpacity: [0, 0.8],
} as const;

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const lerp = ([a, b]: readonly [number, number], t: number): number => a + (b - a) * t;

export function revideoGradientOps(expression: number, integration: number): RevideoGradientOps {
  const e = clamp01(expression);
  const i = clamp01(integration);
  const r = REVIDEO_GRADIENT_RANGES;
  return {
    strokeWidth: lerp(r.strokeWidth, e),
    strokeOpacity: lerp(r.strokeOpacity, e),
    jitterAmplitude: lerp(r.jitterAmplitude, e),
    shadowBlur: lerp(r.shadowBlur, i),
    shadowOffset: lerp(r.shadowOffset, i),
    shadowOpacity: lerp(r.shadowOpacity, i),
  };
}
