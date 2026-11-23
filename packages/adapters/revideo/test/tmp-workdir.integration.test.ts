// FDN-034: los temporales de Revideo, Vite y Chrome quedan en ctx.workDir (ADR-0011 punto 3).
// SKIP con motivo si el motor no está disponible.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { RevideoAdapter, newJobId } from '../src/index.ts';

const repo = fileURLToPath(new URL('../../../../', import.meta.url));
const fixturePath = join(repo, 'examples', 'prueba-hibrida-10s', 'project.fme.json');
const phase1Cache = join(repo, 'examples', 'fase1', 'revideo', 'out', '.puppeteer');
const puppeteerCacheDir = process.env.FME_PUPPETEER_CACHE_DIR ?? (existsSync(phase1Cache) ? phase1Cache : undefined);
const engineVite = join(repo, 'runtime', 'engines', 'revideo', 'node_modules', '.vite');

const adapter = new RevideoAdapter(puppeteerCacheDir ? { puppeteerCacheDir } : {});
const probe = await adapter.probe();
const skip = !probe.available
  ? `motor Revideo no disponible: ${probe.diagnostics.map((d) => d.message).join(' | ')}`
  : !puppeteerCacheDir ? 'no se indicó dónde está Chrome (FME_PUPPETEER_CACHE_DIR)' : false;

/** Entradas del temporal del sistema que podrían ser de Revideo, Vite o Puppeteer. */
const OURS = /revideo|puppeteer|vite|chrome|fme-|scoped_dir/i;
const sysTmp = (): string[] => readdirSync(tmpdir()).filter((n) => OURS.test(n));

/** Mayor mtime (ms) de un árbol; 0 si no existe. */
function newest(dir: string): number {
  if (!existsSync(dir)) return 0;
  let max = statSync(dir).mtimeMs;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    max = Math.max(max, st.isDirectory() ? newest(p) : st.mtimeMs);
  }
  return max;
}

test('un job no deja temporales en os.tmpdir() ni toca node_modules/.vite del motor; todo queda en workDir', { skip, timeout: 240_000 }, async () => {
  const before = new Set(sysTmp());
  const viteBefore = newest(engineVite);
  const workDir = realpathSync(mkdtempSync(join(tmpdir(), 'fme-tmpwd-')));
  const jobId = newJobId();
  const result = await adapter.run({
    projectId: 'prueba-hibrida-10s', operation: 'render.video',
    inputs: [{ uri: fixturePath, type: 'fme/project+json' }],
    requirements: { layerId: 'capa-titulo', text: 'tmp' },
  }, { jobId, workDir, timeoutMs: 180_000 });
  assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics));

  const added = sysTmp().filter((n) => !before.has(n) && !n.startsWith('fme-tmpwd-'));
  assert.deepEqual(added, [], `entradas nuevas en ${tmpdir()}: ${added.join(', ')}`);
  assert.equal(newest(engineVite), viteBefore, 'se modificó la caché de Vite del motor');

  const jobTmp = join(workDir, `${jobId}.tmp`);
  assert.ok(existsSync(jobTmp), 'debe existir el temporal del job dentro de workDir');
  assert.ok(readdirSync(jobTmp).length > 0, 'los temporales del motor deben haberse escrito en workDir');
});
