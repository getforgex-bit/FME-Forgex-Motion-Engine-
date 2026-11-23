// FDN-033: cierre de la Fase 3, de extremo a extremo con el motor real.
// registro → listSimple → inspect(['technical']) solo si hace falta → run → checkAdapterResult → RenderArtifact
// (dependencyHash de @fme/cache) → enlace en la capa → parseProject. SKIP con motivo si el motor no está disponible.
//
// `Project` (v1) no tiene dónde guardar los RenderArtifact: se escriben junto al proyecto en `workDir/artifacts.json` (nota para FDN-042).
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dependencyHash } from '@fme/cache';
import type { JsonValue } from '@fme/cache';
import { checkAdapterResult, createConnectorRegistry } from '@fme/connectors';
import { deserialize, parseProject, serialize } from '@fme/project';
import type { Project, RenderArtifact } from '@fme/project';
import { RevideoAdapter, newJobId } from '../src/index.ts';

const repo = fileURLToPath(new URL('../../../../', import.meta.url));
const fixturePath = join(repo, 'examples', 'prueba-hibrida-10s', 'project.fme.json');
const phase1Cache = join(repo, 'examples', 'fase1', 'revideo', 'out', '.puppeteer');
const puppeteerCacheDir = process.env.FME_PUPPETEER_CACHE_DIR ?? (existsSync(phase1Cache) ? phase1Cache : undefined);

const adapter = new RevideoAdapter(puppeteerCacheDir ? { puppeteerCacheDir } : {});
const probe = await adapter.probe();
const skip = !probe.available
  ? `motor Revideo no disponible: ${probe.diagnostics.map((d) => d.message).join(' | ')}`
  : !puppeteerCacheDir
    ? 'no se indicó dónde está Chrome (FME_PUPPETEER_CACHE_DIR) ni existe la caché de examples/fase1/revideo'
    : false;

const probeMedia = ((await import(new URL('../../../../scripts/probe-media.mjs', import.meta.url).href)) as {
  probeMedia: (f: string, o: { ffprobe: string }) => Promise<{ fps: number | null; frames: number | null }>;
}).probeMedia;

const plain = (v: unknown): JsonValue => JSON.parse(JSON.stringify(v)) as JsonValue;

test('Fase 3 e2e: descubrir → ejecutar → procedencia → RenderArtifact → enlace en la capa → proyecto válido', { skip, timeout: 300_000 }, async () => {
  // 1-3. Registro y descubrimiento (la tarjeta avanzada solo se lee si hace falta).
  const registry = createConnectorRegistry();
  registry.register(adapter.simple, adapter.advanced);
  const found = registry.listSimple({ capability: 'render.video', accepts: 'fme/project+json' });
  assert.deepEqual(found.map((e) => e.card.id), ['revideo']);
  assert.equal(found[0]!.requiresInspection, false, 'con la tarjeta simple basta para render.video');

  const needsAlpha = registry.listSimple({ capability: 'render.video', technical: { alpha: 'yes' } });
  // La tarjeta simple no declara `alpha`: el registro pide inspeccionar SOLO la sección technical.
  const alphaEntry = needsAlpha.find((e) => e.card.id === 'revideo');
  assert.ok(alphaEntry);
  if (alphaEntry.requiresInspection) {
    assert.deepEqual(alphaEntry.inspectionSections, ['technical']);
    const inspected = registry.inspect('revideo', ['technical']);
    assert.deepEqual(Object.keys(inspected.sections), ['technical']);
    assert.equal(inspected.sections.technical?.alpha, 'yes');
  }

  // 4. Job real con la capa de título de la fixture híbrida.
  const parsed = deserialize(readFileSync(fixturePath, 'utf8'));
  assert.ok(parsed.ok);
  const project: Project = parsed.value;
  const ctx = { jobId: newJobId(), workDir: realpathSync(mkdtempSync(join(tmpdir(), 'fme-e2e-'))), timeoutMs: 180_000 };
  const text = 'FME e2e';
  const result = await adapter.run({
    projectId: project.id, operation: 'render.video',
    inputs: [{ uri: fixturePath, type: 'fme/project+json' }],
    requirements: { layerId: 'capa-titulo', text }, seed: project.seed,
  }, ctx);
  assert.deepEqual(result.diagnostics, [], JSON.stringify(result.diagnostics));

  // 5. Conformidad y medios.
  assert.equal(result.status, 'ok');
  assert.deepEqual(checkAdapterResult(result, adapter), []);
  const media = await probeMedia(fileURLToPath(result.outputs[0]!.uri), { ffprobe: process.env.FME_FFPROBE_PATH ?? 'ffprobe' });
  assert.deepEqual([media.frames, media.fps], [120, 30]);

  // 6. Procedencia → RenderArtifact con dependencyHash.
  const prov = result.provenance[0]!;
  const layer = project.sequences[0]!.scenes[0]!.layers.find((l) => l.id === 'capa-titulo')!;
  const hash = dependencyHash({
    projectId: project.id,
    segment: plain({ layer, fps: project.fps, width: project.width, height: project.height, text }),
    assets: project.assets.filter((a) => a.id === layer.assetId).map(plain),
    adapters: [plain({ pluginId: prov.pluginId, pluginVersion: prov.pluginVersion, engineVersion: prov.engineVersion, params: prov.params })],
  });
  assert.match(hash, /^[0-9a-f]{64}$/);
  const artifact: RenderArtifact = {
    id: `render-${layer.id}-${hash.slice(0, 12)}`,
    uri: prov.uri,
    type: prov.type,
    dependencyHash: hash,
    producedBy: { pluginId: prov.pluginId, pluginVersion: prov.pluginVersion },
    ...(prov.seed !== undefined ? { seed: prov.seed } : {}),
    config: { ...prov.params, engineVersion: prov.engineVersion, sha256: prov.sha256 },
  };

  // 7. Enlace en la capa y validación del proyecto resultante.
  const linked = structuredClone(project);
  const target = linked.sequences[0]!.scenes[0]!.layers.find((l) => l.id === 'capa-titulo')!;
  target.externalProject = { ...target.externalProject!, pluginId: 'revideo', engineVersion: prov.engineVersion, renderArtifactId: artifact.id };
  const checked = parseProject(JSON.parse(serialize(linked)));
  assert.ok(checked.ok, checked.ok ? '' : JSON.stringify(checked.errors));
  assert.equal(checked.value.sequences[0]!.scenes[0]!.layers.find((l) => l.id === 'capa-titulo')!.externalProject?.renderArtifactId, artifact.id);

  // Project v1 no guarda RenderArtifact: se persisten junto al proyecto (FDN-042 decidirá dónde viven).
  writeFileSync(join(ctx.workDir, 'project.linked.fme.json'), serialize(linked));
  writeFileSync(join(ctx.workDir, 'artifacts.json'), JSON.stringify([artifact], null, 2) + '\n');
  const stored = JSON.parse(readFileSync(join(ctx.workDir, 'artifacts.json'), 'utf8')) as RenderArtifact[];
  assert.equal(stored[0]!.dependencyHash, hash);

  // El hash es determinista y sensible al texto.
  const hash2 = dependencyHash({
    projectId: project.id,
    segment: plain({ layer, fps: project.fps, width: project.width, height: project.height, text: 'otro texto' }),
    assets: project.assets.filter((a) => a.id === layer.assetId).map(plain),
    adapters: [plain({ pluginId: prov.pluginId, pluginVersion: prov.pluginVersion, engineVersion: prov.engineVersion, params: prov.params })],
  });
  assert.notEqual(hash2, hash);
});
