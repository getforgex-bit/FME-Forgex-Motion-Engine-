// FDN-080: arranca el servidor por stdio con un cliente del SDK y ejercita las herramientas.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resolveInRoot } from '../src/paths.ts';

const repo = resolve(import.meta.dirname, '..', '..', '..');
const examples = join(repo, 'examples');
const scratch = mkdtempSync(join(tmpdir(), 'fme-mcp-test-'));

async function connect(root: string): Promise<Client> {
  const client = new Client({ name: 'fme-test', version: '0.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(import.meta.dirname, 'fixture-server.ts'), root],
    stderr: 'pipe',
  });
  await client.connect(transport);
  return client;
}

type Call = { isError?: boolean; content: { type: string; text?: string }[] };
async function call(client: Client, name: string, args: Record<string, unknown> = {}): Promise<{ isError: boolean; body: any }> {
  const r = (await client.callTool({ name, arguments: args })) as Call;
  const text = r.content[0]!.text!;
  // Los errores de validación del esquema de entrada los genera el SDK (texto plano, no JSON).
  let body: any;
  try { body = JSON.parse(text); } catch { body = { sdkError: text }; }
  return { isError: r.isError === true, body };
}

let client: Client;
let writable: Client;
before(async () => {
  client = await connect(examples);
  writable = await connect(scratch);
});
after(async () => {
  await client.close();
  await writable.close();
  rmSync(scratch, { recursive: true, force: true });
});

test('lista las herramientas del contrato §3', async () => {
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, [
    'connectors.inspect', 'connectors.list', 'job.run', 'preview.inspect', 'preview.render',
    'project.create', 'project.export', 'project.open', 'route.plan',
  ]);
});

test('project.open abre la fixture híbrida (v2)', async () => {
  const r = await call(client, 'project.open', { path: 'prueba-hibrida-10s/project.fme.json' });
  assert.equal(r.isError, false);
  assert.equal(r.body.summary.schemaVersion, 2);
  assert.equal(r.body.summary.fps.num, 30);
  assert.equal(r.body.summary.layers, 5);
  assert.equal(r.body.project, undefined);
  const full = await call(client, 'project.open', { path: 'prueba-hibrida-10s/project.fme.json', includeProject: true });
  assert.equal(full.body.project.sequences[0].scenes[0].durationFrames, 300);
});

test('connectors.list y connectors.inspect sobre el registro', async () => {
  const list = await call(client, 'connectors.list', { capability: 'render.video', accepts: 'fme/project+json' });
  assert.equal(list.body.connectors.length, 1);
  assert.equal(list.body.connectors[0].card.id, 'revideo');
  assert.equal((await call(client, 'connectors.list', { capability: 'no.existe' })).body.connectors.length, 0);

  const insp = await call(client, 'connectors.inspect', { id: 'revideo', sections: ['editability'] });
  assert.equal(insp.body.sections.editability, 'baked');
  assert.equal(insp.body.sections.technical, undefined);
  const missing = await call(client, 'connectors.inspect', { id: 'nadie', sections: ['limits'] });
  assert.equal(missing.isError, true);
  assert.equal(missing.body.error.code, 'CONNECTOR_NOT_FOUND');
});

test('route.plan planifica con el enrutador real', async () => {
  const plan = await call(client, 'route.plan', {
    task: { operation: 'render.video', requiredCapabilities: ['render.video'], requiredAccepts: ['fme/project+json'], requiredProduces: ['video/mp4'] },
  });
  assert.equal(plan.isError, false);
  assert.equal(plan.body.status, 'planned');
  assert.equal(plan.body.selected.connectorId, 'revideo');
  assert.ok(plan.body.justification.length > 0);

  const rejected = await call(client, 'route.plan', { task: { operation: 'render.3d', requiredCapabilities: ['render.3d'] } });
  assert.equal(rejected.body.status, 'rejected');
});

test('las herramientas sin implementación devuelven NOT_IMPLEMENTED', async () => {
  for (const name of ['preview.render', 'preview.inspect', 'project.export']) {
    const r = await call(client, name);
    assert.equal(r.isError, true, name);
    assert.equal(r.body.error.code, 'NOT_IMPLEMENTED', name);
  }
});

