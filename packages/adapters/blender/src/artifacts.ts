import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requirePath } from './paths.ts';
import type { AdapterJobResult, ArtifactProvenance } from '@fme/connectors';
import type { RenderRequest } from './request.ts';

export const pngType = 'image/png';
export const cameraType = 'application/json';
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const digestPattern = /^[a-f0-9]{64}$/;
const engineVersionPattern = /^\d+\.\d+\.\d+$/;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function verifyPng(bytes: Buffer, width: number, height: number): void {
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(pngSignature) || bytes.readUInt32BE(8) !== 13 ||
      bytes.toString('ascii', 12, 16) !== 'IHDR' || bytes.readUInt32BE(16) !== width ||
      bytes.readUInt32BE(20) !== height || bytes[24] !== 8 || bytes[25] !== 6) {
    throw new Error('Se esperaba un PNG RGBA de 8 bits con las dimensiones solicitadas.');
  }
}

type CameraFrame = { frame: number; x: number; y: number; depth: number; lens: number };

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function readCamera(value: unknown, request: RenderRequest) {
  if (!isRecord(value) || value.version !== 1 || value.width !== request.width ||
      value.height !== request.height || !Array.isArray(value.frames) ||
      value.frames.length !== request.durationFrames) {
    throw new Error('El manifiesto de cámara de Blender no corresponde a la solicitud.');
  }
  const frames = value.frames.map((entry: unknown, index: number): CameraFrame => {
    if (!isRecord(entry) || entry.frame !== index || !finiteNumber(entry.x) ||
        !finiteNumber(entry.y) || !finiteNumber(entry.depth) || !finiteNumber(entry.lens) || entry.lens <= 0) {
      throw new Error('Datos de cámara inválidos en el fotograma ' + index + '.');
    }
    return { frame: index, x: entry.x, y: entry.y, depth: entry.depth, lens: entry.lens };
  });
  return { version: 1, width: request.width, height: request.height, frames };
}

type ProvenanceBase = Omit<ArtifactProvenance, 'uri' | 'type' | 'sha256' | 'contentSha256' | 'engineVersion'>;

export function collectArtifacts(
  directory: string,
  request: RenderRequest,
  base: ProvenanceBase,
  cameraGuide = false,
): Pick<AdapterJobResult, 'outputs' | 'provenance'> {
  const render: unknown = JSON.parse(readFileSync(requirePath(join(directory, 'render.json'), [directory], 'file'), 'utf8'));
  if (!isRecord(render) || typeof render.engineVersion !== 'string' || !engineVersionPattern.test(render.engineVersion) ||
      !Array.isArray(render.frames) || render.frames.length !== request.durationFrames) {
    throw new Error('El manifiesto de Blender no corresponde a la solicitud.');
  }

  const camera = cameraGuide ? readCamera(render.camera, request) : undefined;
  const framesDir = requirePath(join(directory, 'frames'), [directory], 'directory');
  const inDirectory = new Set(readdirSync(framesDir));
  if (inDirectory.size !== request.durationFrames) throw new Error('Cantidad de archivos PNG inesperada.');

  const engineVersion = render.engineVersion;
  const provenance = render.frames.map((frame: unknown, index: number): ArtifactProvenance => {
    const name = 'frame-' + String(index + 1).padStart(4, '0') + '.png';
    if (!isRecord(frame) || frame.name !== name || !inDirectory.has(name) ||
        typeof frame.contentSha256 !== 'string' || !digestPattern.test(frame.contentSha256)) {
      throw new Error('Fotograma de Blender inválido: ' + name);
    }
    const path = requirePath(join(framesDir, name), [framesDir], 'file');
    const bytes = readFileSync(path);
    verifyPng(bytes, request.width, request.height);
    return {
      ...base,
      uri: pathToFileURL(path).href,
      type: pngType,
      engineVersion,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      contentSha256: frame.contentSha256,
    };
  });
  if (camera !== undefined) {
    const cameraPath = join(requirePath(directory, [directory], 'directory'), 'camera.json');
    const cameraBytes = Buffer.from(JSON.stringify(camera) + '\n', 'utf8');
    writeFileSync(cameraPath, cameraBytes, { flag: 'wx', mode: 0o600 });
    provenance.push({
      ...base,
      uri: pathToFileURL(cameraPath).href,
      type: cameraType,
      engineVersion,
      sha256: createHash('sha256').update(cameraBytes).digest('hex'),
    });
  }
  const outputs = provenance.map(({ uri, type }) => ({ uri, type }));
  return { outputs, provenance };
}
