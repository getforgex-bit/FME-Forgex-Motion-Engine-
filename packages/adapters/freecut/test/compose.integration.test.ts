import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { checkAdapterResult } from '@fme/connectors';
import { SCHEMA_VERSION, serialize, type Project } from '@fme/project';
import { FreeCutAdapter, newJobId } from '../src/index.ts';
import { newWorkDir, probeWorkDir } from './workroot.ts';

const execFileAsync = promisify(execFile);
const adapter = new FreeCutAdapter({ probeWorkDir });
const probe = await adapter.probe();
const skip = !probe.available
  ? `FreeCut no disponible: ${probe.diagnostics.map((d) => d.message).join(' | ')}`
  : false;

const probeMediaModule = (await import(
  new URL('../../../../scripts/probe-media.mjs', import.meta.url).href
)) as {
  probeMedia: (
    f: string,
    o: { ffprobe: string },
  ) => Promise<{
    fps: number | null;
    frames: number | null;
    durationS: number | null;
    width: number | null;
    height: number | null;
    pixFmt: string | null;
    hasAlpha: boolean;
    audio: boolean;
  }>;
};
const ffmpeg = process.env.FME_FFMPEG_PATH ?? 'ffmpeg';
const ffprobe = process.env.FME_FFPROBE_PATH ?? 'ffprobe';

async function runFfmpeg(args: string[]): Promise<Buffer> {
  const { stdout } = await execFileAsync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', ...args], {
    shell: false,
    windowsHide: true,
    encoding: 'buffer',
    timeout: 60_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout;
}

async function generateBlueBgMp4(targetPath: string): Promise<void> {
  await runFfmpeg([
    '-f',
    'lavfi',
    '-i',
    'color=c=#0000ff:size=1280x720:rate=30:duration=2',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:sample_rate=48000:duration=2',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-r',
    '30',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-shortest',
    '-map_metadata',
    '-1',
    targetPath,
  ]);
}

async function generateRedAlphaPng(targetPath: string): Promise<void> {
  await runFfmpeg([
    '-f',
    'lavfi',
    '-i',
    "nullsrc=s=1280x720:d=1,format=rgba,geq=r='if(lt(X,640),255,0)':g=0:b=0:a='if(lt(X,640),255,0)'",
    '-frames:v',
    '1',
    targetPath,
  ]);
}

async function generateRedAlphaProResMov(targetPath: string): Promise<void> {
  await runFfmpeg([
    '-f',
    'lavfi',
    '-i',
    "nullsrc=s=1280x720:r=30:d=1,format=rgba,geq=r='if(lt(X,640),255,0)':g=0:b=0:a='if(lt(X,640),255,0)'",
    '-c:v',
    'prores_ks',
    '-profile:v',
    '4444',
    '-pix_fmt',
    'yuva444p12le',
    targetPath,
  ]);
}

async function sampleRgbAtFrame(
  mp4Path: string,
  frameIndex: number,
): Promise<{ left: [number, number, number]; right: [number, number, number] }> {
  const sec = (frameIndex / 30).toFixed(6);
  const buf = await runFfmpeg([
    '-ss',
    sec,
    '-i',
    mp4Path,
    '-frames:v',
    '1',
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgb24',
    '-',
  ]);
  const pixelAt = (x: number, y: number): [number, number, number] => {
    const offset = (y * 1280 + x) * 3;
    return [buf[offset]!, buf[offset + 1]!, buf[offset + 2]!];
  };
  return {
    left: pixelAt(320, 360),
    right: pixelAt(960, 360),
  };
}

function assertBlue(rgb: [number, number, number], label: string): void {
  const [r, g, b] = rgb;
  assert.ok(r < 40 && g < 40 && b > 200, `${label}: esperado azul de fondo, recibido RGB(${rgb.join(',')})`);
}

