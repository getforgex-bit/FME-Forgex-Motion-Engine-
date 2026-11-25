import assert from 'node:assert/strict';
import { realpathSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createConnectorRegistry, type AdapterJobResult, type ConnectorAdapter, type JobRequest } from '@fme/connectors';
import { SCHEMA_VERSION, serialize, type Asset, type Layer, type Project } from '@fme/project';

import { run as runCli } from '../../apps/cli/src/cli.ts';
import { createFmeServer } from '../../apps/mcp/src/server.ts';
import { createBlenderAdapter } from '../../packages/adapters/blender/src/index.ts';
import { FreeCutAdapter } from '../../packages/adapters/freecut/src/index.ts';
import { RevideoAdapter, buildEngineJob } from '../../packages/adapters/revideo/src/index.ts';
import { runIsolated } from '../../runtime/workers/src/index.ts';

const literal = 'literal&marca';
const junctionType = process.platform === 'win32' ? 'junction' : 'dir';
const fixtureId = 'proyecto-temporal';
const sceneId = 'escena-temporal';

async function sandbox(context: TestContext) {
  const scratch = await mkdtemp(join(realpathSync.native(tmpdir()), 'fme-limites-test-'));
  context.after(() => rm(scratch, { recursive: true, force: true }));
  const root = join(scratch, 'permitido');
  const outside = join(scratch, 'vecino');
  const workDir = join(root, 'job');
  await mkdir(workDir, { recursive: true });
  await mkdir(outside);
  return { root, outside, workDir, ctx: { workDir, jobId: 'limites', timeoutMs: 5_000 } };
}

function layer(kind: Layer['kind'], assetId?: string): Layer {
  return { id: 'capa', kind, ...(assetId === undefined ? {} : { assetId }), startFrame: 0,
    durationFrames: 2, techniques: [], zIndex: 0, channels: {} };
}

function project(layers: Layer[] = [], assets: Asset[] = []): Project {
  return {
    schemaVersion: SCHEMA_VERSION, id: fixtureId, name: 'Fixture temporal',
    fps: { num: 30, den: 1 }, width: 96, height: 54, seed: 17, assets,
    sequences: [{ id: 'secuencia', scenes: [{ id: sceneId, durationFrames: 2, layers }] }],
  };
}

async function writeProject(root: string, value: Project, name = 'project.fme.json'): Promise<string> {
  const file = join(root, name);
  await writeFile(file, serialize(value), { flag: 'wx' });
  return file;
}

function job(operation: string, filename: string, requirements: JobRequest['requirements']): JobRequest {
  return { projectId: fixtureId, operation, inputs: [{ uri: pathToFileURL(filename).href, type: 'fme/project+json' }],
    requirements };
}

function expectRejection(result: AdapterJobResult, code: string): void {
  assert.equal(result.status, 'failed');
  assert.deepEqual(result.outputs, []);
  assert.deepEqual(result.provenance, []);
  assert.equal(result.diagnostics[0]?.code, code);
}

test('runIsolated aplica sus límites de raíz, componentes padre y enlaces antes de iniciar el proceso', async (t) => {
  const { root, outside, workDir } = await sandbox(t);
  const cmd = realpathSync.native(process.execPath);
  const options = { cmd, args: [], workDir, allowedPaths: [cmd, root], timeoutMs: 5_000 };
  const asset = join(outside, 'nota.txt');
  const alias = join(root, 'alias');
  await writeFile(asset, 'fixture temporal', { flag: 'wx' });
  await symlink(outside, alias, junctionType);

  await assert.rejects(runIsolated({ ...options, workDir: outside }), /raíz permitida/);
  await assert.rejects(runIsolated({ ...options, workDir: workDir + '/../job' }), /componente "\.\."/);
  await assert.rejects(runIsolated({ ...options, args: [{ path: asset }] }), /fuera de lo permitido/);
  await assert.rejects(runIsolated({ ...options, args: [{ path: join(alias, 'nota.txt') }] }), /enlace o junction/i);
  assert.deepEqual(await readdir(workDir), []);
});

