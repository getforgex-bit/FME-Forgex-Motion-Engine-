// Sonda de medios: envuelve ffprobe y devuelve un resumen estable.
// Uso: node scripts/probe-media.mjs <archivo> [--ffprobe <ruta>]
// Sin dependencias: solo node:child_process (sin shell) y node:fs.
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Error estructurado: `code` es estable; `message` es para personas. */
export class ProbeError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ProbeError";
    this.code = code;
    this.details = details;
  }
}

const TIMEOUT_MS = 60_000;
const MAX_BUFFER = 64 * 1024 * 1024;

/** Ejecuta un binario sin shell y devuelve stdout; traduce los fallos a ProbeError. */
function correr(bin, args) {
  return new Promise((ok, fallo) => {
    execFile(bin, args, { timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER, windowsHide: true }, (err, stdout, stderr) => {
      if (err?.code === "ENOENT") {
        return fallo(new ProbeError("FFPROBE_NO_DISPONIBLE", `No se encuentra «${bin}». Instala FFmpeg o indica su ruta con --ffprobe.`, { bin }));
      }
      if (err?.killed) {
        return fallo(new ProbeError("TIMEOUT", `ffprobe superó ${TIMEOUT_MS} ms.`, { bin, args }));
      }
      if (err) {
        return fallo(new ProbeError("FFPROBE_FALLO", `ffprobe terminó con error: ${stderr.trim() || err.message}`, { bin, exitCode: err.code, stderr: stderr.trim() }));
      }
      ok(stdout);
    });
  });
}

/** «30000/1001» → 29.97… ; «0/0», vacío o no numérico → null. */
export function fraccion(txt) {
  if (txt === undefined || txt === null || txt === "") return null;
  const partes = String(txt).split("/");
  const n = Number(partes[0]);
  const d = partes.length === 2 ? Number(partes[1]) : 1;
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
  return n / d;
}

const cachePixFmt = new Map();

/** Conjunto de formatos de píxel con canal alpha, según el propio ffprobe (no por nombre). */
async function formatosConAlpha(bin) {
  if (!cachePixFmt.has(bin)) {
    const salida = await correr(bin, ["-v", "error", "-show_pixel_formats", "-print_format", "json"]);
    const lista = JSON.parse(salida).pixel_formats ?? [];
    cachePixFmt.set(bin, new Set(lista.filter((f) => f.flags?.alpha === 1).map((f) => f.name)));
  }
  return cachePixFmt.get(bin);
}

/**
 * Inspecciona un archivo multimedia.
 * @param {string} archivo ruta al medio
 * @param {{ffprobe?: string, contarFotogramas?: boolean}} [opciones]
 * @returns {Promise<{fps: number|null, frames: number|null, durationS: number|null, width: number|null, height: number|null, pixFmt: string|null, hasAlpha: boolean, audio: boolean}>}
 */
export async function probeMedia(archivo, { ffprobe = "ffprobe", contarFotogramas = true } = {}) {
  const ruta = resolve(archivo);
  if (!existsSync(ruta)) {
    throw new ProbeError("ARCHIVO_NO_EXISTE", `No existe el archivo: ${ruta}`, { ruta });
  }

  const json = JSON.parse(await correr(ffprobe, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", ruta]));
  const streams = json.streams ?? [];
  const video = streams.find((s) => s.codec_type === "video");
  const audio = streams.some((s) => s.codec_type === "audio");
  const durationS = fraccion(json.format?.duration) ?? fraccion(video?.duration);

  if (!video) {
    return { fps: null, frames: null, durationS, width: null, height: null, pixFmt: null, hasAlpha: false, audio };
  }

  const fps = fraccion(video.r_frame_rate) ?? fraccion(video.avg_frame_rate);

  const nbFrames = Number(video.nb_frames);
  let frames = video.nb_frames != null && Number.isFinite(nbFrames) ? nbFrames : null;
  if (frames === null && contarFotogramas) {
    const cuenta = JSON.parse(await correr(ffprobe, [
      "-v", "error", "-count_frames", "-select_streams", "v:0",
      "-show_entries", "stream=nb_read_frames", "-print_format", "json", ruta,
    ]));
    const leidos = Number(cuenta.streams?.[0]?.nb_read_frames);
    frames = Number.isFinite(leidos) ? leidos : null;
  }

  const alpha = await formatosConAlpha(ffprobe);
  return {
    fps,
    frames,
    durationS,
    width: video.width ?? null,
    height: video.height ?? null,
    pixFmt: video.pix_fmt ?? null,
    hasAlpha: alpha.has(video.pix_fmt),
    audio,
  };
}

// Modo CLI: node scripts/probe-media.mjs <archivo> [--ffprobe <ruta>]
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let ffprobe = "ffprobe";
  const restos = [];
  for (let k = 0; k < args.length; k++) {
    if (args[k] === "--ffprobe") ffprobe = args[++k] ?? "ffprobe";
    else restos.push(args[k]);
  }
  const archivo = restos[0];
  if (!archivo) {
    console.error("Uso: node scripts/probe-media.mjs <archivo> [--ffprobe <ruta>]");
    process.exit(2);
  }
  try {
    console.log(JSON.stringify(await probeMedia(archivo, { ffprobe }), null, 2));
  } catch (e) {
    console.error(JSON.stringify({ error: e.code ?? "ERROR", mensaje: e.message }));
    process.exit(1);
  }
}