test('project.create guarda dentro de la raíz, sin sobrescribir, y round-trip con project.open', async () => {
  const created = await call(writable, 'project.create', { id: 'p', name: 'Nuevo', width: 640, height: 360, path: 'sub/nuevo.fme.json' });
  assert.equal(created.isError, false);
  assert.equal(created.body.project.schemaVersion, 2);
  assert.ok(existsSync(join(scratch, 'sub', 'nuevo.fme.json')));
  const again = await call(writable, 'project.create', { id: 'p', name: 'Nuevo', width: 640, height: 360, path: 'sub/nuevo.fme.json' });
  assert.equal(again.body.error.code, 'FILE_EXISTS');
  const opened = await call(writable, 'project.open', { path: 'sub/nuevo.fme.json', includeProject: true });
  assert.deepEqual(opened.body.project, created.body.project);
  assert.ok(readFileSync(join(scratch, 'sub', 'nuevo.fme.json'), 'utf8').endsWith('}\n'));
  const bad = await call(writable, 'project.create', { id: 'p', name: 'x', width: 640, height: 360, fps: { num: 0, den: 1 } });
  assert.equal(bad.isError, true);
  assert.ok(bad.body.sdkError, 'el SDK rechaza fps inválido con el esquema de entrada');
});

test('las rutas fuera de la raíz se rechazan (project.open, project.create y job.run)', async () => {
  for (const path of ['../package.json', '..\\package.json', repo, 'https://example.com/x.json', 'a/../../b']) {
    const r = await call(client, 'project.open', { path });
    assert.equal(r.isError, true, path);
    assert.equal(r.body.error.code, 'PATH_OUTSIDE_ROOT', path);
  }
  const create = await call(writable, 'project.create', { id: 'p', name: 'x', width: 1, height: 1, path: '../escape.json' });
  assert.equal(create.body.error.code, 'PATH_OUTSIDE_ROOT');
  assert.equal(existsSync(join(scratch, '..', 'escape.json')), false);
  const job = await call(client, 'job.run', {
    connectorId: 'revideo',
    job: { projectId: 'x', operation: 'render.video', inputs: [{ uri: '../package.json', type: 'fme/project+json' }], requirements: {} },
  });
  assert.equal(job.body.error.code, 'PATH_OUTSIDE_ROOT');
});

test('project.open: JSON inválido y versión desconocida dan errores estructurados', async () => {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(join(scratch, 'malo.json'), '{no es json');
  writeFileSync(join(scratch, 'futuro.json'), JSON.stringify({ schemaVersion: 99 }));
  assert.equal((await call(writable, 'project.open', { path: 'malo.json' })).body.error.code, 'INVALID_PROJECT');
  assert.equal((await call(writable, 'project.open', { path: 'futuro.json' })).body.error.code, 'UNKNOWN_SCHEMA_VERSION');
  assert.equal((await call(writable, 'project.open', { path: 'no-existe.json' })).body.error.code, 'FILE_NOT_FOUND');
});

test('job.run entrega el job al adaptador con un directorio propio dentro de la raíz', async () => {
  const r = await call(client, 'job.run', {
    connectorId: 'revideo',
    job: { projectId: 'prueba', operation: 'render.video', inputs: [{ uri: 'prueba-hibrida-10s/project.fme.json', type: 'fme/project+json' }], requirements: { layerId: 'capa-titulo' } },
  });
  assert.equal(r.isError, false);
  assert.equal(r.body.result.diagnostics[0].code, 'TEST_DOUBLE');
  const workDir = r.body.result.diagnostics[0].message.replace('workDir=', '');
  assert.ok(workDir.startsWith(join(examples, '.fme-jobs')));
  assert.ok(existsSync(join(workDir, 'out.txt')));
  rmSync(join(examples, '.fme-jobs'), { recursive: true, force: true });
  const none = await call(client, 'job.run', { connectorId: 'blender', job: { projectId: 'x', operation: 'o', inputs: [], requirements: {} } });
  assert.equal(none.body.error.code, 'ADAPTER_NOT_AVAILABLE');
});

test('resolveInRoot: casos límite', () => {
  assert.throws(() => resolveInRoot(scratch, ''), /no vacía/);
  assert.throws(() => resolveInRoot(scratch, 'a\0b'), /nulos/);
  assert.throws(() => resolveInRoot(scratch, 'http://x/y'), /file:/);
  assert.ok(resolveInRoot(scratch, 'a/b.json').startsWith(scratch));
});

test('la entrada real (main.ts) arranca por stdio sin adaptadores y exige --root', async () => {
  const c = new Client({ name: 'fme-test', version: '0.0.0' });
  await c.connect(new StdioClientTransport({
    command: process.execPath,
    args: [join(import.meta.dirname, '..', 'src', 'main.ts'), '--root', examples],
    stderr: 'pipe',
  }));
  try {
    assert.equal((await call(c, 'connectors.list')).body.connectors.length, 0);
    const job = await call(c, 'job.run', { connectorId: 'revideo', job: { projectId: 'x', operation: 'o', inputs: [], requirements: {} } });
    assert.equal(job.body.error.code, 'ADAPTER_NOT_AVAILABLE');
    assert.equal((await call(c, 'project.open', { path: 'prueba-hibrida-10s/project.fme.json' })).isError, false);
  } finally {
    await c.close();
  }
});
