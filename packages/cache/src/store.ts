import { randomUUID } from 'node:crypto';
import { constants, lstatSync, realpathSync } from 'node:fs';
import { open, rename, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export type DiskCacheOptions = {
  /** Directorio preexistente y administrado por quien llama. */
  readonly allowedRoot: string;
  /** Directorio preexistente donde se guardan las entradas. Usa allowedRoot por defecto. */
  readonly directory?: string;
};

type Directory = { path: string; dev: bigint; ino: bigint };

const windows = process.platform === 'win32';
const windowsDrive = /^[a-z]:[/\\]/i;
const windowsDevice = /^(?:con(?:in\$|out\$)?|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³]) *(?:\.|$)/i;

function validateDirectorySyntax(path: string): void {
  const parts = windows ? path.slice(3).split(/[/\\]/) : path.split('/');
  if (!isAbsolute(path) || path.includes('\0') || parts.includes('..')) {
    throw new Error('La caché requiere rutas absolutas sin componentes "..".');
  }
  if (windows && (!windowsDrive.test(path) || parts.some((part) =>
    /[<>:"|?*\x00-\x1f]/.test(part) || /[ .]$/.test(part) || windowsDevice.test(part),
  ))) {
    throw new Error('La caché requiere una ruta de Windows local y sin componentes ambiguos.');
  }
}

function inspectDirectory(path: string): Directory {
  const volume = parse(path).root;
  let current = volume;
  for (const component of path.slice(volume.length).split(sep).filter(Boolean)) {
    current = join(current, component);
    if (!lstatSync(current).isDirectory()) {
      throw new Error('La ruta de caché contiene un enlace, junction o componente que no es un directorio.');
    }
  }
  const canonical = realpathSync.native(path);
  const { dev, ino } = lstatSync(canonical, { bigint: true });
  return { path: canonical, dev, ino };
}

function inside(root: string, candidate: string): boolean {
  const offset = relative(root, candidate);
  return !isAbsolute(offset) && offset !== '..' && !offset.startsWith('..' + sep);
}

function verifyDirectory(directory: Directory): void {
  const checked = inspectDirectory(directory.path);
  if (checked.path !== directory.path || checked.dev !== directory.dev || checked.ino !== directory.ino) {
    throw new Error('El directorio de caché cambió después de abrir el almacén.');
  }
}

function errorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
}

function isMissing(error: unknown): boolean {
  return errorCode(error) === 'ENOENT';
}

type FileOperation = 'rename' | 'unlink';
const windowsRetryBudgetMs = 1_000;

class DiskCacheRetryError extends Error {
  readonly code = 'CACHE_RETRY_EXHAUSTED';
  readonly operation: FileOperation;
  readonly attempts: number;

  constructor(operation: FileOperation, attempts: number, cause: unknown) {
    super('Se agotaron los reintentos de caché de ' + operation + ' en Windows.', { cause });
    this.name = 'DiskCacheRetryError';
    this.operation = operation;
    this.attempts = attempts;
  }
}

async function retryFileOperation(
  operation: FileOperation,
  verify: () => void,
  perform: () => Promise<void>,
): Promise<void> {
  const deadline = performance.now() + windowsRetryBudgetMs;
  let backoff = 10;
  let attempts = 0;
  while (true) {
    // Las comprobaciones de seguridad se repiten y sus fallos se propagan sin reintento.
    verify();
    attempts++;
    try {
      await perform();
      return;
    } catch (error) {
      const code = errorCode(error);
      if (!windows || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) throw error;

      const remaining = deadline - performance.now();
      if (remaining <= 0) throw new DiskCacheRetryError(operation, attempts, error);
      await delay(Math.min(backoff, remaining));
      backoff = Math.min(backoff * 2, 250);
    }
  }
}

function checkEntry(path: string): boolean {
  try {
    const entry = lstatSync(path);
    if (!entry.isFile() || entry.nlink > 1) {
      throw new Error('La entrada de caché debe ser un archivo regular sin enlaces.');
    }
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

/**
 * Almacén binario por SHA-256. Usa un directorio administrado por el llamador,
 * con permisos que impidan a terceros sustituir sus directorios o entradas.
 */
export class DiskCache {
  readonly #allowedRoot: Directory;
  readonly #directory: Directory;

  constructor({ allowedRoot, directory = allowedRoot }: DiskCacheOptions) {
    validateDirectorySyntax(allowedRoot);
    validateDirectorySyntax(directory);
    const allowed = resolve(allowedRoot);
    const selected = resolve(directory);
    if (dirname(allowed) === allowed || !inside(allowed, selected)) {
      throw new Error('El directorio de caché debe estar bajo la raíz autorizada.');
    }

    this.#allowedRoot = inspectDirectory(allowed);
    this.#directory = selected === allowed ? this.#allowedRoot : inspectDirectory(selected);
    const allowedPath = this.#allowedRoot.path;
    const selectedPath = this.#directory.path;
    if (selectedPath !== allowedPath && !selectedPath.startsWith(allowedPath + sep)) {
      throw new Error('El directorio canónico de caché queda fuera de la raíz autorizada.');
    }
  }

  #verifyDirectories(): void {
    verifyDirectory(this.#allowedRoot);
    if (this.#directory !== this.#allowedRoot) verifyDirectory(this.#directory);
  }

  #entryPath(key: string): string {
    if (typeof key !== 'string' || key.length !== 64 || /[^0-9a-f]/.test(key)) {
      throw new TypeError('La clave de caché debe ser un SHA-256 hexadecimal en minúsculas.');
    }
    this.#verifyDirectories();
    return join(this.#directory.path, key + '.bin');
  }

  async get(key: string): Promise<Buffer | undefined> {
    const path = this.#entryPath(key);
    if (!checkEntry(path)) return undefined;
    // O_NOFOLLOW protege la apertura en plataformas que lo implementan.
    const flags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0);
    const file = await open(path, flags).catch((error: unknown) => {
      if (!isMissing(error)) throw error;
      this.#verifyDirectories();
      return undefined;
    });
    if (!file) return undefined;
    try {
      this.#verifyDirectories();
      checkEntry(path);
      const stats = await file.stat();
      if (!stats.isFile() || stats.nlink > 1) {
        throw new Error('La entrada de caché abierta debe ser un archivo regular sin enlaces.');
      }
      return await file.readFile();
    } finally {
      await file.close();
    }
  }

  /** Publica los bytes completos por renombrado de un temporal exclusivo en el mismo directorio. */
  async set(key: string, bytes: Uint8Array): Promise<void> {
    const target = this.#entryPath(key);
    checkEntry(target);
    const temporary = join(this.#directory.path, '.cache-' + randomUUID() + '.tmp');
    const file = await open(temporary, 'wx', 0o600);
    try {
      try {
        await file.writeFile(bytes);
        await file.sync();
      } catch (error) {
        try {
          await file.close();
        } catch (closeError) {
          throw new AggregateError([error, closeError], 'Fallaron la escritura y el cierre de la entrada temporal.', { cause: error });
        }
        throw error;
      }
      await file.close();

      await retryFileOperation('rename', () => {
        this.#verifyDirectories();
        checkEntry(temporary);
        checkEntry(target);
      }, () => rename(temporary, target));
    } catch (error) {
      try {
        await retryFileOperation('unlink', () => {
          this.#verifyDirectories();
          checkEntry(temporary);
        }, () => unlink(temporary).catch((unlinkError: unknown) => {
          if (!isMissing(unlinkError)) throw unlinkError;
        }));
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], 'Fallaron la publicación y la limpieza de la entrada temporal.', { cause: error });
      }
      throw error;
    }
  }
}
