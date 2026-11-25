/**
 * Técnica `2.5d` (FDN-063): planos con parallax por profundidad.
 *
 * `depth` ≥ 0 (0 = plano más cercano, sin atenuación). Un plano a profundidad `d` se desplaza con el movimiento de cámara
 * (canales `x`/`y` de la capa) `parallaxFactor(d)` veces lo que el plano cercano y se ve `depthScale(d)` veces más pequeño.
 * Funciones puras, monótonas decrecientes en `d`; valores no finitos o negativos se tratan como 0.
 */
const clampDepth = (d: number): number => (Number.isFinite(d) && d > 0 ? d : 0);

/** Multiplicador del desplazamiento de cámara de un plano a profundidad `depth`: 1/(1+d). */
export function parallaxFactor(depth: number): number {
  return 1 / (1 + clampDepth(depth));
}

/** Multiplicador de escala de un plano a profundidad `depth`: 1/(1+0,25·d). */
export function depthScale(depth: number): number {
  return 1 / (1 + 0.25 * clampDepth(depth));
}
