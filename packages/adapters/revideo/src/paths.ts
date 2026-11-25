import { lstatSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const windows = process.platform === 'win32';
const device = /^(?:con(?:in\$|out\$)?|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³]) *(?:\.|$)/i;

export function scopedFilePath(uri: string): string {
  const isFileUrl = /^file:/i.test(uri);
  const spelling = isFileUrl ? decodeURIComponent(uri.split(/[?#]/, 1)[0]!) : uri;
  if (spelling.includes('\0') || spelling.split(/[\\/]/).includes('..')) {
    throw new Error('Ruta inválida o con componente "..".');
  }
  return isFileUrl ? fileURLToPath(uri) : uri;
}

function absolutePath(path: string): string {
  if (!isAbsolute(path) || path.includes('\0') || path.split(/[\\/]/).includes('..')) {
    throw new Error('Se requiere una ruta absoluta sin componentes "..".');
  }
  if (windows && (!/^[a-z]:[\\/]/i.test(path) || path.slice(3).split(/[\\/]/).some((part) =>
    /[<>:"|?*\x00-\x1f]/.test(part) || /[ .]$/.test(part) || device.test(part),
  ))) throw new Error('Ruta de Windows no local o ambigua.');
  return resolve(path);
}

export function scopedRoots(roots: readonly string[]): readonly string[] {
  if (roots.length === 0) throw new Error('Se requiere al menos una raíz permitida.');
  return roots.map((root) => {
    const path = absolutePath(root);
    const canonical = realpathSync.native(path);
    if (relative(path, canonical) !== '' || !statSync(canonical).isDirectory() || dirname(canonical) === canonical) {
      throw new Error('La raíz permitida debe ser un directorio local sin enlaces dentro de un volumen.');
    }
    return canonical;
  });
}

export function requireScopedPath(
  input: string,
  roots: readonly string[],
  kind: 'file' | 'directory',
  allowMissing = false,
): string {
  const path = absolutePath(input);
  if (!roots.some((root) => {
    const offset = relative(root, path);
    return !isAbsolute(offset) && offset !== '..' && !offset.startsWith('..' + sep);
  })) throw new Error('Ruta fuera de las raíces permitidas.');

  let entry;
  try {
    entry = lstatSync(path);
  } catch (error) {
    if (!allowMissing || (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const parent = requireScopedPath(dirname(path), roots, 'directory', true);
    return resolve(parent, basename(path));
  }
  const canonical = realpathSync.native(path);
  if (!roots.some((root) => canonical === root || canonical.startsWith(root + sep))) {
    throw new Error('Ruta canónica fuera de las raíces permitidas.');
  }
  const stats = entry.isSymbolicLink() ? statSync(canonical) : entry;
  const regular = kind === 'file' ? stats.isFile() : stats.isDirectory();
  if (!regular) throw new Error('Tipo de ruta inesperado.');
  return canonical;
}

export function requireScopedJobId(jobId: string): void {
  if (!jobId || /[\\/\0]/.test(jobId) || jobId === '.' || jobId === '..' ||
      (windows && (/[<>:"|?*\x00-\x1f]/.test(jobId) || /[ .]$/.test(jobId) || device.test(jobId)))) {
    throw new Error('jobId debe corresponder a un nombre de archivo local.');
  }
}

export function requireUnusedJobPaths(paths: readonly string[]): void {
  for (const path of paths) {
    try {
      lstatSync(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    throw new Error('Una ruta derivada de jobId ya existe.');
  }
}
