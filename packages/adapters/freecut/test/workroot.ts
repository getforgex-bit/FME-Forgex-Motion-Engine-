// Raíz de trabajo propia para tests de @fme/adapter-freecut (FDN-034b, sin usar os.tmpdir()).
import { mkdirSync, mkdtempSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const workRoot = join(fileURLToPath(new URL('../', import.meta.url)), '.test-work');
mkdirSync(workRoot, { recursive: true });

export function newWorkDir(prefix: string): string {
  return realpathSync(mkdtempSync(join(workRoot, `${prefix}-`)));
}

export const probeWorkDir = newWorkDir('probe');
