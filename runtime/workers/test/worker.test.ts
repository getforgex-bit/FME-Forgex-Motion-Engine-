import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { runIsolated } from '../src/index.ts';
import type { TestContext } from 'node:test';
import type { IsolatedRunResult, IsolatedRunOptions } from '../src/index.ts';

const fixture = realpathSync.native(fileURLToPath(new URL('./fixtures/process.mjs', import.meta.url)));
const executable = realpathSync.native(process.execPath);
const windows = process.platform === 'win32';

function setup(context: TestContext) {
  const root = mkdtempSync(join(realpathSync.native(tmpdir()), 'fme-workers-test-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const workDir = join(root, 'jobs');
  const outside = join(root, 'jobs-outside');
  mkdirSync(workDir);
  mkdirSync(outside);
  const input = join(workDir, 'input.txt');
  writeFileSync(input, 'contenido de prueba');
  return {
    input,
    outside,
    options: {
      cmd: executable,
      args: [{ path: fixture }],
      workDir,
      allowedPaths: [executable, fixture, workDir],
      timeoutMs: 5_000,
    } satisfies IsolatedRunOptions,
  };
}

function readLog(result: IsolatedRunResult) {
  return JSON.parse(readFileSync(join(dirname(result.stdoutPath), 'worker.json'), 'utf8'));
}

test('mantiene & literal, separa stdout/stderr y conserva la salida no cero y el entorno explícito', async (context) => {
  const { options, input } = setup(context);
  const previous = process.env.FME_WORKER_TEST_PARENT;
  process.env.FME_WORKER_TEST_PARENT = 'valor-del-proceso-padre';
  context.after(() => {
    if (previous === undefined) delete process.env.FME_WORKER_TEST_PARENT;
    else process.env.FME_WORKER_TEST_PARENT = previous;
  });
  const args = [...options.args, 'run'];
  const paths = [{ path: input }, { path: 'result.txt' }];
  const [first, second] = await Promise.all([
    runIsolated({ ...options, args: [...args, 'literal&without-shell', ...paths], env: { FME_EXPLICIT: 'solo-esta-variable' } }),
    runIsolated({ ...options, args: [...args, { literal: '30000/1001' }, ...paths] }),
  ]);
  for (const [result, explicit, expectedLiteral] of [
    [first, 'solo-esta-variable', 'literal&without-shell'],
    [second, null, '30000/1001'],
  ] as const) {
    assert.equal(result.exitCode, 7);
    assert.equal(result.killed, false);
    assert.ok(result.durationMs > 0);
    const jobDir = dirname(dirname(result.stdoutPath));
    assert.equal(dirname(jobDir), options.workDir);
    const { literal, cwd, explicit: childEnv, inherited } = JSON.parse(readFileSync(result.stdoutPath, 'utf8'));
    assert.equal(cwd, jobDir);
    assert.equal(literal, expectedLiteral);
    assert.equal(childEnv, explicit);
    assert.equal(inherited, null);
    assert.match(readFileSync(result.stderrPath, 'utf8'), /stderr de prueba/);
    assert.equal(readFileSync(join(jobDir, 'result.txt'), 'utf8'), 'contenido de prueba');
    assert.equal(readLog(result).timedOut, false);
    assert.equal(readLog(result).exitCode, 7);
  }
  assert.notEqual(first.stdoutPath, second.stdoutPath);
});

test('rechaza traversal, rutas externas, formas implícitas y ejecutables sin permiso individual', async (context) => {
  const { options, input, outside } = setup(context);
  const traversal = options.workDir + '/../jobs/input.txt';
  await assert.rejects(runIsolated({ ...options, workDir: outside }), /raíz permitida/);
  await assert.rejects(runIsolated({ ...options, workDir: traversal }), /\.\./);
  await assert.rejects(runIsolated({ ...options, cmd: 'node' }), /ruta absoluta/);
  await assert.rejects(
    runIsolated({ ...options, allowedPaths: [dirname(executable), fixture, options.workDir] }),
    /archivo individual/,
  );
  const forbidden = [
    { path: traversal },
    { path: '../outside.txt' },
    { path: join(outside, 'missing.txt') },
    { path: '.fme-worker/driver.log' },
    '../input.txt',
    '--input=../input.txt',
    { literal: '--input=../input.txt' },
    { literal: 'child/../input.txt' },
    { literal: '/outside/input.txt' },
    { literal: 'C:\\outside\\input.txt' },
    input,
    'C:\\outside\\input.txt',
  ];
  if (windows) {
    forbidden.push(
      { path: 'output.txt:stream' },
      { path: 'dir./output.txt' },
      { path: 'NUL.txt' },
      { path: 'C:output.txt' },
      { path: '\\\\server\\share\\file.txt' },
      { path: '.FME-WORKER/worker.json' },
    );
  }
  for (const argument of forbidden) {
    await assert.rejects(runIsolated({ ...options, args: [argument] }), /ruta|enlace/i);
  }
  assert.deepEqual(readdirSync(options.workDir), ['input.txt']);
});

test('rechaza enlaces y junctions, también cuando el archivo de destino todavía no existe', async (context) => {
  const { options, outside } = setup(context);
  const alias = join(options.workDir, 'alias');
  const target = join(outside, 'exists.txt');
  writeFileSync(target, 'externo');
  symlinkSync(outside, alias, windows ? 'junction' : 'dir');
  await assert.rejects(runIsolated({ ...options, workDir: alias }), /enlace o junction/i);
  await assert.rejects(
    runIsolated({ ...options, allowedPaths: [...options.allowedPaths, alias] }),
    /enlace o junction/i,
  );
  for (const file of ['exists.txt', 'not-created.txt']) {
    await assert.rejects(
      runIsolated({ ...options, args: [{ path: join(alias, file) }] }),
      /enlace o junction/i,
    );
  }
});

test('registra un fallo al lanzar un archivo inválido y conserva los archivos de log', async (context) => {
  const { options } = setup(context);
  const badExecutable = join(options.workDir, windows ? 'invalid.exe' : 'invalid');
  writeFileSync(badExecutable, 'no es un programa');
  const result = await runIsolated({ ...options, cmd: badExecutable, allowedPaths: [...options.allowedPaths, badExecutable] });
  assert.equal(result.exitCode, null);
  assert.equal(result.killed, false);
  assert.equal(typeof readLog(result).spawnError, 'string');
  assert.equal(readFileSync(result.stdoutPath, 'utf8'), '');
  assert.equal(readFileSync(result.stderrPath, 'utf8'), '');
});

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
    throw error;
  }
}

test('Windows termina el proceso, su hijo y su nieto al vencer el timeout', { skip: !windows }, async (context) => {
  const { options } = setup(context);
  const result = await runIsolated({ ...options, args: [{ path: fixture }, 'root'], timeoutMs: 2_500 });
  const processes = readFileSync(result.stdoutPath, 'utf8').trim().split(/\r?\n/).map((line) =>
    JSON.parse(line) as { mode: string; pid: number },
  );
  assert.equal(result.killed, true);
  const log = readLog(result);
  assert.equal(log.timedOut, true);
  assert.equal(log.processClosed, true);
  assert.equal(log.terminationError, null);
  assert.deepEqual(processes.map(({ mode }) => mode).sort(), ['child', 'grandchild', 'root']);
  const deadline = performance.now() + 2_000;
  while (processes.some(({ pid }) => processExists(pid)) && performance.now() < deadline) await delay(25);
  for (const { pid, mode } of processes) assert.equal(processExists(pid), false, mode + ' siguió activo');
  assert.equal(log.jobDir, resolve(result.stdoutPath, '../..'));
});
