#!/usr/bin/env node
// FDN-075: prueba híbrida final. Un único comando que ejecuta, con los motores reales, la cadena que respalda cada
// uno de los 8 criterios de éxito (docs/pruebas-aceptacion.md) y genera examples/prueba-hibrida-10s/INFORME.md con
// el comando, el resultado, el tiempo y el hash de cada paso, y las versiones de los motores.
//
// Uso: node scripts/prueba-hibrida.mjs [--only 1,3,8] [--informe <ruta>] [--sin-artefacto] [--estricto]
//
// Regla de verdad: un criterio solo es «superado» si TODAS sus pruebas se ejecutaron y pasaron. Una prueba omitida
// (skip: falta un motor) deja el criterio «no ejecutado»; un fallo lo deja «fallido»; si aún no existe la prueba
// que lo respalda queda «pendiente». Nunca se infiere «superado» de una omisión.
//
// Entorno: FME_PUPPETEER_CACHE_DIR (Chrome de Revideo), FME_FFMPEG_PATH, FME_FFPROBE_PATH, FME_BLENDER_PATH,
// FME_FREECUT_DIR. Los motores se buscan donde indican los propios adaptadores (Revideo en runtime/engines/revideo).
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultInforme = join(repo, 'examples', 'prueba-hibrida-10s', 'INFORME.md');
const STEP_TIMEOUT_MS = 1_800_000;

const { values } = parseArgs({
  options: {
    only: { type: 'string' },
    informe: { type: 'string' },
    'sin-artefacto': { type: 'boolean' },
    estricto: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
  strict: true,
});
if (values.help) {
  console.log('Uso: node scripts/prueba-hibrida.mjs [--only 1,3,8] [--informe <ruta>] [--sin-artefacto] [--estricto]');
  process.exit(0);
}

/** Pruebas que respaldan cada criterio. `test` = archivos de `node --test`; `missingMeans` si falta alguno. */
const CRITERIA = [
  { n: 1, title: 'FreeCut, Revideo y Blender ejecutan cada uno una operación de muestra de forma independiente', steps: [
    { name: 'Revideo (render real de una capa)', test: ['packages/adapters/revideo/test/adapter.integration.test.ts'] },
    { name: 'Blender (render real de PNG RGBA)', test: ['packages/adapters/blender/test/adapter.test.ts'] },
    { name: 'FreeCut (composición real a MP4)', test: ['packages/adapters/freecut/test/adapter.integration.test.ts'] },
  ] },
  { n: 2, title: 'Un proyecto FME puede guardar, validar, recuperar y versionar su timeline', steps: [
    { name: 'Esquema, serialización, migraciones y fixtures (round-trip byte a byte)', test: ['packages/project/test/schema.test.ts', 'packages/project/test/serialize.test.ts', 'packages/project/test/migrate.test.ts', 'packages/project/test/fixtures.test.ts'] },
  ] },
  { n: 3, title: 'Los tres adaptadores ejecutan trabajos reales, no simulados', steps: [
    { name: 'Pipeline híbrido con Revideo, Blender y FreeCut', test: ['packages/pipeline/test/hybrid.integration.test.ts'] },
    { name: 'Exportación con la CLI (`fme project export`) y hash del MP4 final', artifact: true },
  ] },
  { n: 4, title: 'El router selecciona una ruta compatible consultando primero la tarjeta simple', steps: [
    { name: 'Router sobre las tarjetas reales de los tres adaptadores', test: ['packages/router/test/real-adapters.test.ts'] },
  ] },
  { n: 5, title: 'Solo consulta el detalle avanzado cuando una restricción crítica lo requiere', steps: [
    { name: 'Router: métricas de tarjetas leídas e inspecciones', test: ['packages/router/test/real-adapters.test.ts', 'packages/router/test/tokens.test.ts'] },
    { name: 'Fallbacks reales con recuperación', test: ['packages/recovery/test/real-fallbacks.integration.test.ts'] },
  ] },
  { n: 6, title: 'Los gradientes cambian una propiedad visual comprobable a lo largo del tiempo', steps: [
    { name: 'Gradientes en Revideo (contorno y sombra por píxeles)', test: ['packages/adapters/revideo/test/gradients.integration.test.ts'] },
    { name: 'Gradientes en Blender (contorno y luminancia)', test: ['packages/adapters/blender/test/gradients.integration.test.ts'] },
  ] },
  { n: 7, title: 'Se exporta correctamente un vídeo híbrido de 10 s con audio y sincronía adecuados', pendingTag: 'FDN-074', steps: [
    { name: 'Exportación híbrida con audio y sincronía A/V medida (≤ 1 fotograma)', test: ['packages/pipeline/test/av-sync.integration.test.ts'] },
  ] },
  { n: 8, title: 'Se pueden reabrir las fuentes externas y cambiar una parte sin rehacer todos los activos', steps: [
    { name: 'Re-render incremental con caché (1 job de Revideo + composición)', test: ['packages/pipeline/test/incremental.integration.test.ts'] },
  ] },
];

const wanted = values.only ? new Set(values.only.split(',').map((s) => Number(s.trim()))) : undefined;
if (wanted && [...wanted].some((n) => !Number.isInteger(n) || n < 1 || n > 8)) {
  console.error('--only admite números de criterio del 1 al 8, separados por comas.');
  process.exit(2);
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const sha256File = (p) => sha256(readFileSync(p));
const rel = (p) => relative(repo, p).replace(/\\/g, '/');
const sh = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true, cwd: repo });
  return r.status === 0 ? r.stdout.trim() : undefined;
};

