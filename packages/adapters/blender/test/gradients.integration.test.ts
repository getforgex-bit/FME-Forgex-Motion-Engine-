import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { checkAdapterResult } from '@fme/connectors';
import { deserialize, serialize } from '@fme/project';
import { createBlenderAdapter } from '../src/index.ts';
import type { JobRequest } from '@fme/connectors';
import type { Curve, Layer, Project } from '@fme/project';

const fixturePath = new URL('../../../../examples/prueba-hibrida-10s/project.fme.json', import.meta.url);
const width = 96;
const height = 96;
const gradientCurve: Curve = {
  defaultValue: 0,
  keyframes: [0, 1 / 3, 2 / 3, 1].map((value, frame) => ({ frame, value, easing: 'linear' })),
};

function gradientProject(channels: Layer['channels'], durationFrames = 4): Project {
  const original = deserialize(readFileSync(fixturePath, 'utf8'));
  if (!original.ok) throw new Error(JSON.stringify(original.errors));
  return {
    ...original.value,
    id: 'blender-gradients',
    width,
    height,
    fps: { num: 30, den: 1 },
    seed: 11,
    assets: [],
    sequences: [{
      id: 'seq',
      scenes: [{
        id: 'gradient-scene',
        durationFrames,
        layers: [{ id: 'cube', kind: 'model3d', startFrame: 0, durationFrames, zIndex: 0, techniques: ['3d'], channels }],
      }],
    }],
  };
}

function decodeRgba(uri: string): Buffer {
  const bytes = execFileSync('ffmpeg', [
    '-v', 'error', '-i', fileURLToPath(uri), '-frames:v', '1',
    '-c:v', 'rawvideo', '-threads:v', '1', '-pix_fmt', 'rgba', '-f', 'rawvideo', '-',
  ], { windowsHide: true });
  assert.equal(bytes.length, width * height * 4);
  assert.equal(bytes[3], 0, 'la esquina del lienzo conserva su transparencia');
  return bytes;
}

function luma(bytes: Buffer, offset: number): number {
  return 0.2126 * bytes[offset]! + 0.7152 * bytes[offset + 1]! + 0.0722 * bytes[offset + 2]!;
}

function outlineChange(reference: Buffer, frame: Buffer): number {
  let delta = 0;
  for (let index = 0; index < reference.length; index += 4) {
    const oldAlpha = reference[index + 3]!;
    const newAlpha = frame[index + 3]!;
    delta += Math.max(0, newAlpha - oldAlpha);
    delta += Math.max(0, luma(reference, index) * oldAlpha - luma(frame, index) * newAlpha) / 255;
  }
  return delta;
}

function meanCentralLuma(frame: Buffer): number {
  // ROI fija de 16 × 16 centrada en el cubo, con cámara y encuadre idénticos.
  const radius = 8;
  let total = 0;
  for (let y = height / 2 - radius; y < height / 2 + radius; y++) {
    for (let x = width / 2 - radius; x < width / 2 + radius; x++) {
      const index = (y * width + x) * 4;
      assert.ok(frame[index + 3]! > 250, 'la región central conserva la cobertura');
      total += luma(frame, index);
    }
  }
  return total / (2 * radius) ** 2;
}

function assertStrictTrend(values: readonly number[], direction: number, label: string): void {
  assert.ok(values.every((value, index) =>
    index === 0 || direction * (value - values[index - 1]!) > 0,
  ), label + ': ' + values.join(', '));
}

test('Blender real aplica ambos gradientes con métricas de píxeles monótonas', { timeout: 180_000 }, async (context) => {
  const root = mkdtempSync(join(realpathSync.native(tmpdir()), 'fme-blender-gradients-'));
  context.after(() => rmSync(root, { recursive: true, force: true, maxRetries: 2 }));
  const adapter = createBlenderAdapter({ allowedRoots: [root] });
  const probe = await adapter.probe();
  if (!probe.available) {
    context.skip('Blender no disponible: ' + probe.diagnostics.map(({ message }) => message).join(', '));
    return;
  }

  async function render(name: string, channels: Layer['channels'], durationFrames = 4) {
    const project = gradientProject(channels, durationFrames);
    const jobDir = join(root, name);
    mkdirSync(jobDir);
    const path = join(jobDir, 'project.fme.json');
    writeFileSync(path, serialize(project), 'utf8');
    const request: JobRequest = {
      projectId: project.id,
      operation: 'render.image-sequence',
      inputs: [{ type: 'fme/project+json', uri: pathToFileURL(path).href }],
      requirements: { layerId: 'cube' },
    };
    const result = await adapter.run(request, { jobId: name, workDir: jobDir, timeoutMs: 30_000 });
    assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics));
    assert.deepEqual(checkAdapterResult(result, adapter), []);
    assert.equal(result.outputs.length, durationFrames);
    const hashes = result.provenance.map(({ contentSha256 }) => contentSha256);
    assert.ok(hashes.every((hash) => hash !== undefined && /^[0-9a-f]{64}$/.test(hash)));
    const pixels = result.outputs.map(({ uri }) => decodeRgba(uri));
    return { hashes, pixels };
  }

  const control = await render('control', {}, 1);
  const expression = await render('expression', { expression: gradientCurve });
  const integration = await render('integration', { integration: gradientCurve });
  assert.equal(expression.hashes[0], control.hashes[0], 'expression=0 conserva la imagen base');
  assert.equal(integration.hashes.at(-1), control.hashes[0], 'integration=1 conserva el material físico base');

  const outline = expression.pixels.map((frame) => outlineChange(expression.pixels[0]!, frame));
  const luminance = integration.pixels.map(meanCentralLuma);
  assertStrictTrend(outline, 1, 'efecto del contorno');
  assertStrictTrend(luminance, 1, 'luminancia central del material');
  assert.ok(Math.abs(luminance.at(-1)! - luminance[0]!) >= 4, 'el cambio de luminancia es visible');

  const repeatedExpression = await render('expression-repeat', { expression: gradientCurve });
  const repeatedIntegration = await render('integration-repeat', { integration: gradientCurve });
  assert.deepEqual(expression.hashes, repeatedExpression.hashes);
  assert.deepEqual(integration.hashes, repeatedIntegration.hashes);
  context.diagnostic('Contorno: ' + outline.map((value) => value.toFixed(2)).join(', '));
  context.diagnostic('Luminancia: ' + luminance.map((value) => value.toFixed(2)).join(', '));
});
