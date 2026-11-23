import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkAdapterResult } from '@fme/connectors';
import { SCHEMA_VERSION, serialize, type Project } from '@fme/project';
import { FreeCutAdapter, newJobId } from '../src/index.ts';
import { newWorkDir } from './workroot.ts';

function createFakeEnvironment(): {
  engineDir: string;
  freecutDir: string;
  projPath: string;
  logPath: string;
} {
  const root = newWorkDir('retry-env');
  const engineDir = join(root, 'engine');
  const freecutDir = join(root, 'freecut');
  const projDir = join(root, 'project');
  const assetsDir = join(projDir, 'assets');
  mkdirSync(engineDir, { recursive: true });
  mkdirSync(join(freecutDir, 'dist'), { recursive: true });
  mkdirSync(join(freecutDir, 'headless', 'lib'), { recursive: true });
  mkdirSync(join(freecutDir, 'node_modules', 'playwright'), { recursive: true });
  mkdirSync(assetsDir, { recursive: true });

  writeFileSync(join(freecutDir, 'dist', 'headless.html'), '<html></html>', 'utf8');

  const ffmpeg = process.env.FME_FFMPEG_PATH ?? 'ffmpeg';
  const clipPath = join(assetsDir, 'clip.mp4');
  execFileSync(
    ffmpeg,
    [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'color=c=#112233:size=64x64:rate=30:duration=0.2',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-r',
      '30',
      clipPath,
    ],
    { shell: false, windowsHide: true },
  );

  const project: Project = {
    schemaVersion: SCHEMA_VERSION,
    id: 'retry-test-project',
    name: 'Retry Test',
    fps: { num: 30, den: 1 },
    width: 64,
    height: 64,
    seed: 1,
    assets: [{ id: 'bg', type: 'video', uri: 'assets/clip.mp4' }],
    sequences: [
      {
        id: 'seq-1',
        scenes: [
          {
            id: 'esc-1',
            durationFrames: 6,
            layers: [
              {
                id: 'fondo',
                kind: 'video',
                assetId: 'bg',
                startFrame: 0,
                durationFrames: 6,
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

  const logPath = join(root, 'attempts.json');
  const cliScript = `
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
if (argv.includes('--version')) {
  console.log('0.1.0+fake');
  process.exit(0);
}

const getArg = (name) => {
  const idx = argv.indexOf('--' + name);
  return idx >= 0 ? argv[idx + 1] : undefined;
};

const outPath = getArg('out');
const workDir = getArg('work-dir');
const logFile = ${JSON.stringify(logPath)};
const sampleMp4 = ${JSON.stringify(clipPath)};
const scenarioFile = ${JSON.stringify(join(root, 'scenario.json'))};

const scenario = JSON.parse(fs.readFileSync(scenarioFile, 'utf8'));
const log = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : [];
const attempt = log.length + 1;
log.push({
  attempt,
  workDir,
  temp: process.env.TEMP || null,
});
fs.writeFileSync(logFile, JSON.stringify(log, null, 2), 'utf8');

const failDef = scenario.failures[attempt - 1];
if (failDef) {
  if (failDef.rawStderr) {
    process.stderr.write(failDef.rawStderr + '\\n');
  } else {
    process.stderr.write(JSON.stringify({ code: failDef.code, message: failDef.message }) + '\\n');
  }
  process.exit(failDef.exitCode ?? 1);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.copyFileSync(sampleMp4, outPath);
console.log(JSON.stringify({ ok: true, outputPath: outPath }));
`;
  writeFileSync(join(engineDir, 'cli.mjs'), cliScript, 'utf8');

  return { engineDir, freecutDir, projPath, logPath };
}

test('reintenta hasta 3 veces ante ATOMIC_REPLACE_UNAVAILABLE y triunfa en el 3.er intento conservando historial', async () => {
  const env = createFakeEnvironment();
  const root = join(env.engineDir, '..');
  writeFileSync(
    join(root, 'scenario.json'),
    JSON.stringify({
      failures: [
        {
          code: 'ATOMIC_REPLACE_UNAVAILABLE',
          message:
            "EPERM: operation not permitted, rename 'C:\\tmp\\.freecut-headless\\.atomic-test.100.a.tmp' -> 'C:\\tmp\\.freecut-headless\\.atomic-test'",
        },
        {
          code: 'ATOMIC_REPLACE_UNAVAILABLE',
          message:
            "EPERM: operation not permitted, rename 'C:\\tmp\\.freecut-headless\\.atomic-test.101.b.tmp' -> 'C:\\tmp\\.freecut-headless\\.atomic-test'",
        },
      ],
    }),
    'utf8',
  );

  const sleeps: number[] = [];
  const adapter = new FreeCutAdapter({
    engineDir: env.engineDir,
    freecutDir: env.freecutDir,
    probeWorkDir: newWorkDir('retry-probe'),
    maxTransientRetries: 3,
    retryBackoffMs: 25,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });

  const jobId = newJobId();
  const res = await adapter.run(
    {
      projectId: 'retry-test-project',
      operation: 'edit.export',
      inputs: [{ uri: env.projPath, type: 'fme/project+json' }],
      requirements: { sceneId: 'esc-1' },
    },
    { jobId, workDir: newWorkDir('retry-ok-wd'), timeoutMs: 60_000 },
  );

  assert.equal(res.status, 'ok');
  assert.deepEqual(checkAdapterResult(res, adapter), []);
  assert.deepEqual(sleeps, [25, 50]);
  assert.equal(res.diagnostics.length, 2);
  assert.ok(res.diagnostics.every((d) => d.code === 'ATOMIC_REPLACE_UNAVAILABLE'));

  const attempts = JSON.parse(readFileSync(env.logPath, 'utf8')) as Array<{
    attempt: number;
    workDir: string;
    temp: string | null;
  }>;
  assert.equal(attempts.length, 3);
  const workDirs = new Set(attempts.map((a) => a.workDir));
  const temps = new Set(attempts.map((a) => a.temp));
  assert.equal(workDirs.size, 3, 'Cada intento debe usar un --work-dir único');
  assert.equal(temps.size, 3, 'Cada intento debe usar un TEMP/TMP/TMPDIR único');
  assert.match(attempts[0]!.workDir, new RegExp(`${jobId}\\.engine$`));
  assert.match(attempts[1]!.workDir, new RegExp(`${jobId}\\.engine-retry-1$`));
  assert.match(attempts[2]!.workDir, new RegExp(`${jobId}\\.engine-retry-2$`));
});

test('falla tras agotar 3 reintentos y conserva los 4 intentos en diagnostics', async () => {
  const env = createFakeEnvironment();
  const root = join(env.engineDir, '..');
  writeFileSync(
    join(root, 'scenario.json'),
    JSON.stringify({
      failures: [1, 2, 3, 4].map((n) => ({
        code: 'ATOMIC_REPLACE_UNAVAILABLE',
        message: `EPERM intento ${n} en .freecut-headless\\.atomic-test`,
      })),
    }),
    'utf8',
  );

  const sleeps: number[] = [];
  const adapter = new FreeCutAdapter({
    engineDir: env.engineDir,
    freecutDir: env.freecutDir,
    probeWorkDir: newWorkDir('retry-probe-fail'),
    maxTransientRetries: 3,
    retryBackoffMs: 25,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });

  const res = await adapter.run(
    {
      projectId: 'retry-test-project',
      operation: 'edit.export',
      inputs: [{ uri: env.projPath, type: 'fme/project+json' }],
      requirements: { sceneId: 'esc-1' },
    },
    { jobId: newJobId(), workDir: newWorkDir('retry-exhaust-wd'), timeoutMs: 60_000 },
  );

  assert.equal(res.status, 'failed');
  assert.deepEqual(checkAdapterResult(res, adapter), []);
  assert.deepEqual(sleeps, [25, 50, 100]);
  assert.equal(res.diagnostics.length, 4);
  assert.ok(res.diagnostics.every((d) => d.code === 'ATOMIC_REPLACE_UNAVAILABLE'));

  const attempts = JSON.parse(readFileSync(env.logPath, 'utf8')) as Array<unknown>;
  assert.equal(attempts.length, 4);
});

test('error no transitorio (render-failed) falla en 1 solo intento sin reintentar', async () => {
  const env = createFakeEnvironment();
  const root = join(env.engineDir, '..');
  writeFileSync(
    join(root, 'scenario.json'),
    JSON.stringify({
      failures: [{ code: 'render-failed', message: 'WebGPU device lost' }],
    }),
    'utf8',
  );

  const sleeps: number[] = [];
  const adapter = new FreeCutAdapter({
    engineDir: env.engineDir,
    freecutDir: env.freecutDir,
    probeWorkDir: newWorkDir('retry-probe-nontrans'),
    maxTransientRetries: 3,
    retryBackoffMs: 25,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });

  const res = await adapter.run(
    {
      projectId: 'retry-test-project',
      operation: 'edit.export',
      inputs: [{ uri: env.projPath, type: 'fme/project+json' }],
      requirements: { sceneId: 'esc-1' },
    },
    { jobId: newJobId(), workDir: newWorkDir('retry-nontrans-wd'), timeoutMs: 60_000 },
  );

  assert.equal(res.status, 'failed');
  assert.deepEqual(checkAdapterResult(res, adapter), []);
  assert.deepEqual(sleeps, []);
  assert.equal(res.diagnostics.length, 1);
  assert.equal(res.diagnostics[0]?.code, 'render-failed');

  const attempts = JSON.parse(readFileSync(env.logPath, 'utf8')) as Array<unknown>;
  assert.equal(attempts.length, 1);
});

test('respeta el presupuesto de timeoutMs cuando el backoff excede el margen restante', async () => {
  const env = createFakeEnvironment();
  const root = join(env.engineDir, '..');
  writeFileSync(
    join(root, 'scenario.json'),
    JSON.stringify({
      failures: [
        {
          rawStderr:
            "Error: EBUSY: resource busy or locked, rename 'C:\\w\\.freecut-headless\\.atomic-test.1.tmp'",
        },
      ],
    }),
    'utf8',
  );

  const sleeps: number[] = [];
  const adapter = new FreeCutAdapter({
    engineDir: env.engineDir,
    freecutDir: env.freecutDir,
    probeWorkDir: newWorkDir('retry-probe-budget'),
    maxTransientRetries: 3,
    retryBackoffMs: 500_000,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });

  const res = await adapter.run(
    {
      projectId: 'retry-test-project',
      operation: 'edit.export',
      inputs: [{ uri: env.projPath, type: 'fme/project+json' }],
      requirements: { sceneId: 'esc-1' },
    },
    { jobId: newJobId(), workDir: newWorkDir('retry-budget-wd'), timeoutMs: 5_000 },
  );

  assert.equal(res.status, 'failed');
  assert.deepEqual(checkAdapterResult(res, adapter), []);
  assert.deepEqual(sleeps, []);
  assert.equal(res.diagnostics.length, 1);
  assert.match(res.diagnostics[0]?.message ?? '', /timeoutMs/);

  const attempts = JSON.parse(readFileSync(env.logPath, 'utf8')) as Array<unknown>;
  assert.equal(attempts.length, 1);
});