/** Ejecuta `node --test` y parsea su salida TAP. */
function runNodeTest(files) {
  const args = ['--test', '--test-reporter=tap', ...files];
  const t0 = Date.now();
  return new Promise((done) => {
    const child = spawn(process.execPath, args, { cwd: repo, env: process.env, windowsHide: true });
    let out = '';
    let err = '';
    const timer = setTimeout(() => child.kill(), STEP_TIMEOUT_MS);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => {
      clearTimeout(timer);
      const num = (k) => Number(new RegExp(`^# ${k} (\\d+)`, 'm').exec(out)?.[1] ?? 0);
      const skips = [...out.matchAll(/^\s*ok \d+ - (.*?) # SKIP\s*(.*)$/gm)].map((m) => ({ test: m[1], reason: m[2] || '(sin motivo)' }));
      const fails = [...out.matchAll(/^\s*not ok \d+ - (.*)$/gm)].map((m) => m[1]);
      done({ command: `node ${args.join(' ')}`, exit: code, ms: Date.now() - t0,
        tests: num('tests'), pass: num('pass'), fail: num('fail'), skipped: num('skipped'), cancelled: num('cancelled'),
        skips, fails, stderr: err.trim().slice(-600), output: out });
    });
  });
}

function classify(r) {
  if (r.exit !== 0 || r.fail > 0 || r.cancelled > 0) return 'fallido';
  if (r.pass === 0 || r.skipped > 0) return 'no ejecutado';
  return 'superado';
}

// --- entorno y motores ---------------------------------------------------------------------------------------
async function engines(workRoot) {
  const out = {};
  try {
    const { createHybridAdapters } = await import('@fme/pipeline');
    const probeDir = join(workRoot, 'probe');
    mkdirSync(probeDir, { recursive: true });
    const adapters = createHybridAdapters(probeDir, probeDir, {
      probeWorkDir: probeDir,
      ...(process.env.FME_PUPPETEER_CACHE_DIR ? { puppeteerCacheDir: process.env.FME_PUPPETEER_CACHE_DIR } : {}),
    });
    for (const [name, adapter] of Object.entries(adapters)) {
      const p = await adapter.probe();
      out[name] = p.available
        ? { available: true, version: p.engineVersion ?? '(sin versión)', adapter: `${adapter.simple.id} ${adapter.simple.version}` }
        : { available: false, diagnostics: p.diagnostics.map((d) => d.message).join(' | ') };
    }
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
  }
  const ff = sh(process.env.FME_FFMPEG_PATH ?? 'ffmpeg', ['-version'])?.split(/\r?\n/)[0];
  out.ffmpeg = ff ? { available: true, version: ff } : { available: false, diagnostics: 'ffmpeg no encontrado' };
  return out;
}

function hardware() {
  const gpu = sh('nvidia-smi', ['--query-gpu=name,memory.total,driver_version', '--format=csv,noheader']);
  return {
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    node: process.version,
    cpu: `${os.cpus()[0]?.model.trim() ?? '?'} ×${os.cpus().length}`,
    ramGiB: (os.totalmem() / 1024 ** 3).toFixed(1),
    gpu: gpu ?? '(nvidia-smi no disponible)',
  };
}

// --- paso con artefacto: exportación real con la CLI ----------------------------------------------------------
async function artifactStep(workRoot) {
  const t0 = Date.now();
  const outDir = join(workRoot, 'export');
  const base = { name: 'artifact', ms: 0 };
  try {
    const helper = await import(pathToFileURL(join(repo, 'apps', 'mcp', 'test', 'hybrid-input.ts')).href);
    if (!helper.ffmpegAvailable()) return { ...base, status: 'no ejecutado', detail: 'ffmpeg no disponible', ms: Date.now() - t0 };
    const projectPath = helper.prepareHybridInput(join(workRoot, 'in'));
    const args = [join(repo, 'apps', 'cli', 'src', 'main.ts'), 'project', 'export', projectPath, '--out', outDir, '--blender-resolution', '640x360', '--json'];
    const command = `node apps/cli/src/main.ts project export <entradas> --out <salida> --blender-resolution 640x360 --json`;
    const r = spawnSync(process.execPath, args, { cwd: repo, env: helper.engineEnv(), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: STEP_TIMEOUT_MS, windowsHide: true });
    const ms = Date.now() - t0;
    let body;
    try { body = JSON.parse(r.stdout); } catch { body = undefined; }
    if (r.status === 3) {
      return { ...base, command, ms, status: 'no ejecutado', detail: `motor no disponible: ${(body?.error?.details?.diagnostics ?? []).map((d) => d.message).join(' | ')}` };
    }
    if (r.status !== 0 || !body?.mp4) {
      return { ...base, command, ms, status: 'fallido', detail: `salida ${String(r.status)}: ${(body?.error?.message ?? r.stderr ?? '').toString().slice(0, 600)}` };
    }
    const { probeMedia } = await import(pathToFileURL(join(repo, 'scripts', 'probe-media.mjs')).href);
    const media = await probeMedia(body.mp4, { ffprobe: helper.ffprobe });
    const okSteps = body.progress.every((p) => p.status === 'ok');
    const adapters = ['revideo', 'adapter.blender', 'adapter.freecut'].every((id) => body.adaptersInProvenance.includes(id));
    const good = media.frames === 300 && media.fps === 30 && okSteps && adapters;
    const projectText = readFileSync(body.projectPath, 'utf8');
    return {
      ...base, command, ms, status: good ? 'superado' : 'fallido',
      detail: `${media.frames} fotogramas, ${media.fps} FPS, ${media.width}×${media.height}, audio: ${media.audio}; ${body.progress.length} pasos (${okSteps ? 'todos ok' : 'con fallos'}); adaptadores en la procedencia: ${body.adaptersInProvenance.join(', ')}`,
      hashes: { 'hybrid.mp4 (SHA-256)': sha256File(body.mp4), 'project.fme.json enlazado (SHA-256)': sha256(projectText) },
      steps: body.progress.map((p) => `${p.step} (${p.adapterId}) ${p.status} ${(p.durationMs / 1000).toFixed(1)} s`),
    };
  } catch (e) {
    return { ...base, ms: Date.now() - t0, status: 'fallido', detail: e instanceof Error ? e.message : String(e) };
  }
}

// --- ejecución ---------------------------------------------------------------------------------------------------
const workRoot = mkdtempSync(join(os.tmpdir(), 'fme-prueba-hibrida-'));
const startedAt = new Date();
const toRun = CRITERIA.filter((c) => !wanted || wanted.has(c.n));
console.log(`Prueba híbrida: criterios ${toRun.map((c) => c.n).join(', ')}; trabajo en ${workRoot}`);

const env = await engines(workRoot);
const results = [];
for (const c of toRun) {
  const stepResults = [];
  for (const step of c.steps) {
    console.log(`#${c.n} · ${step.name} …`);
    if (step.artifact) {
      if (values['sin-artefacto']) {
        stepResults.push({ name: step.name, status: 'no ejecutado', detail: 'omitido con --sin-artefacto', ms: 0 });
      } else {
        const a = await artifactStep(workRoot);
        stepResults.push({ ...a, name: step.name });
      }
    } else {
      const missing = step.test.filter((f) => !existsSync(join(repo, f)));
      if (missing.length > 0) {
        stepResults.push({ name: step.name, status: 'pendiente', detail: `falta la prueba ${missing.join(', ')}${c.pendingTag ? ` (pendiente de ${c.pendingTag})` : ''}`, ms: 0, files: step.test });
      } else {
        const r = await runNodeTest(step.test);
        stepResults.push({ name: step.name, status: classify(r), r, files: step.test,
          hashes: Object.fromEntries(step.test.map((f) => [`${f} (SHA-256)`, sha256File(join(repo, f))])) });
      }
    }
    const last = stepResults.at(-1);
    console.log(`   → ${last.status}${last.r ? ` (${last.r.pass} pass, ${last.r.fail} fail, ${last.r.skipped} skip, ${(last.ms ?? last.r.ms) / 1000 | 0} s)` : ''}`);
  }
  const statuses = stepResults.map((s) => s.status);
  const status = statuses.includes('fallido') ? 'fallido'
    : statuses.includes('pendiente') ? 'pendiente'
    : statuses.includes('no ejecutado') ? 'no ejecutado'
    : 'superado';
  results.push({ c, status, steps: stepResults });
}

// --- informe -----------------------------------------------------------------------------------------------------
const commit = sh('git', ['rev-parse', '--short', 'HEAD']) ?? '(desconocido)';
const branch = sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']) ?? '(desconocido)';
const dirty = (sh('git', ['status', '--porcelain']) ?? '').length > 0;
const hw = hardware();
const secs = (ms) => `${(ms / 1000).toFixed(1)} s`;
const mark = { superado: '✅ superado', fallido: '❌ fallido', 'no ejecutado': '⚪ no ejecutado', pendiente: '🕓 pendiente' };
const count = (s) => results.filter((r) => r.status === s).length;

const L = [];
L.push('# Informe de la prueba híbrida final (FDN-075)', '');
L.push('> Generado por `node scripts/prueba-hibrida.mjs`. **No editar a mano.** Un criterio solo es «superado» si todas sus pruebas se ejecutaron y pasaron; una prueba omitida (falta un motor) lo deja «no ejecutado», nunca «superado».', '');
L.push(`**Resultado:** ${count('superado')}/${results.length} superados · ${count('fallido')} fallidos · ${count('no ejecutado')} no ejecutados · ${count('pendiente')} pendientes.`, '');
L.push('## Entorno', '');
L.push('| | |', '|---|---|');
L.push(`| Fecha | ${startedAt.toISOString()} |`, `| Commit | \`${commit}\`${dirty ? ' (con cambios sin confirmar)' : ''} en \`${branch}\` |`);
L.push(`| Sistema | ${hw.os} |`, `| Node | ${hw.node} |`, `| CPU | ${hw.cpu} |`, `| RAM | ${hw.ramGiB} GiB |`, `| GPU | ${hw.gpu} |`, '');
L.push('## Motores', '', '| Motor | Disponible | Versión / diagnóstico |', '|---|---|---|');
const names = { revideo: 'Revideo', blender: 'Blender', freecut: 'FreeCut' };
for (const k of ['revideo', 'blender', 'freecut']) {
  const e = env[k];
  L.push(e ? `| ${names[k]} | ${e.available ? 'sí' : 'no'} | ${e.available ? `${e.version} (adaptador ${e.adapter})` : String(e.diagnostics).replace(/\|/g, '\\|')} |` : `| ${names[k]} | no comprobado | ${env.error ?? '—'} |`);
}
L.push(`| FFmpeg | ${env.ffmpeg.available ? 'sí' : 'no'} | ${env.ffmpeg.available ? env.ffmpeg.version : env.ffmpeg.diagnostics} |`, '');
L.push('## Resumen', '', '| # | Criterio | Estado | Tiempo |', '|---|---|---|---|');
for (const r of results) {
  const ms = r.steps.reduce((n, s) => n + (s.r?.ms ?? s.ms ?? 0), 0);
  L.push(`| ${r.c.n} | ${r.c.title} | ${mark[r.status]} | ${secs(ms)} |`);
}
L.push('');
L.push('## Detalle por criterio', '');
for (const r of results) {
  L.push(`### Criterio ${r.c.n}: ${mark[r.status]}`, '', `_${r.c.title}_`, '');
  for (const s of r.steps) {
    L.push(`#### ${s.name}: ${mark[s.status]}`, '');
    const command = s.r?.command ?? s.command ?? (s.files ? `node --test --test-reporter=tap ${s.files.join(' ')}` : undefined);
    if (command) L.push('- **Comando:** `' + command + '`');
    if (s.r) {
      L.push(`- **Resultado:** ${s.r.pass} pasan, ${s.r.fail} fallan, ${s.r.skipped} omitidas (de ${s.r.tests}); salida ${String(s.r.exit)}`);
      L.push(`- **Tiempo:** ${secs(s.r.ms)}`);
      for (const k of s.r.skips) L.push(`- **Omitida:** «${k.test}»: ${k.reason}`);
      for (const f of s.r.fails) L.push(`- **Falla:** ${f}`);
      if (s.r.fail > 0 && s.r.stderr) L.push('- **stderr (final):** `' + s.r.stderr.replace(/\s+/g, ' ').slice(-300) + '`');
    } else {
      if (s.detail) L.push(`- **Resultado:** ${s.detail}`);
      L.push(`- **Tiempo:** ${secs(s.ms ?? 0)}`);
      for (const p of s.steps ?? []) L.push(`  - ${p}`);
    }
    for (const [k, v] of Object.entries(s.hashes ?? {})) L.push(`- **${k}:** \`${v}\``);
    L.push('');
  }
}
L.push('## Reproducir', '', '```', 'node scripts/prueba-hibrida.mjs', '```', '',
  'Requisitos: Revideo instalado en `runtime/engines/revideo` (`npm ci` allí) y Chrome de Puppeteer (`FME_PUPPETEER_CACHE_DIR`), Blender y FreeCut en las rutas por defecto de sus adaptadores (o `FME_BLENDER_PATH`, `FME_FREECUT_DIR`) y FFmpeg (`FME_FFMPEG_PATH`). `--only 3,8` ejecuta solo esos criterios; `--sin-artefacto` omite la exportación con la CLI. Los hashes de las pruebas son los de sus archivos fuente; el del MP4 depende del codificador y puede variar entre ejecuciones.', '');

const informe = values.informe ? resolve(values.informe) : defaultInforme;
mkdirSync(dirname(informe), { recursive: true });
writeFileSync(informe, L.join('\n'));
rmSync(workRoot, { recursive: true, force: true });

console.log(`\n${count('superado')}/${results.length} criterios superados; ${count('no ejecutado')} no ejecutados, ${count('pendiente')} pendientes, ${count('fallido')} fallidos.`);
console.log(`Informe: ${rel(informe)}`);
process.exit(count('fallido') > 0 ? 1 : values.estricto && count('superado') !== results.length ? 1 : 0);
