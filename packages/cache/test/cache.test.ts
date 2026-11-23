import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { link, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { DependencyGraph, DiskCache, dependencyHash } from '../src/index.ts';
import type { JsonValue } from '../src/index.ts';

const inputs = {
  projectId: 'project',
  segment: { start: 0, frames: 60, composition: { '2': 'over', '10': 'under' } },
  assets: [{ id: 'image', sha256: 'first' }, { id: 'music', sha256: 'second' }],
  adapters: [{ id: 'adapter.blender', version: '5.2.3' }],
};

test('calcula SHA-256 del JSON con claves ordenadas incluso en objetos anidados', () => {
  const reordered = {
    assets: [{ sha256: 'first', id: 'image' }, { sha256: 'second', id: 'music' }],
    adapters: [{ version: '5.2.3', id: 'adapter.blender' }],
    segment: { frames: 60, composition: { '10': 'under', '2': 'over' }, start: 0 },
    projectId: 'project',
  };
  const text = '{"adapters":[{"id":"adapter.blender","version":"5.2.3"}],"assets":[{"id":"image","sha256":"first"},{"id":"music","sha256":"second"}],"projectId":"project","segment":{"composition":{"10":"under","2":"over"},"frames":60,"start":0}}';
  const hash = dependencyHash(inputs);
  assert.equal(hash, createHash('sha256').update(text, 'utf8').digest('hex'));
  assert.equal(dependencyHash(reordered), hash);
  assert.notEqual(dependencyHash({ ...inputs, adapters: [{ ...inputs.adapters[0], version: '5.2.4' }] }), hash);
  assert.notEqual(dependencyHash({ ...inputs, assets: [...inputs.assets].reverse() }), hash);
});

test('rechaza valores ambiguos en JSON y admite referencias compartidas sin ciclos', () => {
  const shared = { frame: 10 };
  assert.equal(
    dependencyHash({ ...inputs, segment: [shared, shared] }),
    dependencyHash({ ...inputs, segment: [{ frame: 10 }, { frame: 10 }] }),
  );
  const cycle: Record<string, JsonValue> = {};
  cycle.self = cycle;
  for (const segment of [NaN, Infinity, cycle, new Array<JsonValue>(1), new Date() as unknown as JsonValue]) {
    assert.throws(() => dependencyHash({ ...inputs, segment }), TypeError);
  }
});

test('invalida solo dependientes transitivos y mantiene el grafo para reintentos', () => {
  const graph = new DependencyGraph();
  graph.setDependencies('layer', ['asset']);
  graph.setDependencies('render', ['layer', 'layer', 'audio']);
  graph.setDependencies('alternate', ['layer']);
  graph.setDependencies('preview', ['render', 'alternate']);
  graph.setDependencies('unrelated', ['other']);
  assert.deepEqual(graph.invalidate('layer'), ['alternate', 'preview', 'render']);
  assert.deepEqual(graph.invalidate('audio'), ['preview', 'render']);
  assert.deepEqual(graph.invalidate('asset'), ['alternate', 'layer', 'preview', 'render']);
  assert.deepEqual(graph.invalidate('layer'), ['alternate', 'preview', 'render']);
  assert.deepEqual(graph.invalidate('unknown'), []);
});

test('termina en ciclos, deduplica aristas y reemplaza dependencias sin dejar enlaces previos', () => {
  const graph = new DependencyGraph();
  graph.setDependencies('a', ['a', 'c']);
  graph.setDependencies('b', ['a', 'a']);
  graph.setDependencies('c', ['b']);
  assert.deepEqual(graph.invalidate('a'), ['b', 'c']);
  assert.deepEqual(graph.invalidate('c'), ['a', 'b']);

  graph.setDependencies('b', ['seed']);
  assert.deepEqual(graph.invalidate('a'), []);
  assert.deepEqual(graph.invalidate('seed'), ['a', 'b', 'c']);
  graph.setDependencies('b', []);
  assert.deepEqual(graph.invalidate('seed'), []);
});

async function temporaryRoot(context: TestContext): Promise<string> {
  const root = await mkdtemp(join(realpathSync.native(tmpdir()), 'fme-cache-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

const key = dependencyHash(inputs);
const filename = key + '.bin';

test('guarda los bytes, reemplaza entradas completas y deja el valor anterior si falla la escritura', async (context) => {
  const root = await temporaryRoot(context);
  const cache = new DiskCache({ allowedRoot: root });
  const first = Buffer.from([0, 255, 1]);
  const second = Buffer.from([2, 0, 254, 255]);

  assert.equal(await cache.get(key), undefined);
  await cache.set(key, first);
  assert.deepEqual(await cache.get(key), first);
  assert.deepEqual(await readFile(join(root, filename)), first);
  await assert.rejects(cache.set(key, null as unknown as Uint8Array), TypeError);
  assert.deepEqual(await cache.get(key), first);
  await cache.set(key, second);
  assert.deepEqual(await cache.get(key), second);
  assert.deepEqual(await readdir(root), [filename]);
});

test('publica una entrada completa con escrituras concurrentes', async (context) => {
  const root = await temporaryRoot(context);
  const cache = new DiskCache({ allowedRoot: root });
  const first = Buffer.alloc(512 * 1024, 11);
  const second = Buffer.alloc(512 * 1024, 22);
  const third = Buffer.alloc(512 * 1024, 33);
  await cache.set(key, first);

  const [, , observed] = await Promise.all([
    cache.set(key, second),
    cache.set(key, third),
    cache.get(key),
  ]);
  assert.ok(observed && [first, second, third].some((value) => value.equals(observed)));
  const final = await cache.get(key);
  assert.ok(final && [second, third].some((value) => value.equals(final)));
  assert.deepEqual(await readdir(root), [filename]);
});

test('rechaza directorios fuera de la raíz y claves que contienen rutas', async (context) => {
  const parent = await temporaryRoot(context);
  const root = join(parent, 'allowed');
  const outside = join(parent, 'allowed-other');
  const nested = join(root, 'store');
  await mkdir(nested, { recursive: true });
  await mkdir(outside);

  assert.throws(() => new DiskCache({ allowedRoot: root, directory: outside }), /raíz autorizada/);
  const cache = new DiskCache({ allowedRoot: root, directory: nested });
  for (const invalid of [join(outside, filename), '../' + filename, '..\\' + filename, key + '\n', key.slice(1) + '\n', key.toUpperCase()]) {
    await assert.rejects(cache.get(invalid), /clave de caché/);
    await assert.rejects(cache.set(invalid, Buffer.from('datos')), /clave de caché/);
  }
  const traversal = root + '/store/../store';
  assert.throws(() => new DiskCache({ allowedRoot: root, directory: traversal }), /componentes/);
  assert.deepEqual(await readdir(outside), []);
  assert.deepEqual(await readdir(nested), []);
});

test('rechaza un enlace de directorio, una entrada enlazada y una raíz sustituida', async (context) => {
  const parent = await temporaryRoot(context);
  const root = join(parent, 'allowed');
  const outside = join(parent, 'outside');
  const nested = join(root, 'cache');
  await mkdir(nested, { recursive: true });
  await mkdir(outside);
  const type = process.platform === 'win32' ? 'junction' : 'dir';

  const escape = join(root, 'escape');
  await symlink(outside, escape, type);
  assert.throws(() => new DiskCache({ allowedRoot: root, directory: escape }), /junction/);
  assert.throws(() => new DiskCache({ allowedRoot: escape }), /junction/);

  const cache = new DiskCache({ allowedRoot: root, directory: nested });
  const outsideFile = join(outside, filename);
  await writeFile(outsideFile, 'reservado');
  await link(outsideFile, join(nested, filename));
  await assert.rejects(cache.get(key), /sin enlaces/);
  await assert.rejects(cache.set(key, Buffer.from('datos')), /sin enlaces/);
  assert.equal(await readFile(outsideFile, 'utf8'), 'reservado');

  await rename(nested, join(root, 'original'));
  await mkdir(nested);
  await assert.rejects(cache.get(key), /cambió/);
  await assert.rejects(cache.set(key, Buffer.from('datos')), /cambió/);

  const replacement = new DiskCache({ allowedRoot: root, directory: nested });
  await symlink(outside, join(nested, filename), type);
  await assert.rejects(replacement.get(key), /sin enlaces/);
  await assert.rejects(replacement.set(key, Buffer.from('datos')), /sin enlaces/);
});
