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

async function generateClip(targetPath: string): Promise<void> {
  await execFileAsync(
    ffmpeg,
    [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'testsrc2=size=1280x720:rate=30:duration=2',
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
    ],
    { shell: false, windowsHide: true, timeout: 60_000 },
  );
}

test('probe lee versión real de FreeCut (0.0.0+sha)', { skip }, () => {
  assert.match(probe.engineVersion ?? '', /^0\.0\.0\+[0-9a-f]{7,}$/);
});

test(
  'dos ejecuciones reales de escena v2 (video + layer.text ADR-0012) producen mismo contentSha256 y MP4 válido sin ensuciar os.tmpdir()',
  { skip, timeout: 240_000 },
  async (t) => {
    const projectDir = newWorkDir('it-proj');
    const assetsDir = join(projectDir, 'assets');
    mkdirSync(assetsDir, { recursive: true });
    const clipPath = join(assetsDir, 'fondo-2s.mp4');
    await generateClip(clipPath);

    const project: Project = {
      schemaVersion: SCHEMA_VERSION,
      id: 'freecut-it-v2',
      name: 'Integración FreeCut v2',
      fps: { num: 30, den: 1 },
      width: 1280,
      height: 720,
      seed: 2026,
      assets: [{ id: 'bg-clip', type: 'video', uri: 'assets/fondo-2s.mp4' }],
      sequences: [
        {
          id: 'seq-1',
          scenes: [
            {
              id: 'esc-1',
              durationFrames: 60,
              layers: [
                {
                  id: 'capa-video',
                  kind: 'video',
                  assetId: 'bg-clip',
                  startFrame: 0,
                  durationFrames: 60,
                  sourceInFrame: 0,
                  zIndex: 0,
                  techniques: ['2d'],
                  channels: {},
                },
                {
                  id: 'capa-texto',
                  kind: 'text',
                  startFrame: 5,
                  durationFrames: 45,
                  zIndex: 1,
                  techniques: ['2d'],
                  channels: {},
                  text: {
                    content: 'FDN-041 FreeCut',
                    fontFamily: 'Arial',
                    fontSize: 52,
                    color: '#ffffff',
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const projectPath = join(projectDir, 'project.fme.json');
    writeFileSync(projectPath, serialize(project), 'utf8');

    const job = {
      projectId: project.id,
      operation: 'edit.export',
      inputs: [{ uri: projectPath, type: 'fme/project+json' }],
      requirements: { sceneId: 'esc-1' },
      seed: project.seed,
    };

    // Ignora prefijos `fme-*` ajenos de otros worktrees corriendo tests en paralelo; solo vigila artefactos de FreeCut/Playwright.
    const oursRe = /(?:freecut|playwright)/i;
    const tmpBefore = new Set(readdirSync(tmpdir()).filter((n) => oursRe.test(n)));
    const ctx1 = { jobId: newJobId(), workDir: newWorkDir('run1'), timeoutMs: 180_000 };
    const ctx2 = { jobId: newJobId(), workDir: newWorkDir('run2'), timeoutMs: 180_000 };

    const res1 = await adapter.run(job, ctx1);
    assert.deepEqual(res1.diagnostics, [], JSON.stringify(res1.diagnostics));
    assert.equal(res1.status, 'ok');
    assert.deepEqual(checkAdapterResult(res1, adapter), []);

    const res2 = await adapter.run(job, ctx2);
    assert.deepEqual(res2.diagnostics, [], JSON.stringify(res2.diagnostics));
    assert.equal(res2.status, 'ok');
    assert.deepEqual(checkAdapterResult(res2, adapter), []);

    const p1 = res1.provenance[0]!;
    const p2 = res2.provenance[0]!;
    assert.match(p1.sha256, /^[0-9a-f]{64}$/);
    assert.match(p1.contentSha256 ?? '', /^[0-9a-f]{64}$/);
    assert.equal(
      p1.contentSha256,
      p2.contentSha256,
      'Los fotogramas decodificados deben tener idéntico contentSha256 entre dos corridas reales',
    );
    assert.equal(p1.params.frames, 60);
    assert.equal(p1.params.fps, 30);

    const media = await probeMediaModule.probeMedia(fileURLToPath(res1.outputs[0]!.uri), { ffprobe });
    assert.equal(media.fps, 30);
    assert.equal(media.frames, 60);
    assert.deepEqual([media.width, media.height], [1280, 720]);
    assert.equal(media.hasAlpha, false);
    assert.equal(media.audio, true);
    t.diagnostic(
      `contentSha256=${p1.contentSha256} sha256_1=${p1.sha256} sha256_2=${p2.sha256} probe=${JSON.stringify(media)}`,
    );

    assert.ok(existsSync(join(ctx1.workDir, `${ctx1.jobId}.tmp`)));
    assert.ok(existsSync(join(ctx1.workDir, `${ctx1.jobId}.engine`, 'freecut-workspace')));

    const tmpAfter = readdirSync(tmpdir()).filter((name) => oursRe.test(name) && !tmpBefore.has(name));
    assert.deepEqual(tmpAfter, [], `No deben quedar temporales en os.tmpdir(): ${tmpAfter.join(', ')}`);
  },
);
