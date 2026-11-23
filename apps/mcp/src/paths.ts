/**
 * Validación de rutas del servidor MCP (FDN-080): toda ruta que llega de un agente debe quedar
 * dentro de la raíz configurada, también tras resolver enlaces simbólicos.
 */
import { existsSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export class PathError extends Error {
  readonly code = 'PATH_OUTSIDE_ROOT';
  constructor(message: string) {
    super(message);
    this.name = 'PathError';
  }
}

function isInside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel));
}

/** Resuelve `input` (ruta o URL `file:`) contra `root` y comprueba que queda dentro. Devuelve la ruta absoluta. */
export function resolveInRoot(root: string, input: string): string {
  if (typeof input !== 'string' || input.length === 0 || input.includes('\0')) {
    throw new PathError('La ruta debe ser una cadena no vacía sin caracteres nulos.');
  }
  const rootAbs = resolve(root);
  let raw = input;
  if (/^[a-z][a-z0-9+.-]+:/i.test(input) && !/^[a-z]:[\\/]/i.test(input)) {
    if (!input.startsWith('file:')) throw new PathError(`Solo se admiten rutas locales o URL file:, no «${input.split(':')[0]}:».`);
    raw = fileURLToPath(input);
  }
  const target = resolve(rootAbs, raw);
  if (!isInside(rootAbs, target)) throw new PathError(`La ruta «${input}» queda fuera de la raíz del proyecto.`);
  // Enlaces simbólicos: el ancestro existente más cercano debe seguir dentro de la raíz real.
  let probe = target;
  while (!existsSync(probe)) {
    const parent = dirname(probe);
    if (parent === probe) break;
    probe = parent;
  }
  if (!isInside(realpathSync(rootAbs), realpathSync(probe))) {
    throw new PathError(`La ruta «${input}» sale de la raíz mediante un enlace simbólico.`);
  }
  return target;
}
