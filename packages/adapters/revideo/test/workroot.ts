// Raíz de trabajo PROPIA de los tests de integración (FDN-034b): nada de `os.tmpdir()`, así los tests
// pueden vigilar el temporal del sistema sin ver los directorios de otros tests en paralelo.
import { mkdirSync, mkdtempSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const workRoot = join(fileURLToPath(new URL('../', import.meta.url)), '.test-work');
mkdirSync(workRoot, { recursive: true });

/** Crea un directorio nuevo y único bajo la raíz propia (ruta canónica). */
export function newWorkDir(prefix: string): string {
  return realpathSync(mkdtempSync(join(workRoot, `${prefix}-`)));
}

/** Directorio para los logs de `probe()` (distinto por proceso de test). */
export const probeWorkDir = newWorkDir('probe');
