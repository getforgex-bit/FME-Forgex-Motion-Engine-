// CLI del motor Revideo de FME (FDN-032). Lo invoca el adaptador con runIsolated; no lo uses con entrada no confiable.
// Uso: node cli.mjs --scene <job.json> --out <archivo.mp4|.mov> [--alpha] --ffmpeg <ruta> --ffprobe <ruta>
//      node cli.mjs --version
// job.json = { width, height, fps, frames, kind, text|svg, fontSize?, fill?, tracks:{x,y,opacity,scale,rotation} }
import {readFileSync, existsSync} from 'node:fs';
import {basename, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
process.chdir(aqui); // renderVideo resuelve projectFile y outDir contra process.cwd()
process.env.DISABLE_TELEMETRY = 'true';

const arg = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const falla = (codigo, msg) => { console.error(JSON.stringify({code: codigo, message: msg})); process.exit(2); };

if (process.argv.includes('--version')) {
  const pkg = JSON.parse(readFileSync(resolve(aqui, 'node_modules/@revideo/renderer/package.json'), 'utf8'));
  console.log(pkg.version);
  process.exit(0);
}

const scenePath = arg('--scene'), out = arg('--out'), alpha = process.argv.includes('--alpha');
const ffmpegPath = arg('--ffmpeg'), ffprobePath = arg('--ffprobe');
if (!scenePath || !out || !ffmpegPath || !ffprobePath) falla('bad-args', 'Faltan --scene, --out, --ffmpeg o --ffprobe');
if (!existsSync(resolve(aqui, 'node_modules/@revideo/renderer'))) falla('engine-missing', 'node_modules no instalado: ejecuta npm ci en runtime/engines/revideo');

const job = JSON.parse(readFileSync(scenePath, 'utf8'));
if (job.fps !== 30) falla('unsupported-fps', `Solo 30 FPS (el proyecto Revideo fija 30); recibido ${job.fps}`);
if (!Number.isInteger(job.frames) || job.frames < 1) falla('bad-job', 'frames inválido');

const {renderVideo} = await import('@revideo/renderer');
const {parchearFluentFfmpeg} = await import('./ffmpeg-compat.mjs');
parchearFluentFfmpeg(ffmpegPath);

// El rango de Revideo es inclusivo en el último fotograma: para N fotogramas hay que pedir hasta (N-1)/fps menos medio fotograma.
const fin = Math.max((job.frames - 1) / job.fps - 0.5 / job.fps, 0);
const range = [0, fin];
if (!out.endsWith(alpha ? '.mov' : '.mp4')) falla('bad-args', 'La extensión de --out debe ser ' + (alpha ? '.mov' : '.mp4'));
const exporter = {name: '@revideo/core/ffmpeg', options: {format: alpha ? 'proRes' : 'mp4'}};
const size = {x: job.width, y: job.height};

const file = await renderVideo({
  projectFile: alpha ? './src/project.alpha.ts' : './src/project.ts',
  variables: {job},
  settings: {
    outFile: basename(out), outDir: dirname(resolve(out)), logProgress: false,
    projectSettings: {range, size, exporter},
    ffmpeg: {ffmpegPath, ffprobePath},
  },
});
console.log(JSON.stringify({ok: true, out: resolve(out), file}));