function assertRed(rgb: [number, number, number], label: string): void {
  const [r, g, b] = rgb;
  assert.ok(r > 200 && g < 50 && b < 50, `${label}: esperado rojo de overlay, recibido RGB(${rgb.join(',')})`);
}

test(
  'edit.compose real con PNG RGBA y MOV ProRes 4444 (yuva444p12le): preserva transparencia, rango temporal [20..40) y contentSha256',
  { skip, timeout: 240_000 },
  async (t) => {
    const oursRe = /(?:freecut|playwright)/i;
    const tmpBefore = new Set(readdirSync(tmpdir()).filter((n) => oursRe.test(n)));

    const projDir = newWorkDir('cmp-real');
    const assetsDir = join(projDir, 'assets');
    const extDir = newWorkDir('cmp-ext');
    mkdirSync(assetsDir, { recursive: true });

    const bgPath = join(assetsDir, 'bg-azul.mp4');
    const pngOverlayPath = join(assetsDir, 'overlay-red.png');
    const movOverlayPath = join(extDir, 'revideo-title.mov');

    await generateBlueBgMp4(bgPath);
    await generateRedAlphaPng(pngOverlayPath);
    await generateRedAlphaProResMov(movOverlayPath);

    // 1a) Composición con overlay PNG RGBA en frames [20..40), zIndex: 1
    const pngProject: Project = {
      schemaVersion: SCHEMA_VERSION,
      id: 'compose-png-real',
      name: 'Compose PNG RGBA',
      fps: { num: 30, den: 1 },
      width: 1280,
      height: 720,
      seed: 10,
      assets: [
        { id: 'bg', type: 'video', uri: 'assets/bg-azul.mp4' },
        { id: 'ov', type: 'image', uri: 'assets/overlay-red.png' },
      ],
      sequences: [
        {
          id: 'seq-1',
          scenes: [
            {
              id: 'esc-png',
              durationFrames: 60,
              layers: [
                {
                  id: 'fondo',
                  kind: 'video',
                  assetId: 'bg',
                  startFrame: 0,
                  durationFrames: 60,
                  zIndex: 0,
                  techniques: ['2d'],
                  channels: {},
                },
                {
                  id: 'overlay-png',
                  kind: 'image',
                  assetId: 'ov',
                  startFrame: 20,
                  durationFrames: 20,
                  zIndex: 1,
                  techniques: ['2d'],
                  channels: {},
                },
              ],
            },
          ],
        },
      ],
    };
    const pngProjPath = join(projDir, 'project.png.fme.json');
    writeFileSync(pngProjPath, serialize(pngProject), 'utf8');

    const pngCtx = { jobId: newJobId(), workDir: newWorkDir('cmp-png-wd'), timeoutMs: 180_000 };
    const pngRes = await adapter.run(
      {
        projectId: pngProject.id,
        operation: 'edit.compose',
        inputs: [{ uri: pngProjPath, type: 'fme/project+json' }],
        requirements: { sceneId: 'esc-png' },
      },
      pngCtx,
    );
    assert.ok(
      pngRes.diagnostics.every((d) => d.code === 'ATOMIC_REPLACE_UNAVAILABLE'),
      JSON.stringify(pngRes.diagnostics),
    );
    assert.equal(pngRes.status, 'ok');
    assert.deepEqual(checkAdapterResult(pngRes, adapter), []);
    assert.match(pngRes.provenance[0]?.contentSha256 ?? '', /^[0-9a-f]{64}$/);

    const pngOutPath = fileURLToPath(pngRes.outputs[0]!.uri);
    const pngMedia = await probeMediaModule.probeMedia(pngOutPath, { ffprobe });
    assert.equal(pngMedia.fps, 30);
    assert.equal(pngMedia.frames, 60);
    assert.deepEqual([pngMedia.width, pngMedia.height], [1280, 720]);

    const pF5 = await sampleRgbAtFrame(pngOutPath, 5);
    const pF30 = await sampleRgbAtFrame(pngOutPath, 30);
    const pF50 = await sampleRgbAtFrame(pngOutPath, 50);
    assertBlue(pF5.left, 'PNG frame5 left');
    assertBlue(pF5.right, 'PNG frame5 right');
    assertRed(pF30.left, 'PNG frame30 left');
    assertBlue(pF30.right, 'PNG frame30 right (alpha transparente)');
    assertBlue(pF50.left, 'PNG frame50 left');
    assertBlue(pF50.right, 'PNG frame50 right');

    // 1b) Composición con artefacto externo MOV ProRes 4444 (yuva444p12le) de capa `drawing`
    const movProject: Project = {
      schemaVersion: SCHEMA_VERSION,
      id: 'compose-prores-real',
      name: 'Compose MOV ProRes 4444',
      fps: { num: 30, den: 1 },
      width: 1280,
      height: 720,
      seed: 11,
      assets: [
        { id: 'bg', type: 'video', uri: 'assets/bg-azul.mp4' },
        { id: 'vec', type: 'drawing', uri: 'assets/revideo-title.svg' },
      ],
      sequences: [
        {
          id: 'seq-1',
          scenes: [
            {
              id: 'esc-mov',
              durationFrames: 60,
              layers: [
                {
                  id: 'fondo',
                  kind: 'video',
                  assetId: 'bg',
                  startFrame: 0,
                  durationFrames: 60,
                  zIndex: 0,
                  techniques: ['2d'],
                  channels: {},
                },
                {
                  id: 'capa-revideo',
                  kind: 'drawing',
                  assetId: 'vec',
                  startFrame: 20,
                  durationFrames: 20,
                  zIndex: 1,
                  techniques: ['2d'],
                  channels: {},
                },
              ],
            },
          ],
        },
      ],
    };
    const movProjPath = join(projDir, 'project.mov.fme.json');
    writeFileSync(movProjPath, serialize(movProject), 'utf8');

    const movCtx = { jobId: newJobId(), workDir: newWorkDir('cmp-mov-wd'), timeoutMs: 180_000 };
    const movRes = await adapter.run(
      {
        projectId: movProject.id,
        operation: 'edit.compose',
        inputs: [
          { uri: movProjPath, type: 'fme/project+json' },
          { uri: movOverlayPath, type: 'video/quicktime' },
        ],
        requirements: {
          sceneId: 'esc-mov',
          'input.capa-revideo': movOverlayPath,
        },
      },
      movCtx,
    );
    assert.ok(
      movRes.diagnostics.every((d) => d.code === 'ATOMIC_REPLACE_UNAVAILABLE'),
      JSON.stringify(movRes.diagnostics),
    );
    assert.equal(movRes.status, 'ok');
    assert.deepEqual(checkAdapterResult(movRes, adapter), []);
    assert.match(movRes.provenance[0]?.contentSha256 ?? '', /^[0-9a-f]{64}$/);

    const movOutPath = fileURLToPath(movRes.outputs[0]!.uri);
    const movMedia = await probeMediaModule.probeMedia(movOutPath, { ffprobe });
    assert.equal(movMedia.fps, 30);
    assert.equal(movMedia.frames, 60);
    assert.deepEqual([movMedia.width, movMedia.height], [1280, 720]);

    const mF5 = await sampleRgbAtFrame(movOutPath, 5);
    const mF30 = await sampleRgbAtFrame(movOutPath, 30);
    const mF50 = await sampleRgbAtFrame(movOutPath, 50);
    assertBlue(mF5.left, 'ProRes frame5 left');
    assertBlue(mF5.right, 'ProRes frame5 right');
    assertRed(mF30.left, 'ProRes frame30 left');
    assertBlue(mF30.right, 'ProRes frame30 right (alpha transparente)');
    assertBlue(mF50.left, 'ProRes frame50 left');
    assertBlue(mF50.right, 'ProRes frame50 right');

    assert.ok(existsSync(join(movCtx.workDir, `${movCtx.jobId}.tmp`)));
    assert.ok(existsSync(join(movCtx.workDir, `${movCtx.jobId}.engine`, 'freecut-workspace')));

    const tmpAfter = readdirSync(tmpdir()).filter((name) => oursRe.test(name) && !tmpBefore.has(name));
    assert.deepEqual(tmpAfter, [], `No deben quedar temporales en os.tmpdir(): ${tmpAfter.join(', ')}`);

    t.diagnostic(
      `png_f5=${JSON.stringify(pF5)} png_f30=${JSON.stringify(pF30)} png_f50=${JSON.stringify(pF50)} mov_f30=${JSON.stringify(mF30)} contentSha256_png=${pngRes.provenance[0]?.contentSha256} contentSha256_mov=${movRes.provenance[0]?.contentSha256}`,
    );
  },
);

