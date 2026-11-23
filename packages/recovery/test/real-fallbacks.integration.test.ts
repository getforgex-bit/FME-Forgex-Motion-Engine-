import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { describe, test, type TestContext } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  checkAdapterResult,
  createConnectorRegistry,
  type ConnectorAdapter,
} from '@fme/connectors';
import { SCHEMA_VERSION, serialize, type Project } from '@fme/project';
import { createBlenderAdapter } from '../../adapters/blender/src/index.ts';
import {
  FreeCutAdapter,
  advanced as freecutAdvanced,
  newJobId,
  simple as freecutSimple,
} from '../../adapters/freecut/src/index.ts';
import { planRoute } from '../../router/src/index.ts';
import {
  classifyExecutionError,
  executeWithRecovery,
} from '../src/index.ts';

const { probeMedia } = (await import(
  new URL('../../../scripts/probe-media.mjs', import.meta.url).href
)) as {
  probeMedia: (
    file: string,
    opts: { ffprobe: string },
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

const WORK_ROOT = realpathSync.native(
  (() => {
    const dir = fileURLToPath(new URL('../.test-work', import.meta.url));
    mkdirSync(dir, { recursive: true });
    return dir;
  })(),
);

function makeTempRoot(t: TestContext, prefix: string): string {
  const dir = mkdtempSync(join(WORK_ROOT, `${prefix}-`));
  t.after(() => {
    rmSync(dir, { recursive: true, force: true, maxRetries: 2 });
  });
  return dir;
}

function findBinary(name: string, envKey: string): string | undefined {
  const fromEnv = process.env[envKey];
  if (fromEnv) return fromEnv;
  const ext = process.platform === 'win32' ? '.exe' : '';
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (!dir) continue;
    const candidate = join(dir, name + ext);
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // ignore
    }
  }
  return undefined;
}