test('runIsolated entrega literal&marca como un único argumento al proceso de prueba', async (t) => {
  const { root, workDir } = await sandbox(t);
  const cmd = realpathSync.native(process.execPath);
  const script = join(root, 'process.mjs');
  const input = join(root, 'nota.txt');
  await copyFile(new URL('../../runtime/workers/test/fixtures/process.mjs', import.meta.url), script);
  await writeFile(input, 'fixture temporal', { flag: 'wx' });

  const result = await runIsolated({ cmd, workDir, allowedPaths: [cmd, root], timeoutMs: 5_000,
    args: [{ path: script }, 'run', literal, { path: input }, { path: 'salida.txt' }] });
  assert.equal(result.exitCode, 7);
  assert.equal(result.killed, false);
  const observed = JSON.parse(await readFile(result.stdoutPath, 'utf8'));
  assert.equal(observed.literal, literal);
  assert.equal(await readFile(join(dirname(dirname(result.stdoutPath)), 'salida.txt'), 'utf8'), 'fixture temporal');
});

test('Blender restringe workDir y proyecto a las raíces declaradas y rechaza campos de código', async (t) => {
  const { root, outside, workDir, ctx } = await sandbox(t);
  const inside = await writeProject(root, project([layer('model3d')]));
  const outsideProject = await writeProject(outside, project([layer('model3d')]));
  const alias = join(root, 'alias');
  await symlink(outside, alias, junctionType);
  const adapter = createBlenderAdapter({ allowedRoots: [root], blenderPath: join(root, 'sin-motor.exe') });
  const request = job('render.image-sequence', inside, { layerId: 'capa' });

  const args = [
    { request, ctx: { ...ctx, workDir: outside }, message: /fuera de las raíces/ },
    { request, ctx: { ...ctx, workDir: workDir + '/../job' }, message: /componente "\.\."/ },
    { request: job(request.operation, outsideProject, request.requirements), ctx, message: /fuera de las raíces/ },
    { request: job(request.operation, join(alias, 'project.fme.json'), request.requirements), ctx, message: /enlace.*junction/i },
    { request: { ...request, requirements: { ...request.requirements, code: literal } }, ctx, message: /layerId y resolution/ },
  ];
  for (const example of args) {
    const result = await adapter.run(example.request, example.ctx);
    expectRejection(result, 'BLENDER_INVALID_JOB');
    assert.match(result.diagnostics[0]!.message, example.message);
  }
  assert.deepEqual(await readdir(workDir), []);
});

test('los tres adaptadores rechazan un trabajo con tipo de entrada text/plain', async (t) => {
  const { root, workDir, ctx } = await sandbox(t);
  const opaque = join(root, 'entrada.txt');
  const missingEngine = join(root, 'sin-motor');
  await writeFile(opaque, literal, { flag: 'wx' });
  const cases: { adapter: ConnectorAdapter; operation: string; requirements: JobRequest['requirements']; code: string }[] = [
    { adapter: createBlenderAdapter({ allowedRoots: [root], blenderPath: missingEngine }),
      operation: 'render.image-sequence', requirements: { layerId: 'capa' }, code: 'BLENDER_INVALID_JOB' },
    { adapter: new RevideoAdapter({ engineDir: missingEngine }),
      operation: 'render.video', requirements: { layerId: 'capa' }, code: 'bad-input' },
    { adapter: new FreeCutAdapter({ freecutDir: missingEngine }),
      operation: 'edit.export', requirements: { sceneId }, code: 'bad-input' },
  ];
  for (const { adapter, operation, requirements, code } of cases) {
    const request: JobRequest = { projectId: fixtureId, operation, requirements,
      inputs: [{ uri: pathToFileURL(opaque).href, type: 'text/plain' }] };
    expectRejection(await adapter.run(request, ctx), code);
  }
  assert.deepEqual(await readdir(workDir), []);
});

