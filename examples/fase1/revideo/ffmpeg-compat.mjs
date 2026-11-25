// Parche de compatibilidad (FDN-016): fluent-ffmpeg 2.1.3 (deprecada) parsea `ffmpeg -formats` con una regex de
// 2 columnas de flags. FFmpeg >= 7/9 añade una tercera ("d" = dispositivo), así que `lavfi` deja de reconocerse
// y Revideo falla al crear la pista de audio silenciosa ("Input format lavfi is not available").
// Sustituimos solo `availableFormats` por una versión con 3 flags (acepta también la salida antigua de 2).
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';

export function parchearFluentFfmpeg(ffmpegPath) {
  const require = createRequire(import.meta.url);
  const ffmpeg = require('fluent-ffmpeg'); // misma instancia que usa @revideo/ffmpeg (dependencia hoisted)
  let cache;
  const disponibles = function (callback) {
    if (!cache) {
      cache = {};
      const out = execFileSync(ffmpegPath, ['-hide_banner', '-formats'], {maxBuffer: 1 << 24}).toString();
      for (const linea of out.split(/\r?\n/)) {
        const m = linea.match(/^\s*([D ])([E ])([d ])?\s+(\S+)\s+(.*)$/);
        if (!m) continue;
        for (const f of m[4].split(',')) {
          cache[f] ??= {description: m[5], canDemux: false, canMux: false};
          if (m[1] === 'D') cache[f].canDemux = true;
          if (m[2] === 'E') cache[f].canMux = true;
        }
      }
    }
    callback(null, cache);
  };
  ffmpeg.prototype.availableFormats = disponibles;
  ffmpeg.prototype.getAvailableFormats = disponibles;
}