describe('FDN-052 · Fallbacks reales sobre RoutePlan + ConnectorAdapter', () => {
  test('fallback REAL con motor FreeCut real cuando el primario falla por engine-missing', { timeout: 120_000 }, async (t) => {
    const root = makeTempRoot(t, 'fc-fallback');
    const probeWorkDir = join(root, 'probe');
    mkdirSync(probeWorkDir, { recursive: true });

    const realFreeCut = new FreeCutAdapter({ probeWorkDir });
    const probe = await realFreeCut.probe();
    if (!probe.available) {
      t.skip(`FreeCut no disponible: ${probe.diagnostics[0]?.message ?? 'sin detalles'}`);
      return;
    }

    const ffmpeg = findBinary('ffmpeg', 'FME_FFMPEG_PATH');
    const ffprobe = findBinary('ffprobe', 'FME_FFPROBE_PATH');
    if (!ffmpeg || !ffprobe) {
      t.skip('ffmpeg/ffprobe no disponibles en PATH.');
      return;
    }

    const brokenFreeCut = new FreeCutAdapter({
      freecutDir: join(root, 'freecut-no-existe'),
      probeWorkDir,
    });

    const registry = createConnectorRegistry();
    registry.register(
      { ...freecutSimple, id: 'adapter.freecut-broken', name: 'FreeCut Broken' },
      { ...freecutAdvanced, pluginId: 'adapter.freecut-broken' },
    );
    registry.register(freecutSimple, freecutAdvanced);

    const plan = planRoute(
      registry,
      {
        operation: 'edit.export',
        requiredCapabilities: ['edit.export'],
        requiredProduces: ['video/mp4'],
      },
      {
        mode: 'hybrid',
        preferredConnectorIds: ['adapter.freecut-broken'],
      },
    );

    assert.equal(plan.status, 'planned');
    assert.equal(plan.selected?.connectorId, 'adapter.freecut-broken');
    assert.equal(plan.fallbacks[0]?.connectorId, 'adapter.freecut');

    const projDir = join(root, 'proj');
    const assetsDir = join(projDir, 'assets');
    mkdirSync(assetsDir, { recursive: true });
    const clipPath = join(assetsDir, 'clip-1s.mp4');

    execFileSync(
      ffmpeg,
      [
        '-y',
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'testsrc2=size=1280x720:rate=30:duration=1',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:sample_rate=48000:duration=1',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-ar',
        '48000',
        clipPath,
      ],
      { shell: false, windowsHide: true },
    );

    const project: Project = {
      schemaVersion: SCHEMA_VERSION,
      id: 'proj-fdn-052-fc',
      name: 'Fallback FreeCut Real',
      fps: { num: 30, den: 1 },
      width: 1280,
      height: 720,
      seed: 42,
      assets: [{ id: 'clip1', type: 'video', uri: 'assets/clip-1s.mp4' }],
      sequences: [
        {
          id: 'seq-1',
          scenes: [
            {
              id: 'esc-1',
              durationFrames: 30,
              layers: [
                {
                  id: 'video-1',
                  kind: 'video',
                  assetId: 'clip1',
                  startFrame: 0,
                  durationFrames: 30,
                  zIndex: 0,
                  techniques: ['2d'],
                  channels: {},
                },
              ],
            },
          ],
        },
      ],
    };

    const projPath = join(projDir, 'project.fme.json');
    writeFileSync(projPath, serialize(project), 'utf8');

    const adapters = new Map<string, ConnectorAdapter>([
      ['adapter.freecut-broken', brokenFreeCut],
      ['adapter.freecut', realFreeCut],
    ]);

    const cacheStored: string[] = [];
    const res = await executeWithRecovery(
      plan,
      adapters,
      {
        projectId: project.id,
        operation: 'edit.export',
        inputs: [{ uri: pathToFileURL(projPath).href, type: 'fme/project+json' }],
        requirements: { sceneId: 'esc-1' },
      },
      ({ attemptNumber, connectorId, suffix }) => {
        const workDir = join(root, `run-${attemptNumber}-${connectorId}-${suffix}`);
        mkdirSync(workDir, { recursive: true });
        return { jobId: newJobId(), workDir, timeoutMs: 90_000 };
      },
      {
        purpose: 'final',
        probeFallbackBeforeRun: true,
        sleep: async () => {},
        onCacheStore: (entry) => {
          cacheStored.push(entry.connectorId);
        },
      },
    );

    assert.equal(res.outcome, 'ok');
    assert.equal(res.connectorId, 'adapter.freecut');
    assert.equal(res.degraded, false);
    assert.equal(res.attempts.length, 2);
    assert.equal(res.attempts[0]?.connectorId, 'adapter.freecut-broken');
    assert.equal(res.attempts[0]?.classification?.category, 'engine-unavailable');
    assert.equal(res.attempts[1]?.connectorId, 'adapter.freecut');
    assert.equal(res.attempts[1]?.mitigation?.type, 'fallback-connector');
    assert.deepEqual(checkAdapterResult(res.finalResult, realFreeCut), []);
    assert.deepEqual(cacheStored, ['adapter.freecut']);

    const outUri = res.finalResult.outputs[0]?.uri ?? '';
    const outFile = fileURLToPath(outUri);
    const probed = await probeMedia(outFile, { ffprobe });
    assert.equal(probed.width, 1280);
    assert.equal(probed.height, 720);
    assert.equal(probed.fps, 30);
    assert.equal(probed.frames, 30);
  });

  test('fallback REAL con motor Blender 5.2 real tras criterio #5 (alpha=yes)', { timeout: 120_000 }, async (t) => {
    const root = makeTempRoot(t, 'bl-fallback');
    const realBlender = createBlenderAdapter({ allowedRoots: [WORK_ROOT] });
    const probe = await realBlender.probe();
    if (!probe.available) {
      t.skip(`Blender no disponible: ${probe.diagnostics[0]?.message ?? 'sin detalles'}`);
      return;
    }

    const brokenBlender = createBlenderAdapter({
      allowedRoots: [WORK_ROOT],
      blenderPath: join(root, 'missing-blender.exe'),
    });

    const registry = createConnectorRegistry();
    registry.register(
      { ...realBlender.simple, id: 'adapter.blender-broken', name: 'Blender Broken' },
      { ...realBlender.advanced, pluginId: 'adapter.blender-broken' },
    );
    registry.register(realBlender.simple, realBlender.advanced);

    const plan = planRoute(
      registry,
      {
        operation: 'render.image-sequence',
        requiredCapabilities: ['animate.3d'],
        technical: { alpha: 'yes' },
      },
      {
        mode: 'hybrid',
        preferredConnectorIds: ['adapter.blender-broken'],
      },
    );

    assert.equal(plan.status, 'planned');
    assert.equal(plan.metrics.advancedInspections, 2);
    assert.equal(plan.metrics.advancedSectionsRequested, 2);
    assert.deepEqual(plan.metrics.inspectedByConnector, {
      'adapter.blender-broken': ['technical'],
      'adapter.blender': ['technical'],
    });
    assert.equal(plan.selected?.connectorId, 'adapter.blender-broken');
    assert.equal(plan.fallbacks[0]?.connectorId, 'adapter.blender');

    const projDir = join(root, 'proj-bl');
    mkdirSync(projDir, { recursive: true });
    const project: Project = {
      schemaVersion: SCHEMA_VERSION,
      id: 'proj-fdn-052-bl',
      name: 'Fallback Blender Real',
      fps: { num: 30, den: 1 },
      width: 256,
      height: 144,
      seed: 9,
      assets: [],
      sequences: [
        {
          id: 'seq-1',
          scenes: [
            {
              id: 'esc-3d',
              durationFrames: 4,
              layers: [
                {
                  id: 'capa-3d',
                  kind: 'model3d',
                  startFrame: 0,
                  durationFrames: 4,
                  zIndex: 0,
                  techniques: ['3d'],
                  channels: {},
                },
              ],
            },
          ],
        },
      ],
    };

    const projPath = join(projDir, 'project.fme.json');
    writeFileSync(projPath, serialize(project), 'utf8');

    const adapters = new Map<string, ConnectorAdapter>([
      ['adapter.blender-broken', brokenBlender],
      ['adapter.blender', realBlender],
    ]);

    const res = await executeWithRecovery(
      plan,
      adapters,
      {
        projectId: project.id,
        operation: 'render.image-sequence',
        inputs: [{ uri: pathToFileURL(projPath).href, type: 'fme/project+json' }],
        requirements: { layerId: 'capa-3d', resolution: '256x144' },
      },
      ({ attemptNumber, connectorId, suffix }) => {
        const workDir = join(root, `bl-${attemptNumber}-${connectorId}-${suffix}`);
        mkdirSync(workDir, { recursive: true });
        return { jobId: `bl-${attemptNumber}`, workDir, timeoutMs: 90_000 };
      },
      {
        purpose: 'final',
        probeFallbackBeforeRun: true,
        sleep: async () => {},
      },
    );

    assert.equal(res.outcome, 'ok');
    assert.equal(res.connectorId, 'adapter.blender');
    assert.equal(res.attempts.length, 2);
    assert.equal(res.attempts[0]?.classification?.category, 'engine-unavailable');
    assert.equal(res.attempts[1]?.mitigation?.type, 'fallback-connector');
    assert.deepEqual(checkAdapterResult(res.finalResult, realBlender), []);
  });

  test('sin alternativa compatible escala al usuario sin simular y clasifica ATOMIC_REPLACE_UNAVAILABLE / unsupported-alpha', async (t) => {
    const root = makeTempRoot(t, 'escalate');
    const probeWorkDir = join(root, 'probe');
    mkdirSync(probeWorkDir, { recursive: true });

    // Verifica clasificación exacta de los códigos reales de adaptadores
    const atomicClass = classifyExecutionError({
      jobId: 'j1',
      status: 'failed',
      outputs: [],
      provenance: [],
      diagnostics: [
        {
          code: 'ATOMIC_REPLACE_UNAVAILABLE',
          message: "EPERM: rename '.atomic-test.tmp' -> '.atomic-test'",
        },
      ],
    });
    assert.equal(atomicClass.category, 'transient');
    assert.equal(atomicClass.retryable, true);
    assert.equal(atomicClass.fallbackEligible, true);

    const unsupAlphaClass = classifyExecutionError({
      jobId: 'j2',
      status: 'failed',
      outputs: [],
      provenance: [],
      diagnostics: [
        {
          code: 'unsupported-alpha',
          message: 'FreeCut no admite image/png-sequence',
        },
      ],
    });
    assert.equal(unsupAlphaClass.category, 'unsupported-capability');
    assert.equal(unsupAlphaClass.retryable, false);
    assert.equal(unsupAlphaClass.fallbackEligible, true);

    const brokenFreeCut = new FreeCutAdapter({
      freecutDir: join(root, 'freecut-no-existe'),
      probeWorkDir,
    });

    const registry = createConnectorRegistry();
    registry.register(
      { ...freecutSimple, id: 'adapter.freecut-broken', name: 'FreeCut Broken' },
      { ...freecutAdvanced, pluginId: 'adapter.freecut-broken' },
    );

    const plan = planRoute(registry, {
      operation: 'edit.compose',
      requiredCapabilities: ['edit.compose'],
      requiredProduces: ['video/mp4'],
    });
    assert.equal(plan.status, 'planned');
    assert.equal(plan.fallbacks.length, 0);

    const projDir = join(root, 'proj-esc');
    mkdirSync(join(projDir, 'assets'), { recursive: true });
    writeFileSync(join(projDir, 'assets', 'bg.mp4'), 'placeholder');
    const project: Project = {
      schemaVersion: SCHEMA_VERSION,
      id: 'proj-esc',
      name: 'Escalate',
      fps: { num: 30, den: 1 },
      width: 1280,
      height: 720,
      seed: 1,
      assets: [{ id: 'v1', type: 'video', uri: 'assets/bg.mp4' }],
      sequences: [
        {
          id: 's1',
          scenes: [
            {
              id: 'sc1',
              durationFrames: 30,
              layers: [
                {
                  id: 'l1',
                  kind: 'video',
                  assetId: 'v1',
                  startFrame: 0,
                  durationFrames: 30,
                  zIndex: 0,
                  techniques: ['2d'],
                  channels: {},
                },
              ],
            },
          ],
        },
      ],
    };
    const projPath = join(projDir, 'project.fme.json');
    writeFileSync(projPath, serialize(project), 'utf8');

    const res = await executeWithRecovery(
      plan,
      { 'adapter.freecut-broken': brokenFreeCut },
      {
        projectId: project.id,
        operation: 'edit.compose',
        inputs: [{ uri: pathToFileURL(projPath).href, type: 'fme/project+json' }],
        requirements: { sceneId: 'sc1' },
      },
      ({ attemptNumber, connectorId, suffix }) => {
        const workDir = join(root, `esc-${attemptNumber}-${connectorId}-${suffix}`);
        mkdirSync(workDir, { recursive: true });
        return { jobId: newJobId(), workDir, timeoutMs: 30_000 };
      },
      { purpose: 'final', sleep: async () => {} },
    );

    assert.equal(res.outcome, 'escalated');
    assert.equal(res.finalResult?.status, 'failed');
    assert.ok(res.constraintsReported.length > 0);
    assert.ok(res.suggestedActions.length > 0);
  });
});
