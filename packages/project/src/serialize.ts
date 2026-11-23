/**
 * Serialización determinista de `Project` (FDN-021): claves ordenadas alfabéticamente,
 * sangría de 2 espacios y salto de línea final, para que el round-trip sea byte a byte estable.
 */
import type { Project } from './index.ts';
import { parseProject, type ValidationIssue } from './schema.ts';

export type DeserializeResult =
  | { ok: true; value: Project }
  | { ok: false; errors: ValidationIssue[] };

/** Copia profunda con las claves de los objetos ordenadas; el orden de los arrays se conserva. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** Valida y serializa. Lanza `Error` si el proyecto no es válido (no se guarda basura). */
export function serialize(project: Project): string {
  const parsed = parseProject(project);
  if (!parsed.ok) {
    const detail = parsed.errors.map((e) => `${e.path}: ${e.message}`).join('; ');
    throw new Error(`Proyecto no válido, no se serializa: ${detail}`);
  }
  return `${JSON.stringify(sortKeys(parsed.value), null, 2)}\n`;
}

/** Parsea el JSON y lo valida. Un JSON mal formado da un error estructurado con código `invalid-json`. */
export function deserialize(text: string): DeserializeResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [{ path: '$', code: 'invalid-json', message: (e as Error).message }] };
  }
  return parseProject(raw);
}
