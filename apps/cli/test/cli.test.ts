// FDN-081: la CLI se ejecuta como proceso sobre la fixture híbrida.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, test } from 'node:test';

const repo = resolve(import.meta.dirname, '..', '..', '..');
const main = join(import.meta.dirname, '..', 'src', 'main.ts');
const hibrida = join(repo, 'examples', 'prueba-hibrida-10s', 'project.fme.json');
const v1 = join(repo, 'packages', 'project', 'test', 'fixtures-v1', 'hibrida.fme.json');
const v0 = join(repo, 'packages', 'project', 'test', 'fixtures-v0', 'project.fme.json');
const scratch = mkdtempSync(join(tmpdir(), 'fme-cli-test-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

function fme(args: string[], timeout = 60_000) {
  const r = spawnSync(process.execPath, [main, ...args], { encoding: 'utf8', timeout });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
const json = (s: string) => JSON.parse(s) as any;

test('project validate: híbrida v2 válida (--json y texto)', () => {
  const r = fme(['project', 'validate', hibrida, '--json']);
  assert.equal(r.code, 0);
  const body = json(r.stdout);
  assert.equal(body.valid, true);
  assert.equal(body.summary.schemaVersion, 2);
  assert.equal(body.summary.layers, 5);
  assert.equal(body.migratedFrom, undefined);
  assert.match(fme(['project', 'validate', hibrida]).stdout, /^Válido/);
});

test('project validate: una v1 se migra en memoria y lo indica', () => {
  const body = json(fme(['project', 'validate', v1, '--json']).stdout);
  assert.equal(body.valid, true);
  assert.equal(body.migratedFrom, 1);
  assert.equal(body.summary.schemaVersion, 2);
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
  assert.equal(json(readFileSync(out, 'utf8')).schemaVersion, 2);
  // El resultado migrado es un proyecto válido y su migración es idempotente.
  const again = fme(['project', 'migrate', out]);
  assert.equal(again.code, 0);
  assert.equal(again.stdout, readFileSync(out, 'utf8'));
  // La v1 de la híbrida migra a la v2 vigente salvo el texto del título.
  const viaV1 = json(fme(['project', 'migrate', v1]).stdout);
  assert.equal(viaV1.schemaVersion, 2);
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