test('Revideo conserva literal&marca como contenido textual al preparar el trabajo', () => {
  const title = { ...layer('text'), text: { content: literal } };
  const engine = buildEngineJob(project([title]), title, {});
  assert.equal(engine.kind, 'text');
  assert.equal(engine.text, literal);
});

test('FreeCut edit.export mantiene las rutas de medios dentro de la carpeta de proyecto', async (t) => {
  const { root, outside, workDir, ctx } = await sandbox(t);
  const alias = join(root, 'alias');
  await writeFile(join(outside, 'media.mp4'), 'fixture temporal', { flag: 'wx' });
  await symlink(outside, alias, junctionType);
  const adapter = new FreeCutAdapter({ freecutDir: join(root, 'sin-motor') });
  const inputs = ['../vecino/media.mp4', 'alias/media.mp4'];
  for (const [index, uri] of inputs.entries()) {
    const filename = await writeProject(root, project([layer('video', 'medio')], [{ id: 'medio', type: 'video', uri }]),
      'media-' + index + '.fme.json');
    const result = await adapter.run(job('edit.export', filename, { sceneId }), ctx);
    expectRejection(result, 'asset-outside-project');
  }
  assert.deepEqual(await readdir(workDir), []);
});

function expectMcpPathRejection(result: Awaited<ReturnType<Client['callTool']>>): void {
  assert.equal(result.isError, true);
  assert.ok(Array.isArray(result.content));
  const message = result.content[0];
  assert.equal(message?.type, 'text');
  assert.equal(typeof message.text, 'string');
  assert.equal(JSON.parse(message.text).error.code, 'PATH_OUTSIDE_ROOT');
}