test(
  'edit.compose con secuencia PNG RGBA real (Blender) falla honestamente con unsupported-alpha sin simular',
  { skip, timeout: 60_000 },
  async () => {
    const projDir = newWorkDir('cmp-seq-proj');
    const assetsDir = join(projDir, 'assets');
    const seqDir = join(projDir, 'blender-png-seq');
    mkdirSync(assetsDir, { recursive: true });
    mkdirSync(seqDir, { recursive: true });

    const bgPath = join(assetsDir, 'bg-azul.mp4');
    await generateBlueBgMp4(bgPath);
    await runFfmpeg([
      '-f',
      'lavfi',
      '-i',
      "nullsrc=s=1280x720:r=30:d=0.1,format=rgba,geq=r='if(lt(X,640),255,0)':g=0:b=0:a='if(lt(X,640),255,0)'",
      join(seqDir, 'frame_%04d.png'),
    ]);

    const project: Project = {
      schemaVersion: SCHEMA_VERSION,
      id: 'compose-seq-unsup',
      name: 'Compose PNG Sequence Unsupported',
      fps: { num: 30, den: 1 },
      width: 1280,
      height: 720,
      seed: 12,
      assets: [
        { id: 'bg', type: 'video', uri: 'assets/bg-azul.mp4' },
        { id: 'm3d', type: 'model3d', uri: 'assets/scene.glb' },
      ],
      sequences: [
        {
          id: 'seq-1',
          scenes: [
            {
              id: 'esc-seq',
              durationFrames: 60,
              layers: [
                {
                  id: 'fondo',
                  kind: 'video',
                  assetId: 'bg',
                  startFrame: 0,
                  durationFrames: 60,
                  zIndex: 0,
                  techniques: ['2d'],
                  channels: {},
                },
                {
                  id: 'capa-3d',
                  kind: 'model3d',
                  assetId: 'm3d',
                  startFrame: 15,
                  durationFrames: 30,
                  zIndex: 1,
                  techniques: ['3d'],
                  channels: {},
                },
              ],
            },
          ],
        },
      ],
    };
    const projPath = join(projDir, 'project.seq.fme.json');
    writeFileSync(projPath, serialize(project), 'utf8');

    const res = await adapter.run(
      {
        projectId: project.id,
        operation: 'edit.compose',
        inputs: [
          { uri: projPath, type: 'fme/project+json' },
          { uri: seqDir, type: 'image/png-sequence' },
        ],
        requirements: {
          sceneId: 'esc-seq',
          'input.capa-3d': seqDir,
        },
      },
      { jobId: newJobId(), workDir: newWorkDir('cmp-seq-wd'), timeoutMs: 60_000 },
    );

    assert.equal(res.status, 'failed');
    assert.deepEqual(res.outputs, []);
    assert.deepEqual(res.provenance, []);
    assert.equal(res.diagnostics[0]?.code, 'unsupported-alpha');
    assert.match(res.diagnostics[0]?.message ?? '', /ProRes 4444|WebM VP9|FFmpeg/i);
    assert.deepEqual(checkAdapterResult(res, adapter), []);
  },
);
