// Render headless con la API pública `renderVideo` de @revideo/renderer.
// Uso: node render.mjs <mp4|alpha>   (salida en ./out/)
import {execFileSync} from 'node:child_process';
import {renderVideo} from '@revideo/renderer';
import {parchearFluentFfmpeg} from './ffmpeg-compat.mjs';

// FFmpeg/ffprobe del SISTEMA (FDN-016), no los binarios de @ffmpeg-installer (GPLv3, 2018).
// Se puede forzar con FFMPEG_PATH / FFPROBE_PATH; si no, se resuelve desde el PATH. Falla si no hay.
const which = n => execFileSync(process.platform === 'win32' ? 'where' : 'which', [n]).toString().split(/\r?\n/)[0].trim();
const ffmpegPath = process.env.FFMPEG_PATH || which('ffmpeg');
const ffprobePath = process.env.FFPROBE_PATH || which('ffprobe');
parchearFluentFfmpeg(ffmpegPath);
console.log(JSON.stringify({ffmpegPath, ffprobePath}));

// range es inclusivo en el último fotograma: [0, 2.96] s => 89 => fotogramas 0..89 = 90.
const RANGO = [0, 2.96];
const modo = process.argv[2] ?? 'mp4';
const t0 = Date.now();
const settings = modo === 'alpha'
  ? {outFile: 'alpha.mov', outDir: './out',
     projectSettings: {range: RANGO, exporter: {name: '@revideo/core/ffmpeg', options: {format: 'proRes'}}}}
  : {outFile: 'fme-revideo.mp4', outDir: './out',
     projectSettings: {range: RANGO, exporter: {name: '@revideo/core/ffmpeg', options: {format: 'mp4'}}}};
const file = await renderVideo({projectFile: modo === 'alpha' ? './src/project.alpha.ts' : './src/project.ts', settings: {...settings, ffmpeg: {ffmpegPath, ffprobePath}, logProgress: false}});
console.log(JSON.stringify({modo, file, segundos: (Date.now() - t0) / 1000}));
