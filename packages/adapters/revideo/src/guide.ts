/**
 * Guía 3D → 2D (FDN-063, técnica `2d-guided-by-3d` con `guide3DLayerId`).
 *
 * Formato «guía JSON v1»: `{ version: 1, width?, height?, frames: [{ x, y, scale? }] }`, con `x`,`y` como FRACCIONES 0–1
 * desde la esquina superior izquierda (posición en pantalla del centro del objeto 3D en cada fotograma de la CAPA 3D) y
 * `scale` como multiplicador opcional del tamaño. Hoy lo produce la silueta alfa de los PNG de Blender (test de FDN-063);
 * el export nativo de la cámara de Blender está pendiente de una solicitud a A0.
 */
import { MappingError } from './mapping.ts';

export type GuideFrame = { x: number; y: number; scale?: number };
export type GuideData = { version: 1; width?: number; height?: number; frames: GuideFrame[] };

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Valida una guía ya parseada; lanza `MappingError('bad-guide', …)` si no cumple el formato. */
export function parseGuide(raw: unknown): GuideData {
  const bad = (m: string): never => { throw new MappingError('bad-guide', `Guía inválida: ${m}`); };
  if (typeof raw !== 'object' || raw === null) return bad('no es un objeto');
  const g = raw as Record<string, unknown>;
  if (g.version !== 1) bad('version debe ser 1');
  if (!Array.isArray(g.frames) || g.frames.length === 0) bad('frames debe ser un array no vacío');
  const frames = (g.frames as unknown[]).map((f, i): GuideFrame => {
    const o = (typeof f === 'object' && f !== null ? f : {}) as Record<string, unknown>;
    if (!finite(o.x) || !finite(o.y)) return bad(`frames[${i}] necesita x e y numéricos`);
    if (o.scale !== undefined && (!finite(o.scale) || o.scale <= 0)) return bad(`frames[${i}].scale debe ser > 0`);
    return { x: o.x as number, y: o.y as number, ...(o.scale !== undefined ? { scale: o.scale as number } : {}) };
  });
  return { version: 1, frames, ...(finite(g.width) ? { width: g.width } : {}), ...(finite(g.height) ? { height: g.height } : {}) };
}

/**
 * Desplazamientos por fotograma de la capa 2D (px desde el centro, escala) para seguir la guía.
 * El índice de la guía alinea las dos capas en tiempo de ESCENA: `startFrame2D + f − startFrame3D`, con los extremos fijos.
 */
export function guideOffsets(guide: GuideData, startFrame2D: number, startFrame3D: number, frames: number, width: number, height: number): { x: number[]; y: number[]; scale: number[] } {
  const x: number[] = [];
  const y: number[] = [];
  const scale: number[] = [];
  for (let f = 0; f < frames; f++) {
    const i = Math.min(guide.frames.length - 1, Math.max(0, startFrame2D + f - startFrame3D));
    const g = guide.frames[i]!;
    x.push((g.x - 0.5) * width);
    y.push((g.y - 0.5) * height);
    scale.push(g.scale ?? 1);
  }
  return { x, y, scale };
}
