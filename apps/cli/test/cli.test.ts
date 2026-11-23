// FDN-081: la CLI se ejecuta como proceso sobre la fixture híbrida.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { after, test } from 'node:test';
import { deserialize } from '@fme/project';
import { H, W, engineEnv, ffmpegAvailable, ffprobe, prepareHybridInput } from '../../mcp/test/hybrid-input.ts';

const repo = resolve(import.meta.dirname, '..', '..', '..');
const main = join(import.meta.dirname, '..', 'src', 'main.ts');
const hibrida = join(repo, 'examples', 'prueba-hibrida-10s', 'project.fme.json');
const v1 = join(repo, 'packages', 'project', 'test', 'fixtures-v1', 'hibrida.fme.json');
const v0 = join(repo, 'packages', 'project', 'test', 'fixtures-v0', 'project.fme.json');
const probeMedia = ((await import(pathToFileURL(join(repo, 'scripts', 'probe-media.mjs')).href)) as {
  probeMedia: (f: string, o: { ffprobe: string }) => Promise<{ fps: number | null; frames: number | null; width: number | null; height: number | null }>;
}).probeMedia;
const scratch = mkdtempSync(join(tmpdir(), 'fme-cli-test-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

function fme(args: string[], timeout = 60_000) {
  const r = spawnSync(process.execPath, [main, ...args], { encoding: 'utf8', timeout });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
const json = (s: string) => JSON.parse(s) as any;

test('project validate: híbrida v3 válida (--json y texto)', () => {
  const r = fme(['project', 'validate', hibrida, '--json']);
  assert.equal(r.code, 0);
  const body = json(r.stdout);
  assert.equal(body.valid, true);
  assert.equal(body.summary.schemaVersion, 3);
  assert.equal(body.summary.layers, 5);
  assert.equal(body.migratedFrom, undefined);
  assert.match(fme(['project', 'validate', hibrida]).stdout, /^Válido/);
});

test('project validate: una v1 se migra en memoria y lo indica', () => {
  const body = json(fme(['project', 'validate', v1, '--json']).stdout);
  assert.equal(body.valid, true);
  assert.equal(body.migratedFrom, 1);
  assert.equal(body.summary.schemaVersion, 3);
});

test('project validate: errores con código de salida 1 y rutas', () => {
  const malo = join(scratch, 'malo.json');
  const p = json(readFileSync(hibrida, 'utf8'));
  p.sequences[0].scenes[0].layers[0].startFrame = -1;
  writeFileSync(malo, JSON.stringify(p));
  const r = fme(['project', 'validate', malo, '--json']);
  assert.equal(r.code, 1);
  assert.equal(json(r.stdout).error.code, 'INVALID_PROJECT');
  assert.equal(json(r.stdout).error.details[0].path, 'sequences[0].scenes[0].layers[0].startFrame');
  const texto = fme(['project', 'validate', malo]);
  assert.equal(texto.code, 1);
  assert.match(texto.stderr, /startFrame/);

  writeFileSync(join(scratch, 'futuro.json'), JSON.stringify({ schemaVersion: 99 }));
  assert.equal(json(fme(['project', 'validate', join(scratch, 'futuro.json'), '--json']).stdout).error.code, 'UNKNOWN_SCHEMA_VERSION');
  assert.equal(json(fme(['project', 'validate', join(scratch, 'no-existe.json'), '--json']).stdout).error.code, 'FILE_NOT_FOUND');
});

test('project migrate: v0 y v1 llegan a la versión actual; --out escribe y stdout es estable', () => {
  const out = join(scratch, 'migrado.fme.json');
  const r = fme(['project', 'migrate', v0, '--out', out, '--json']);
  assert.equal(r.code, 0);
  assert.equal(json(readFileSync(out, 'utf8')).schemaVersion, 3);
  // El resultado migrado es un proyecto válido y su migración es idempotente.
  const again = fme(['project', 'migrate', out]);
  assert.equal(again.code, 0);
  assert.equal(again.stdout, readFileSync(out, 'utf8'));
  // La v1 de la híbrida migra a la v2 vigente salvo el texto del título.
  const viaV1 = json(fme(['project', 'migrate', v1]).stdout);
  assert.equal(viaV1.schemaVersion, 3);
});

test('connectors list: filtros', () => {
  const todos = json(fme(['connectors', 'list', '--json']).stdout);
  assert.ok(todos.connectors.some((c: any) => c.card.id === 'revideo'));
  const filtrado = json(fme(['connectors', 'list', '--capability', 'render.video', '--accepts', 'fme/project+json', '--json']).stdout);
  assert.equal(filtrado.connectors.length, 1);
  assert.equal(json(fme(['connectors', 'list', '--capability', 'no.existe', '--json']).stdout).connectors.length, 0);
  assert.match(fme(['connectors', 'list']).stdout, /revideo/);
});

test('route plan: el título lo renderiza revideo; una capa 3D queda sin conector', () => {
  const r = fme(['route', 'plan', hibrida, '--layer', 'capa-titulo', '--json']);
  assert.equal(r.code, 0);
  const plan = json(r.stdout);
  assert.equal(plan.status, 'planned');
  assert.equal(plan.selected.connectorId, 'revideo');

  const sin = fme(['route', 'plan', hibrida, '--layer', 'capa-3d', '--json']);
  assert.equal(sin.code, 1);
  assert.equal(json(sin.stdout).status, 'rejected');

  const noExiste = fme(['route', 'plan', hibrida, '--layer', 'nadie', '--json']);
  assert.equal(noExiste.code, 1);
  assert.equal(json(noExiste.stdout).error.code, 'LAYER_NOT_FOUND');
});

test('uso incorrecto: código 2', () => {
  assert.equal(fme([]).code, 2);
  assert.equal(fme(['--help']).code, 0);
  assert.equal(fme(['project', 'frobnicate', hibrida]).code, 2);
  assert.equal(fme(['project', 'validate']).code, 2);
  assert.equal(fme(['route', 'plan', hibrida]).code, 2);
  assert.equal(fme(['project', 'validate', hibrida, '--opcion-rara']).code, 2);
  assert.equal(json(fme(['job', 'run', hibrida, '--layer', 'capa-titulo', '--json']).stdout).error.code, 'USAGE');
  assert.equal(fme(['job', 'run', hibrida, '--layer', 'capa-titulo', '--out', scratch, '--timeout', 'abc']).code, 2);
});

test('job run: no ejecuta nada si la capa no tiene conector', () => {
  const r = fme(['job', 'run', hibrida, '--layer', 'capa-3d', '--out', join(scratch, 'x'), '--json']);
  assert.equal(r.code, 1);
  assert.equal(json(r.stdout).error.code, 'NO_CONNECTOR');
});

test('job run: renderiza el título con el motor real (skip con motivo si no hay motor)', { timeout: 300_000 }, (t) => {
  const outDir = join(scratch, 'job');
  const r = fme(['job', 'run', hibrida, '--layer', 'capa-titulo', '--out', outDir, '--timeout', '240000', '--json'], 290_000);
  if (r.code === 3) {
    const diag = json(r.stdout).error.details?.map((d: any) => d.message).join(' | ');
    t.skip(`motor de Revideo no disponible: ${diag}`);
    return;
  }
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const body = json(r.stdout);
  assert.equal(body.result.status, 'ok');
  assert.deepEqual(body.conformance, []);
  assert.ok(existsSync(body.result.outputs[0].uri.replace(/^file:\/+/, '')) || existsSync(body.result.outputs[0].uri));
  assert.equal(body.result.provenance[0].pluginId, 'revideo');
});

test('preview render: errores de uso y capas sin conector', () => {
  assert.equal(fme(['preview', 'render', hibrida, '--layer', 'capa-titulo']).code, 2, 'falta --out');
  assert.equal(fme(['preview', 'render', hibrida, '--out', scratch]).code, 2, 'falta --layer');
  assert.equal(fme(['preview', 'render', hibrida, '--layer', 'capa-titulo', '--out', scratch, '--start', 'x']).code, 2);
  const sin = fme(['preview', 'render', hibrida, '--layer', 'capa-3d', '--out', join(scratch, 'p3d'), '--json']);
  assert.equal(sin.code, 1);
  assert.equal(json(sin.stdout).error.code, 'NO_CONNECTOR');
  const rango = fme(['preview', 'render', hibrida, '--layer', 'capa-titulo', '--out', join(scratch, 'pr'), '--start', '100', '--end', '200', '--json']);
  assert.equal(rango.code, 1);
  assert.equal(json(rango.stdout).error.code, 'INVALID_RANGE');
});

test('preview render: MP4 a 960×540 con el motor real (skip con motivo sin motor)', { timeout: 300_000 }, async (t) => {
  const r = fme(['preview', 'render', hibrida, '--layer', 'capa-titulo', '--out', join(scratch, 'preview'), '--start', '0', '--end', '30', '--timeout', '240000', '--json'], 290_000);
  if (r.code === 3) {
    t.skip(`motor de Revideo no disponible: ${json(r.stdout).error.details?.map((d: any) => d.message).join(' | ')}`);
    return;
  }
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const body = json(r.stdout);
  assert.equal(body.result.status, 'ok');
  assert.deepEqual([body.profile.width, body.profile.height], [960, 540]);
  assert.deepEqual(body.conformance, []);
  const { probeMedia } = await import(pathToFileURL(join(repo, 'scripts', 'probe-media.mjs')).href);
  const media = await probeMedia(fileURLToPath(body.result.outputs[0].uri));
  assert.equal(media.width, 960);
  assert.equal(media.height, 540);
  assert.equal(media.frames, 30);
});

// --- project export (FDN-080c) ----------------------------------------------------------------------------

test('project export: errores de uso, resolución inválida, carpeta no vacía y motor no disponible', () => {
  assert.equal(fme(['project', 'export', hibrida]).code, 2, 'falta --out');
  assert.equal(json(fme(['project', 'export', hibrida, '--out', join(scratch, 'e1'), '--blender-resolution', 'grande', '--json']).stdout).error.code, 'INVALID_RESOLUTION');
  assert.equal(json(fme(['project', 'export', join(scratch, 'no-existe.json'), '--out', join(scratch, 'e1'), '--json']).stdout).error.code, 'FILE_NOT_FOUND');
  const ocupada = join(scratch, 'ocupada');
  mkdirSync(ocupada);
  writeFileSync(join(ocupada, 'x.txt'), 'x');
  assert.equal(json(fme(['project', 'export', hibrida, '--out', ocupada, '--json']).stdout).error.code, 'OUT_DIR_NOT_EMPTY');
  // Motor de Revideo inexistente: el pipeline no ejecuta ningún paso y la CLI sale con 3.
  const sinMotor = spawnSync(process.execPath, [main, 'project', 'export', hibrida, '--out', join(scratch, 'e2'), '--json'],
    { encoding: 'utf8', env: { ...process.env, FME_REVIDEO_ENGINE_DIR: join(scratch, 'sin-motor') } });
  assert.equal(sinMotor.status, 3);
  const err = json(sinMotor.stdout).error;
  assert.equal(err.code, 'ENGINE_UNAVAILABLE');
  assert.deepEqual(err.details.progress, []);
});

test('project export: la prueba híbrida con los tres motores reales (skip con motivo sin motor)', { timeout: 1_800_000 }, async (t) => {
  if (!ffmpegAvailable()) { t.skip('ffmpeg no disponible'); return; }
  const inDir = join(scratch, 'hin');
  const projectPath = prepareHybridInput(inDir);
  const outDir = join(scratch, 'hout');
  const r = spawnSync(process.execPath, [main, 'project', 'export', projectPath, '--out', outDir, '--blender-resolution', '640x360', '--json'],
    { encoding: 'utf8', env: engineEnv(), timeout: 1_700_000, maxBuffer: 64 * 1024 * 1024 });
  if (r.status === 3) {
    t.skip(`motor no disponible: ${json(r.stdout).error.details.diagnostics.map((d: any) => d.message).join(' | ')}`);
    return;
  }
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const body = json(r.stdout);
  const media = await probeMedia(body.mp4, { ffprobe });
  assert.deepEqual([media.frames, media.fps, media.width, media.height], [300, 30, W, H]);
  assert.ok(body.progress.length >= 4 && body.progress.every((p: any) => p.status === 'ok'), JSON.stringify(body.progress.map((p: any) => `${p.step}=${p.status}`)));
  for (const id of ['revideo', 'adapter.blender', 'adapter.freecut']) assert.ok(body.adaptersInProvenance.includes(id), `falta ${id}`);
  const saved = deserialize(readFileSync(body.projectPath, 'utf8'));
  assert.ok(saved.ok);
  const artifacts = new Set((saved.value.artifacts ?? []).map((a) => a.id));
  for (const l of saved.value.sequences[0]!.scenes[0]!.layers.filter((l) => ['capa-titulo', 'capa-2d', 'capa-3d'].includes(l.id))) {
    assert.ok(l.externalProject?.renderArtifactId && artifacts.has(l.externalProject.renderArtifactId), `${l.id}: artefacto sin enlazar`);
  }
});
