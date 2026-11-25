import { lstatSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, parse, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Stats } from 'node:fs';

const windows = process.platform === 'win32';
const drivePath = /^[a-z]:[/\\]/i;
const windowsDevice = /^(?:con(?:in\$|out\$)?|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³]) *(?:\.|$)/i;

function requireLocalSyntax(value: string): void {
  if (!value || value.includes('\0') || value.split(/[/\\]/).includes('..')) {
    throw new Error('Ruta vacía, inválida o con un componente "..".');
  }
  if (windows) {
    const qualified = drivePath.test(value);
    const parts = (qualified ? value.slice(3) : value).split(/[/\\]/);
    if ((!qualified && isAbsolute(value)) || parts.some((part) =>
      part !== '.' && (/[<>:"|?*\x00-\x1f]|[ .]$/.test(part) || windowsDevice.test(part)),
    )) throw new Error('Ruta especial, ambigua o remota.');
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    throw new Error('Se requiere una ruta de archivo local.');
  }
}

export function filePath(uri: string, relativeTo?: string): string {
  if (uri.toLowerCase().startsWith('file:')) {
    if (decodeURIComponent(uri).split(/[/\\]/).includes('..')) throw new Error('URI con un componente "..".');
    const url = new URL(uri);
    if (url.hostname || url.search || url.hash) throw new Error('La URI debe referir a un archivo local.');
    uri = fileURLToPath(url);
  }

  requireLocalSyntax(uri);
  if (isAbsolute(uri)) return uri;
  if (relativeTo === undefined) throw new Error('El archivo de proyecto debe tener una ruta absoluta.');
  return join(relativeTo, uri);
}

function contains(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(root + sep);
}

function checkedPath(candidate: string, allowMissing: boolean): { path: string; stats?: Stats } {
  requireLocalSyntax(candidate);
  if (!isAbsolute(candidate)) throw new Error('Se requiere una ruta absoluta.');
  const full = resolve(candidate);
  const root = parse(full).root;
  const parts = full.slice(root.length).split(sep).filter(Boolean);
  let current = root;
  let stats = lstatSync(current);
  for (const [index, part] of parts.entries()) {
    if (!stats.isDirectory()) throw new Error('El padre de la ruta debe ser un directorio.');
    const next = join(current, part);
    try {
      stats = lstatSync(next);
    } catch (error) {
      if (!allowMissing || (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return { path: join(realpathSync.native(current), ...parts.slice(index)) };
    }
    if (stats.isSymbolicLink()) throw new Error('Enlace simbólico o junction rechazado.');
    current = next;
  }
  return { path: realpathSync.native(current), stats };
}

export function checkRoots(roots: readonly string[]): string[] {
  if (roots.length === 0) throw new Error('Se requiere una raíz de trabajo autorizada.');
  return roots.map((root) => {
    const checked = checkedPath(root, false);
    if (!checked.stats?.isDirectory() || dirname(checked.path) === checked.path) {
      throw new Error('Las raíces autorizadas deben ser directorios y quedar acotadas dentro de un volumen.');
    }
    return checked.path;
  });
}

export function requirePath(candidate: string, roots: readonly string[], kind: 'file' | 'directory'): string {
  const checked = checkedPath(candidate, false);
  if (!roots.some((root) => contains(root, checked.path))) throw new Error('Ruta fuera de las raíces autorizadas.');
  if (kind === 'file' ? !checked.stats?.isFile() : !checked.stats?.isDirectory()) {
    throw new Error('Tipo de archivo inesperado.');
  }
  return checked.path;
}

export function optionalAsset(candidate: string, roots: readonly string[]): string | undefined {
  const checked = checkedPath(candidate, true);
  if (!roots.some((root) => contains(root, checked.path))) throw new Error('Asset fuera de las raíces autorizadas.');
  if (!checked.stats) return undefined;
  if (!checked.stats.isFile()) throw new Error('El asset debe ser un archivo.');
  return checked.path;
}
