import { lstatSync, realpathSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, parse, resolve, sep } from 'node:path';
import type { Stats } from 'node:fs';

export type WorkerArgument =
  | string
  | { readonly path: string; readonly literal?: never }
  | { readonly literal: string; readonly path?: never };

type CheckedPath = { path: string; stats?: Stats };
const windows = process.platform === 'win32';
const windowsDrive = /^[a-z]:[/\\]/i;
const windowsDevice = /^(?:con(?:in\$|out\$)?|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³]) *(?:\.|$)/i;

function validateSyntax(value: string): void {
  const parts = value.split(/[/\\]/);
  if (!value || value.includes('\0') || parts.includes('..')) {
    throw new Error('Ruta vacía, inválida o con un componente "..": ' + value);
  }

  if (windows) {
    const qualified = windowsDrive.test(value);
    const rest = qualified ? value.slice(3) : value;
    if ((!qualified && isAbsolute(value)) || /[<>:"|?*\x00-\x1f]/.test(rest) ||
        rest.split(/[/\\]/).some((part) => part !== '.' && (/[ .]$/.test(part) || windowsDevice.test(part)))) {
      throw new Error('Ruta de Windows ambigua, especial o de red: ' + value);
    }
  }
}

function containsPathSyntax(value: string): boolean {
  const startsAtToken = /(?:^|[=,;\s"'(])(?:[a-z]:|[/\\])/i;
  const traversal = /(?:^|[=/\\,;:\s"'(])\.\.(?=$|[/\\,;:\s"')])/;
  return startsAtToken.test(value) || traversal.test(value);
}

function contains(root: string, path: string): boolean {
  return path === root || path.startsWith(root.endsWith(sep) ? root : root + sep);
}

function checkPath(candidate: string, allowMissing = false): CheckedPath {
  validateSyntax(candidate);
  if (!isAbsolute(candidate)) throw new Error('Se requiere una ruta absoluta: ' + candidate);

  // Inspecciona los componentes antes de resolverlos, incluidas las junctions de Windows.
  const fullPath = resolve(candidate);
  const root = parse(fullPath).root;
  const parts = fullPath.slice(root.length).split(sep).filter(Boolean);
  let current = root;
  let stats = lstatSync(root);
  for (let index = 0; index < parts.length; index++) {
    if (!stats.isDirectory()) throw new Error('El padre de la ruta debe ser un directorio: ' + current);
    const next = join(current, parts[index]!);
    try {
      stats = lstatSync(next);
    } catch (error) {
      if (!allowMissing || (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return { path: join(realpathSync.native(current), ...parts.slice(index)) };
    }
    if (stats.isSymbolicLink()) throw new Error('Enlace o junction rechazado: ' + next);
    current = next;
  }

  return { path: realpathSync.native(current), stats };
}

export function validateLaunch(cmd: string, workDir: string, allowedPaths: readonly string[]) {
  const entries = allowedPaths.map((entry) => checkPath(entry));
  const roots = entries.filter((entry) => entry.stats?.isDirectory()).map((entry) => entry.path);
  if (roots.some((root) => dirname(root) === root)) {
    throw new Error('Una raíz de volumen no puede incluirse en allowedPaths.');
  }

  const executable = checkPath(cmd);
  if (!executable.stats?.isFile() || (windows && extname(executable.path).toLowerCase() !== '.exe') ||
      !entries.some((entry) => entry.stats?.isFile() && entry.path === executable.path)) {
    throw new Error('El ejecutable debe aparecer como archivo individual en allowedPaths: ' + cmd);
  }

  const parent = checkPath(workDir);
  if (!parent.stats?.isDirectory() || !roots.some((root) => contains(root, parent.path))) {
    throw new Error('workDir debe ser un directorio bajo una raíz permitida: ' + workDir);
  }
  return { executable: executable.path, parent: parent.path, entries };
}

export function validateArguments(
  args: readonly WorkerArgument[],
  jobDir: string,
  logDir: string,
  entries: readonly CheckedPath[],
): string[] {
  return args.map((arg) => {
    if (typeof arg === 'string') {
      if (arg.includes('\0') || /[/\\]/.test(arg) || containsPathSyntax(arg)) {
        throw new Error('Un argumento con ruta debe declararse como { path }: ' + arg);
      }
      return arg;
    }

    if ('literal' in arg) {
      if ('path' in arg || arg.literal.includes('\0') || containsPathSyntax(arg.literal)) {
        throw new Error('Un argumento literal no puede declarar una ruta ni contener sintaxis de ruta absoluta o traversal.');
      }
      return arg.literal;
    }

    validateSyntax(arg.path);
    const candidate = isAbsolute(arg.path) ? arg.path : join(jobDir, arg.path);
    const checked = checkPath(candidate, true);
    const allowed = contains(jobDir, checked.path) || entries.some((entry) =>
      entry.stats?.isDirectory() ? contains(entry.path, checked.path) : entry.path === checked.path,
    );

    // Rechaza los destinos de dispositivos y otros archivos especiales.
    const reserved = windows ? contains(logDir.toLowerCase(), checked.path.toLowerCase()) : contains(logDir, checked.path);
    if (!allowed || reserved ||
        (checked.stats && !checked.stats.isFile() && !checked.stats.isDirectory())) {
      throw new Error('Ruta de argumento fuera de lo permitido: ' + arg.path);
    }
    return checked.path;
  });
}
