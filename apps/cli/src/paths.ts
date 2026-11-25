import { lstatSync, realpathSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { OpsError } from '@fme/mcp/ops';
import type { Project } from '@fme/project';

export type ScopedPath = (input: string, relativeTo?: string) => string;

function pathError(message: string): OpsError {
  return new OpsError('PATH_OUTSIDE_ROOT', message);
}

function existingAncestor(target: string): string {
  let ancestor = target;
  for (;;) {
    try {
      lstatSync(ancestor);
      // lstat conserva los enlaces rotos, que tampoco son ancestros autorizados.
      return ancestor;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const parent = dirname(ancestor);
      if (parent === ancestor) throw error;
      ancestor = parent;
    }
  }
}

export async function rootPathResolver(root: string): Promise<ScopedPath> {
  const { PathError, resolveInRoot } = await import('@fme/mcp');
  const declared = resolve(root);
  let canonical: string;
  try {
    if (!root || !statSync(declared).isDirectory()) throw pathError('--root debe señalar a un directorio existente.');
    canonical = realpathSync.native(declared);
  } catch {
    throw pathError('--root debe señalar a un directorio existente y accesible.');
  }

  return (input, relativeTo) => {
    try {
      const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(input) && !/^[a-z]:[/\\]/i.test(input);
      const requested = relativeTo !== undefined && !hasScheme ? resolve(relativeTo, input) : input;
      let target: string;
      try {
        target = resolveInRoot(declared, requested);
      } catch (error) {
        if (!(error instanceof PathError) || declared === canonical) throw error;
        target = resolveInRoot(canonical, requested);
      }
      const ancestor = existingAncestor(target);
      const actual = realpathSync.native(ancestor);
      const prefix = canonical.endsWith(sep) ? canonical : canonical + sep;
      if (actual !== canonical && !actual.startsWith(prefix)) {
        throw pathError('La ruta queda fuera de la raíz mediante un enlace.');
      }
      return resolve(actual, relative(ancestor, target));
    } catch (error) {
      if (error instanceof OpsError) throw error;
      if (error instanceof PathError) throw pathError(error.message);
      throw pathError('No se pudo comprobar la ruta dentro de --root: ' + input);
    }
  };
}

/** Valida los datos de la primera escena que podrían usarse como rutas durante la exportación. */
export function checkExportPaths(project: Project, projectFile: string, pathWithinRoot: ScopedPath): void {
  const layers = project.sequences[0]?.scenes[0]?.layers ?? [];
  const assetIds = new Set<string>();
  for (const layer of layers) {
    if (/[/\\\0]/.test(layer.id) || (process.platform === 'win32' && /[<>:"|?*\x00-\x1f]/.test(layer.id))) {
      throw pathError('El identificador de una capa de exportación debe poder usarse como nombre local.');
    }
    if (layer.assetId !== undefined) assetIds.add(layer.assetId);
  }

  for (const asset of project.assets) {
    if (!assetIds.has(asset.id)) continue;
    let path: string;
    try {
      path = asset.uri.startsWith('file:') ? decodeURIComponent(asset.uri) : asset.uri;
    } catch {
      throw pathError('La URI de un asset de exportación no es válida.');
    }
    if (path.split(/[/\\]/).includes('..')) throw pathError('La ruta de un asset de exportación contiene "..".');
    pathWithinRoot(asset.uri, dirname(projectFile));
  }
}
