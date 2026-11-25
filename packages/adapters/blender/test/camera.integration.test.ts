import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';
import { checkAdapterResult } from '@fme/connectors';
import { SCHEMA_VERSION, serialize } from '@fme/project';
import { cameraType, collectArtifacts, pngType } from '../src/artifacts.ts';
import { createBlenderAdapter } from '../src/index.ts';
import { prepareJob } from '../src/request.ts';
import type { JobRequest } from '@fme/connectors';
import type { Layer, Project } from '@fme/project';
import type { RenderRequest } from '../src/request.ts';
import type { TestContext } from 'node:test';

type CameraFrame = { frame: number; x: number; y: number; depth: number; lens: number };
type CameraManifest = { version: number; width: number; height: number; frames: CameraFrame[] };

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i]!;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const kind = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([kind, data])), 0);
  return Buffer.concat([length, kind, data, crc]);
}

function makeSolidPng(width: number, height: number): { bytes: Buffer; contentSha256: string } {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      pixels[p] = 200;
      pixels[p + 1] = 100;
      pixels[p + 2] = 50;
      pixels[p + 3] = 255;
      const r = y * (width * 4 + 1) + 1 + x * 4;
      raw[r] = 200;
      raw[r + 1] = 100;
      raw[r + 2] = 50;
      raw[r + 3] = 255;
    }
  }
  const bytes = Buffer.concat([
    pngSignature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  return { bytes, contentSha256: sha256(pixels) };
}

function paeth(left: number, up: number, upperLeft: number): number {
  const estimate = left + up - upperLeft;
  const dl = Math.abs(estimate - left);
  const du = Math.abs(estimate - up);
  const dd = Math.abs(estimate - upperLeft);
  if (dl <= du && dl <= dd) return left;
  return du <= dd ? up : upperLeft;
}

function decodePngRgba(bytes: Buffer, width: number, height: number): Buffer {
  assert.ok(bytes.subarray(0, 8).equals(pngSignature), 'firma PNG inválida');
  const idat: Buffer[] = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const kind = bytes.toString('ascii', offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;
    if (kind === 'IHDR') {
      assert.equal(bytes.readUInt32BE(start), width);
      assert.equal(bytes.readUInt32BE(start + 4), height);
      assert.equal(bytes[start + 8], 8);
      assert.equal(bytes[start + 9], 6);
    } else if (kind === 'IDAT') {
      idat.push(bytes.subarray(start, end));
    } else if (kind === 'IEND') {
      break;
    }
    offset = end + 4;
  }
  const inflated = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  assert.equal(inflated.length, (stride + 1) * height, 'tamaño decodificado RGBA inesperado');
  const rgba = Buffer.alloc(stride * height);
  let previous = Buffer.alloc(stride);
  for (let row = 0; row < height; row++) {
    const src = row * (stride + 1);
    const filter = inflated[src]!;
    const current = Buffer.from(inflated.subarray(src + 1, src + 1 + stride));
    if (filter !== 0) {
      for (let i = 0; i < stride; i++) {
        const left = i >= 4 ? current[i - 4]! : 0;
        const up = previous[i]!;
        const upperLeft = i >= 4 ? previous[i - 4]! : 0;
        let predictor = 0;
        if (filter === 1) predictor = left;
        else if (filter === 2) predictor = up;
        else if (filter === 3) predictor = (left + up) >> 1;
        else if (filter === 4) predictor = paeth(left, up, upperLeft);
        else assert.fail('Filtro PNG desconocido: ' + filter);
        current[i] = (current[i]! + predictor) & 0xff;
      }
    }
    current.copy(rgba, row * stride);
    previous = current;
  }
  return rgba;
}

function alphaCentroid(rgba: Buffer, width: number): { cx: number; cy: number; count: number } {
  let sx = 0;
  let sy = 0;
  let count = 0;
  for (let p = 0; p < rgba.length; p += 4) {
    if (rgba[p + 3]! > 128) {
      const idx = p / 4;
      sx += idx % width;
      sy += Math.floor(idx / width);
      count++;
    }
  }
  return { cx: count > 0 ? sx / count : NaN, cy: count > 0 ? sy / count : NaN, count };
}

function makeCameraProject(width: number, height: number, durationFrames: number, channels: Layer['channels']): Project {
  const layer: Layer = {
    id: 'cube',
    kind: 'model3d',
    startFrame: 0,
    durationFrames,
    zIndex: 0,
    techniques: ['3d'],
    channels,
  };
  return {
    schemaVersion: SCHEMA_VERSION,
    id: 'blender-camera-guide',
    name: 'Guía de cámara Blender',
    width,
    height,
    fps: { num: 30, den: 1 },
    seed: 2026,
    assets: [],
    sequences: [{ id: 'seq', scenes: [{ id: 'scene', durationFrames, layers: [layer] }] }],
  };
}

function tempDir(context: TestContext, prefix: string): string {
  const dir = mkdtempSync(join(realpathSync.native(tmpdir()), prefix));
  context.after(() => rmSync(dir, { recursive: true, force: true, maxRetries: 2 }));
  return dir;
}

test('prepareJob valida cameraGuide booleano y mantiene opt-in por defecto', (context) => {
  const root = tempDir(context, 'fme-blender-cam-req-');
  const project = makeCameraProject(1280, 720, 3, {});
  const projectPath = join(root, 'project.fme.json');
  writeFileSync(projectPath, serialize(project), 'utf8');
  const baseJob: JobRequest = {
    projectId: project.id,
    operation: 'render.image-sequence',
    inputs: [{ type: 'fme/project+json', uri: pathToFileURL(projectPath).href }],
    requirements: { layerId: 'cube' },
  };

  assert.equal(prepareJob(baseJob, [root]).cameraGuide, false);
  assert.equal(prepareJob({ ...baseJob, requirements: { layerId: 'cube', cameraGuide: false } }, [root]).cameraGuide, false);
  assert.equal(prepareJob({ ...baseJob, requirements: { layerId: 'cube', cameraGuide: true } }, [root]).cameraGuide, true);

  for (const invalid of ['true', 'false', 1, 0]) {
    assert.throws(
      () => prepareJob({ ...baseJob, requirements: { layerId: 'cube', cameraGuide: invalid } }, [root]),
      /cameraGuide debe ser booleano/,
    );
  }
  const adapter = createBlenderAdapter({ allowedRoots: [root] });
  assert.ok(adapter.simple.produces.includes(pngType));
  assert.ok(adapter.simple.produces.includes(cameraType));
});

test('collectArtifacts valida render.json.camera y emite camera.json solo con cameraGuide=true', (context) => {
  const root = tempDir(context, 'fme-blender-cam-artifacts-');
  const width = 4;
  const height = 4;
  const durationFrames = 2;
  const png = makeSolidPng(width, height);
  const request: RenderRequest = {
    width,
    height,
    durationFrames,
    fps: { num: 30, den: 1 },
    channels: {},
    seed: 7,
  };
  const base = {
    pluginId: 'adapter.blender',
    pluginVersion: '0.0.0',
    startedAt: '2026-11-25T00:00:00.000Z',
    durationMs: 12,
    seed: 7,
    params: { layerId: 'cube', startFrame: 0, durationFrames, width, height, fpsNum: 30, fpsDen: 1, fallbackPrimitive: true },
  };

  function makeJobDir(name: string, camera: unknown): string {
    const dir = join(root, name);
    const framesDir = join(dir, 'frames');
    mkdirSync(framesDir, { recursive: true });
    const frames = [];
    for (let i = 0; i < durationFrames; i++) {
      const fileName = 'frame-' + String(i + 1).padStart(4, '0') + '.png';
      writeFileSync(join(framesDir, fileName), png.bytes);
      frames.push({ name: fileName, contentSha256: png.contentSha256 });
    }
    const manifest: Record<string, unknown> = { engineVersion: '5.2.0', frames };
    if (camera !== undefined) manifest.camera = camera;
    writeFileSync(join(dir, 'render.json'), JSON.stringify(manifest), 'utf8');
    return dir;
  }

  const validCamera: CameraManifest = {
    version: 1,
    width,
    height,
    frames: [
      { frame: 0, x: 0.25, y: 0.4, depth: 5.5, lens: 48 },
      { frame: 1, x: 0.75, y: 0.6, depth: 5.8, lens: 52 },
    ],
  };

  // Sin cameraGuide: solo PNGs y no escribe camera.json.
  const withoutGuideDir = makeJobDir('without-guide', validCamera);
  const withoutGuide = collectArtifacts(withoutGuideDir, request, base, false);
  assert.equal(withoutGuide.outputs.length, durationFrames);
  assert.ok(withoutGuide.outputs.every(({ type }) => type === pngType));
  assert.equal(existsSync(join(withoutGuideDir, 'camera.json')), false);

  // Con cameraGuide=true: PNGs + camera.json válido.
  const withGuideDir = makeJobDir('with-guide', validCamera);
  const withGuide = collectArtifacts(withGuideDir, request, base, true);
  assert.equal(withGuide.outputs.length, durationFrames + 1);
  assert.equal(withGuide.outputs.at(-1)?.type, cameraType);
  const cameraPath = fileURLToPath(withGuide.outputs.at(-1)!.uri);
  assert.equal(basename(cameraPath), 'camera.json');
  const cameraBytes = readFileSync(cameraPath);
  assert.equal(withGuide.provenance.at(-1)?.sha256, sha256(cameraBytes));
  assert.equal(withGuide.provenance.at(-1)?.engineVersion, '5.2.0');
  assert.deepEqual(JSON.parse(cameraBytes.toString('utf8')), validCamera);

  // Casos malformados rechazados cuando cameraGuide=true.
  const malformedCases: Array<[string, unknown]> = [
    ['missing', undefined],
    ['bad-version', { ...validCamera, version: 2 }],
    ['bad-width', { ...validCamera, width: width + 1 }],
    ['bad-height', { ...validCamera, height: height + 1 }],
    ['bad-length', { ...validCamera, frames: [validCamera.frames[0]] }],
    ['bad-frame-index', { ...validCamera, frames: [{ ...validCamera.frames[0]!, frame: 1 }, validCamera.frames[1]] }],
    ['non-numeric-x', { ...validCamera, frames: [{ ...validCamera.frames[0]!, x: '0.5' }, validCamera.frames[1]] }],
    ['null-y', { ...validCamera, frames: [{ ...validCamera.frames[0]!, y: null }, validCamera.frames[1]] }],
    ['zero-lens', { ...validCamera, frames: [{ ...validCamera.frames[0]!, lens: 0 }, validCamera.frames[1]] }],
    ['negative-lens', { ...validCamera, frames: [{ ...validCamera.frames[0]!, lens: -12 }, validCamera.frames[1]] }],
  ];
  for (const [label, invalidCamera] of malformedCases) {
    const dir = makeJobDir('bad-' + label, invalidCamera);
    assert.throws(
      () => collectArtifacts(dir, request, base, true),
      /manifiesto de cámara|Datos de cámara inválidos/,
      'debe rechazar caso malformado: ' + label,
    );
    assert.equal(existsSync(join(dir, 'camera.json')), false);
  }
});

test('Blender real a 1280×720 exporta camera.json v1 determinista con error < 6 px respecto al centroide alfa', { timeout: 300_000 }, async (context) => {
  const root = tempDir(context, 'fme-blender-cam-real-');
  const adapter = createBlenderAdapter({ allowedRoots: [root] });
  const probe = await adapter.probe();
  if (!probe.available) {
    context.skip('Blender no disponible: ' + probe.diagnostics.map(({ message }) => message).join(', '));
    return;
  }

  const width = 1280;
  const height = 720;
  const durationFrames = 3;
  const project = makeCameraProject(width, height, durationFrames, {
    x: { defaultValue: 0, keyframes: [{ frame: 0, value: -1.5 }, { frame: durationFrames - 1, value: 1.5, easing: 'linear' }] },
    y: { defaultValue: 0, keyframes: [{ frame: 0, value: -0.7 }, { frame: durationFrames - 1, value: 0.7, easing: 'linear' }] },
    rotation: { defaultValue: 0, keyframes: [{ frame: 0, value: -25 }, { frame: durationFrames - 1, value: 25, easing: 'linear' }] },
    scale: { defaultValue: 1, keyframes: [{ frame: 0, value: 0.5 }, { frame: durationFrames - 1, value: 0.7, easing: 'linear' }] },
  });
  const projectPath = join(root, 'camera-1280x720.fme.json');
  writeFileSync(projectPath, serialize(project), 'utf8');

  async function execute(jobId: string, requirements: JobRequest['requirements']) {
    const workDir = join(root, jobId);
    mkdirSync(workDir);
    const run = await adapter.run({
      projectId: project.id,
      operation: 'render.image-sequence',
      inputs: [{ type: 'fme/project+json', uri: pathToFileURL(projectPath).href }],
      requirements,
      seed: project.seed,
    }, { jobId, workDir, timeoutMs: 180_000 });
    assert.equal(run.status, 'ok', JSON.stringify(run.diagnostics));
    assert.deepEqual(checkAdapterResult(run, adapter), []);
    return run;
  }

  // 1) Ejecución con cameraGuide: true a 1280×720.
  const first = await execute('cam-hd-1', { layerId: 'cube', cameraGuide: true });
  assert.equal(first.outputs.length, durationFrames + 1);
  assert.equal(first.provenance.length, durationFrames + 1);
  const pngOutputs = first.outputs.slice(0, durationFrames);
  const cameraOutput = first.outputs[durationFrames]!;
  const cameraProv = first.provenance[durationFrames]!;
  assert.ok(pngOutputs.every(({ type }) => type === pngType));
  assert.equal(cameraOutput.type, cameraType);
  const cameraPath = fileURLToPath(cameraOutput.uri);
  assert.equal(basename(cameraPath), 'camera.json');
  const cameraBytes = readFileSync(cameraPath);
  assert.equal(cameraProv.sha256, sha256(cameraBytes));
  assert.equal(cameraProv.engineVersion, probe.engineVersion);
  assert.equal(cameraProv.seed, project.seed);
  assert.equal(cameraProv.params.width, width);
  assert.equal(cameraProv.params.height, height);
  assert.equal(cameraProv.params.durationFrames, durationFrames);

  const camera = JSON.parse(cameraBytes.toString('utf8')) as CameraManifest;
  assert.equal(camera.version, 1);
  assert.equal(camera.width, width);
  assert.equal(camera.height, height);
  assert.equal(camera.frames.length, durationFrames);

  const centroids: Array<{ cx: number; cy: number; count: number }> = [];
  const errors: number[] = [];
  for (let i = 0; i < durationFrames; i++) {
    const sample = camera.frames[i]!;
    assert.equal(sample.frame, i);
    assert.ok(Number.isFinite(sample.x) && Number.isFinite(sample.y));
    assert.ok(Number.isFinite(sample.depth) && sample.depth > 0);
    assert.ok(Number.isFinite(sample.lens) && sample.lens > 0);
    const expectedScale = 0.5 + (0.7 - 0.5) * (i / (durationFrames - 1));
    assert.ok(Math.abs(sample.lens - 48 * expectedScale) < 1e-3, `lens frame ${i}: ${sample.lens}`);

    const pngBytes = readFileSync(fileURLToPath(pngOutputs[i]!.uri));
    const rgba = decodePngRgba(pngBytes, width, height);
    assert.equal(first.provenance[i]!.contentSha256, sha256(rgba));
    const centroid = alphaCentroid(rgba, width);
    assert.ok(centroid.count > 1000, `objeto 3D poco visible en frame ${i} (${centroid.count} px)`);
    centroids.push(centroid);

    const projectedX = sample.x * width;
    const projectedY = sample.y * height;
    const errorPx = Math.hypot(projectedX - centroid.cx, projectedY - centroid.cy);
    errors.push(errorPx);
    context.diagnostic(
      `frame ${i}: camera=(${projectedX.toFixed(2)}, ${projectedY.toFixed(2)}) ` +
      `centroid=(${centroid.cx.toFixed(2)}, ${centroid.cy.toFixed(2)}) ` +
      `error=${errorPx.toFixed(2)}px depth=${sample.depth.toFixed(3)} lens=${sample.lens.toFixed(2)}`,
    );
  }

  const travelX = Math.abs(centroids.at(-1)!.cx - centroids[0]!.cx);
  const travelY = Math.abs(centroids.at(-1)!.cy - centroids[0]!.cy);
  assert.ok(travelX > 150, `el objeto debe desplazarse en X para validar la proyección (${travelX.toFixed(1)} px)`);
  assert.ok(travelY > 50, `el objeto debe desplazarse en Y para validar el eje Y invertido (${travelY.toFixed(1)} px)`);
  for (const [i, errorPx] of errors.entries()) {
    assert.ok(errorPx < 6, `error de proyección excesivo en frame ${i}: ${errorPx.toFixed(2)} px >= 6 px`);
  }

  // 2) Determinismo entre ejecuciones independientes (a resolución de preview para mantener la suite ágil).
  const detA = await execute('cam-det-1', { layerId: 'cube', resolution: '256x144', cameraGuide: true });
  const detB = await execute('cam-det-2', { layerId: 'cube', resolution: '256x144', cameraGuide: true });
  const detBytesA = readFileSync(fileURLToPath(detA.outputs[durationFrames]!.uri));
  const detBytesB = readFileSync(fileURLToPath(detB.outputs[durationFrames]!.uri));
  assert.equal(detB.provenance[durationFrames]!.sha256, detA.provenance[durationFrames]!.sha256);
  assert.deepEqual(detBytesB, detBytesA);
  assert.deepEqual(
    detB.provenance.slice(0, durationFrames).map(({ contentSha256 }) => contentSha256),
    detA.provenance.slice(0, durationFrames).map(({ contentSha256 }) => contentSha256),
  );
  const detCamera = JSON.parse(detBytesA.toString('utf8')) as CameraManifest;
  assert.equal(detCamera.width, 256);
  assert.equal(detCamera.height, 144);
  for (let i = 0; i < durationFrames; i++) {
    assert.ok(Math.abs(detCamera.frames[i]!.x - camera.frames[i]!.x) < 1e-6);
    assert.ok(Math.abs(detCamera.frames[i]!.y - camera.frames[i]!.y) < 1e-6);
  }

  // 3) Compatibilidad opt-in: sin cameraGuide ni con cameraGuide: false NO se emite camera.json.
  for (const [jobId, req] of [
    ['cam-optout-default', { layerId: 'cube', resolution: '128x72' }],
    ['cam-optout-false', { layerId: 'cube', resolution: '128x72', cameraGuide: false }],
  ] as const) {
    const compat = await execute(jobId, req);
    assert.equal(compat.outputs.length, durationFrames);
    assert.ok(compat.outputs.every(({ type }) => type === pngType));
    const jobOutputDir = dirname(dirname(fileURLToPath(compat.outputs[0]!.uri)));
    assert.equal(existsSync(join(jobOutputDir, 'camera.json')), false);
  }
});
