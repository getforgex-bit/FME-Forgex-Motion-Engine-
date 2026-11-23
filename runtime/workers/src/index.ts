import { execFile, spawn } from 'node:child_process';
import { closeSync, mkdirSync, mkdtempSync, openSync, rmdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { validateArguments, validateLaunch } from './paths.ts';
import type { ChildProcess } from 'node:child_process';
import type { WorkerArgument } from './paths.ts';

export type { WorkerArgument } from './paths.ts';

export type IsolatedRunOptions = {
  readonly cmd: string;
  readonly args: readonly WorkerArgument[];
  readonly workDir: string;
  readonly allowedPaths: readonly string[];
  readonly timeoutMs: number;
  readonly env?: Readonly<Record<string, string>>;
};

export type IsolatedRunResult = {
  exitCode: number | null;
  stdoutPath: string;
  stderrPath: string;
  durationMs: number;
  killed: boolean;
};

type LaunchResult = { child: ChildProcess } | { spawnError: string };

type ProcessOutcome = {
  exitCode: number | null;
  killed: boolean;
  pid: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  processClosed: boolean;
  spawnError: string | null;
  processError: string | null;
  terminationError: string | null;
};

const windows = process.platform === 'win32';
const shutdownGraceMs = 2_000;

function launch(
  cmd: string,
  args: readonly string[],
  cwd: string,
  env: Readonly<Record<string, string>>,
  stdoutPath: string,
  stderrPath: string,
): LaunchResult {
  const stdout = openSync(stdoutPath, 'wx', 0o600);
  try {
    const stderr = openSync(stderrPath, 'wx', 0o600);
    try {
      return {
        child: spawn(cmd, args, {
          cwd,
          env: { ...env },
          shell: false,
          stdio: ['ignore', stdout, stderr],
          windowsHide: true,
          detached: !windows,
        }),
      };
    } catch (error) {
      return { spawnError: errorMessage(error) };
    } finally {
      closeSync(stderr);
    }
  } finally {
    closeSync(stdout);
  }
}

async function waitWithin<T>(promise: Promise<T>, timeoutMs: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const expired = new Promise<undefined>((resolve) => {
      timer = setTimeout(() => resolve(undefined), timeoutMs);
    });
    return await Promise.race([promise, expired]);
  } finally {
    clearTimeout(timer);
  }
}

async function terminateTree(child: ChildProcess): Promise<void> {
  const pid = child.pid;
  if (!pid || child.exitCode !== null || child.signalCode !== null) {
    throw new Error('El proceso raíz ya no está disponible para terminar su árbol.');
  }
  if (!windows) {
    process.kill(-pid, 'SIGKILL');
    return;
  }

  const systemRoot = process.env.SystemRoot;
  if (!systemRoot || !isAbsolute(systemRoot)) throw new Error('SystemRoot no identifica la instalación de Windows.');
  const taskkill = join(systemRoot, 'System32', 'taskkill.exe');
  await new Promise<void>((resolve, reject) => {
    execFile(taskkill, ['/PID', String(pid), '/T', '/F'], {
      env: { SystemRoot: systemRoot },
      shell: false,
      timeout: 5_000,
      windowsHide: true,
    }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function observe(child: ChildProcess, timeoutMs: number): Promise<ProcessOutcome> {
  let childError: string | null = null;
  const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.on('error', (error) => { childError = errorMessage(error); });
    child.once('close', (code, signal) => resolve({ code, signal }));
  });

  let outcome = await waitWithin(closed, timeoutMs);
  const timedOut = outcome === undefined;
  let killed = false;
  let terminationError: string | null = null;
  if (timedOut) {
    try {
      await terminateTree(child);
      killed = true;
    } catch (error) {
      terminationError = errorMessage(error);
      // Mantiene la terminación acotada incluso si falló la operación sobre el árbol.
      if (child.exitCode === null && child.signalCode === null) {
        try {
          if (!child.kill('SIGKILL')) terminationError += ' | No se pudo enviar la señal al proceso raíz.';
        } catch (killError) {
          terminationError += ' | ' + errorMessage(killError);
        }
      }
    }

    outcome = await waitWithin(closed, shutdownGraceMs);
    if (!outcome) child.unref();
  }

  return {
    exitCode: outcome?.code ?? null,
    killed,
    pid: child.pid ?? null,
    signal: outcome?.signal ?? null,
    timedOut,
    processClosed: outcome !== undefined,
    spawnError: child.pid === undefined ? childError : null,
    processError: child.pid === undefined ? null : childError,
    terminationError,
  };
}

/** Ejecuta una herramienta y argumentos preparados por un adaptador de confianza. */
export async function runIsolated(options: IsolatedRunOptions): Promise<IsolatedRunResult> {
  const { cmd, args, workDir, allowedPaths, timeoutMs, env = {} } = options;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) {
    throw new RangeError('timeoutMs debe ser un entero positivo admitido por el temporizador de Node.');
  }

  const { executable, parent, entries } = validateLaunch(cmd, workDir, allowedPaths);
  const jobDir = mkdtempSync(join(parent, 'fme-job-'));
  const logDir = join(jobDir, '.fme-worker');
  let checkedArgs: string[];
  try {
    checkedArgs = validateArguments(args, jobDir, logDir, entries);
  } catch (error) {
    try {
      rmdirSync(jobDir);
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Falló la validación del trabajo y la eliminación del directorio vacío.');
    }
    throw error;
  }

  mkdirSync(logDir, { mode: 0o700 });
  const stdoutPath = join(logDir, 'stdout.log');
  const stderrPath = join(logDir, 'stderr.log');
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const launchResult = launch(executable, checkedArgs, jobDir, env, stdoutPath, stderrPath);
  const outcome: ProcessOutcome = 'child' in launchResult ? await observe(launchResult.child, timeoutMs) : {
    exitCode: null,
    killed: false,
    pid: null,
    signal: null,
    timedOut: false,
    processClosed: false,
    spawnError: launchResult.spawnError,
    processError: null,
    terminationError: null,
  };
  const result: IsolatedRunResult = {
    exitCode: outcome.exitCode,
    stdoutPath,
    stderrPath,
    durationMs: Math.round(performance.now() - started),
    killed: outcome.killed,
  };
  const log = { ...outcome, ...result, startedAt, jobDir, executable };
  writeFileSync(join(logDir, 'worker.json'), JSON.stringify(log, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return result;
}
