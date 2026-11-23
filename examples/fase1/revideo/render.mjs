// Render headless con la API pública `renderVideo` de @revideo/renderer.
// Uso: node render.mjs <mp4|alpha>   (salida en ./out/)
import {renderVideo} from '@revideo/renderer';

// range es inclusivo en el último fotograma: [0, 2.96] s => 89 => fotogramas 0..89 = 90.
const RANGO = [0, 2.96];
const modo = process.argv[2] ?? 'mp4';
const t0 = Date.now();
const settings = modo === 'alpha'
  ? {outFile: 'alpha.mov', outDir: './out',
     projectSettings: {range: RANGO, exporter: {name: '@revideo/core/ffmpeg', options: {format: 'proRes'}}}}
  : {outFile: 'fme-revideo.mp4', outDir: './out',
     projectSettings: {range: RANGO, exporter: {name: '@revideo/core/ffmpeg', options: {format: 'mp4'}}}};
const file = await renderVideo({projectFile: modo === 'alpha' ? './src/project.alpha.ts' : './src/project.ts', settings: {...settings, logProgress: false}});
console.log(JSON.stringify({modo, file, segundos: (Date.now() - t0) / 1000}));