test('MCP rechaza proyectos fuera de la raíz antes de abrirlos o entregar un job', async (t) => {
  const { root, outside } = await sandbox(t);
  const inside = await writeProject(root, project());
  const outsideProject = await writeProject(outside, project());
  await symlink(outside, join(root, 'alias'), junctionType);

  const blender = createBlenderAdapter({ allowedRoots: [root], blenderPath: join(root, 'sin-motor.exe') });
  const registry = createConnectorRegistry();
  registry.register(blender.simple, blender.advanced);
  const server = createFmeServer({
    root,
    registry,
    adapters: new Map([[blender.simple.id, { ...blender, run: async () => assert.fail('MCP entregó un job rechazable') }]]),
  });
  const client = new Client({ name: 'fme-limites-test', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const control = await client.callTool({ name: 'project.open', arguments: { path: inside } });
    assert.notEqual(control.isError, true);
    for (const path of [outsideProject, '../vecino/project.fme.json', 'alias/project.fme.json']) {
      const result = await client.callTool({ name: 'project.open', arguments: { path } });
      expectMcpPathRejection(result);
    }
    const result = await client.callTool({ name: 'job.run', arguments: {
      connectorId: blender.simple.id,
      job: job('render.image-sequence', outsideProject, { layerId: 'capa' }),
    } });
    expectMcpPathRejection(result);
    assert.deepEqual((await readdir(root)).sort(), ['alias', 'job', 'project.fme.json']);
  } finally {
    await client.close();
    await server.close();
  }
});

test('CLI aplica --root a la lectura y a la escritura de proyectos', async (t) => {
  const { root, outside } = await sandbox(t);
  const inside = await writeProject(root, project());
  const outsideProject = await writeProject(outside, project());
  await symlink(outside, join(root, 'alias'), junctionType);

  async function execute(args: string[], restricted = true) {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const io = { stdout: (text: string) => stdout.push(text), stderr: (text: string) => stderr.push(text) };
    const exit = await runCli([...args, '--json', ...(restricted ? ['--root', root] : [])], io);
    return { exit, output: [...stdout, ...stderr].join('\n') };
  }

  assert.equal((await execute(['project', 'validate', 'project.fme.json'])).exit, 0);
  assert.equal((await execute(['project', 'validate', outsideProject], false)).exit, 0);
  for (const filename of [outsideProject, '../vecino/project.fme.json', 'alias/project.fme.json']) {
    const result = await execute(['project', 'validate', filename]);
    assert.notEqual(result.exit, 0);
    assert.match(result.output, /"code"\s*:\s*"PATH_OUTSIDE_ROOT"/);
  }

  for (const [command, target] of [['migrate', 'alias/copia.fme.json'], ['export', 'alias/exportacion']] as const) {
    const result = await execute(['project', command, inside, '--out', target]);
    assert.notEqual(result.exit, 0);
    assert.match(result.output, /"code"\s*:\s*"PATH_OUTSIDE_ROOT"/);
  }
  assert.deepEqual(await readdir(outside), ['project.fme.json']);
  assert.equal((await execute(['project', 'migrate', inside, '--out', 'copia.fme.json'])).exit, 0);
  assert.equal(await readFile(join(root, 'copia.fme.json'), 'utf8'), await readFile(inside, 'utf8'));
});

test('Revideo y FreeCut directos validan proyecto y workDir contra las raíces del anfitrión', async (t) => {
  const { root, outside, workDir, ctx } = await sandbox(t);
  const fixture = project([{ ...layer('text'), text: { content: literal } }]);
  const inside = await writeProject(root, fixture);
  const outsideProject = await writeProject(outside, fixture);
  const alias = join(root, 'alias');
  await symlink(outside, alias, junctionType);

  const missingEngine = join(root, 'sin-motor');
  const cases = [
    { adapter: new RevideoAdapter({ engineDir: missingEngine, allowedRoots: [root] }),
      operation: 'render.video', requirements: { layerId: 'capa' } },
    { adapter: new FreeCutAdapter({ freecutDir: missingEngine, allowedRoots: [root] }),
      operation: 'edit.export', requirements: { sceneId } },
  ];
  for (const { adapter, operation, requirements } of cases) {
    const request = job(operation, inside, requirements);
    expectRejection(await adapter.run(request, { ...ctx, workDir: outside }), 'path-outside-root');
    expectRejection(await adapter.run(request, { ...ctx, workDir: alias }), 'path-outside-root');
    for (const filename of [outsideProject, join(alias, 'project.fme.json')]) {
      expectRejection(await adapter.run(job(operation, filename, requirements), ctx), 'path-outside-root');
    }
    expectRejection(await adapter.run(request, ctx), 'engine-missing');
  }
  assert.deepEqual(await readdir(workDir), []);
  assert.deepEqual(await readdir(outside), ['project.fme.json']);
});

test('FreeCut edit.compose aplica las raíces del anfitrión a sus entradas absolutas', async (t) => {
  const { root, outside, workDir, ctx } = await sandbox(t);
  const inside = await writeProject(root, project([layer('video', 'medio')], [
    { id: 'medio', type: 'video', uri: 'medio.mp4' },
  ]));
  const alias = join(root, 'alias');
  await symlink(outside, alias, junctionType);
  await writeFile(join(outside, 'medio.mp4'), 'fixture temporal', { flag: 'wx' });
  const adapter = new FreeCutAdapter({ freecutDir: join(root, 'sin-motor'), allowedRoots: [root] });

  for (const filename of [join(outside, 'medio.mp4'), join(alias, 'medio.mp4')]) {
    const uri = pathToFileURL(filename).href;
    const withInput = job('edit.compose', inside, { sceneId });
    withInput.inputs = [...withInput.inputs, { uri, type: 'video/mp4' }];
    const withMap = job('edit.compose', inside, { sceneId, 'input.capa': uri });
    for (const request of [withInput, withMap]) {
      expectRejection(await adapter.run(request, ctx), 'asset-outside-project');
    }
  }
  await copyFile(join(outside, 'medio.mp4'), join(root, 'medio.mp4'));
  const admitted = job('edit.compose', inside, { sceneId, 'input.capa': 'medio.mp4' });
  expectRejection(await adapter.run(admitted, ctx), 'engine-missing');
  assert.deepEqual(await readdir(workDir), []);
});
