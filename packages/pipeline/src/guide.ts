/**
 * Guía 3D → 2D desde un render de Blender (FDN-063c, técnicas `3d-with-2d` y `2d-guided-by-3d`).
 *
 * Provisional: mientras Blender no exporte su `camera.json` nativo (FDN-063b), la posición en pantalla del objeto 3D por
 * fotograma sale del CENTROIDE de la silueta alfa de sus PNG RGBA. El resultado es la «guía JSON v1» que consume
 * `@fme/adapter-revideo` (`requirements.guide`): fracciones 0–1 desde la esquina superior izquierda.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export type GuideJson = { version: 1; width: number; height: number; source: string; frames: { x: number; y: number }[] };

/** Centroide (px) y área de los píxeles con alfa > 128 de un PNG RGBA de 8 bits sin entrelazado. */
export function pngAlphaCentroid(png: Buffer): { width: number; height: number; cx: number; cy: number; count: number } {
  if (png.length < 33 || !png.subarray(0, 8).equals(SIGNATURE)) throw new Error('No es un PNG.');
  let width = 0, height = 0;
  const idat: Buffer[] = [];
  for (let off = 8; off + 12 <= png.length;) {
    const len = png.readUInt32BE(off);
    const type = png.toString('ascii', off + 4, off + 8);
    const data = png.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error('Se esperaba un PNG RGBA de 8 bits sin entrelazado.');
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  if (raw.length !== (stride + 1) * height) throw new Error('Tamaño de datos PNG inesperado.');
  let prev = Buffer.alloc(stride);
  let sx = 0, sy = 0, count = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const row = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? row[i - 4]! : 0, b = prev[i]!, c = i >= 4 ? prev[i - 4]! : 0;
      let pred = 0;
      if (filter === 1) pred = a;
      else if (filter === 2) pred = b;
      else if (filter === 3) pred = (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      else if (filter !== 0) throw new Error('Filtro PNG desconocido.');
      row[i] = (row[i]! + pred) & 255;
    }
    for (let x = 0; x < width; x++) if (row[x * 4 + 3]! > 128) { sx += x; sy += y; count++; }
    prev = row;
  }
  return { width, height, cx: count ? sx / count : NaN, cy: count ? sy / count : NaN, count };
}

/** Guía v1 a partir de `frame-0001.png … frame-NNNN.png` de un directorio de Blender. */
export function guideFromBlenderFrames(framesDir: string, frames: number): GuideJson {
  const out: GuideJson['frames'] = [];
  let width = 0, height = 0;
  for (let i = 1; i <= frames; i++) {
    const c = pngAlphaCentroid(readFileSync(join(framesDir, `frame-${String(i).padStart(4, '0')}.png`)));
    if (!(c.count > 0)) throw new Error(`El fotograma ${i} del render 3D no tiene silueta (alfa vacío).`);
    width = c.width;
    height = c.height;
    out.push({ x: c.cx / c.width, y: c.cy / c.height });
  }
  return { version: 1, width, height, source: 'alpha-silhouette-centroid', frames: out };
}

/**
 * Orden de composición de los overlays (`3d-with-2d`): una capa 2D guiada por una capa 3D que declara `3d-with-2d` debe
 * quedar ENCIMA de ella. Devuelve el `zIndex` efectivo de cada capa (solo sube; nunca baja).
 */
export function overlayZIndexes(layers: readonly { id: string; zIndex: number; techniques: readonly string[]; guide3DLayerId?: string }[]): Map<string, number> {
  const z = new Map(layers.map((l) => [l.id, l.zIndex]));
  for (const l of layers) {
    if (!l.techniques.includes('2d-guided-by-3d') || l.guide3DLayerId === undefined) continue;
    const guide = layers.find((g) => g.id === l.guide3DLayerId);
    if (!guide || !guide.techniques.includes('3d-with-2d')) continue;
    z.set(l.id, Math.max(z.get(l.id)!, guide.zIndex + 1));
  }
  return z;
}
