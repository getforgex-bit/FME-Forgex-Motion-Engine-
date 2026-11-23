import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const DEFAULT_FREECUT_DIR =
  process.env.FME_FREECUT_DIR ?? 'C:\\Users\\bogex\\Documents\\Forgex\\FME-ext\\freecut';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function fail(code, message) {
  process.stderr.write(`${JSON.stringify({ code, message })}\n`);
  process.exit(1);
}

function resolveBrowserLaunch(browserMode) {
  const mode = String(browserMode || 'auto').toLowerCase();
  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
  ];
  const playwrightRoot = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');

  const findPlaywrightChromium = () => {
    if (!fs.existsSync(playwrightRoot)) return null;
    const entries = fs
      .readdirSync(playwrightRoot)
      .filter((d) => d.startsWith('chromium-'))
      .sort()
      .reverse();
    for (const entry of entries) {
      const candidate = path.join(playwrightRoot, entry, 'chrome-win64', 'chrome.exe');
      if (fs.existsSync(candidate)) return candidate;
    }
    return null;
  };

  if (mode === 'chrome') return { label: 'chrome', launch: { channel: 'chrome' } };
  if (mode === 'msedge') return { label: 'msedge', launch: { channel: 'msedge' } };
  if (mode === 'playwright') {
    const exe = findPlaywrightChromium();
    if (!exe) fail('browser-missing', 'No local Playwright Chromium found in %LOCALAPPDATA%\\ms-playwright.');
    return { label: 'playwright-chromium', launch: { executablePath: exe } };
  }

  if (chromePaths.some((p) => p && fs.existsSync(p))) {
    return { label: 'chrome', launch: { channel: 'chrome' } };
  }
  if (edgePaths.some((p) => fs.existsSync(p))) {
    return { label: 'msedge', launch: { channel: 'msedge' } };
  }
  const pwExe = findPlaywrightChromium();
  if (pwExe) {
    return { label: 'playwright-chromium', launch: { executablePath: pwExe } };
  }
  fail('browser-missing', 'No compatible Chromium browser found (checked Chrome, Edge, and ms-playwright).');
}

function readEngineVersion(freecutDir) {
  const pkgPath = path.join(freecutDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    fail('engine-missing', `No existe package.json de FreeCut en ${freecutDir}.`);
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const base = typeof pkg.version === 'string' && pkg.version ? pkg.version : '0.0.0';
  try {
    const sha = execFileSync('git', ['-C', freecutDir, 'rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
    }).trim();
    return sha ? `${base}+${sha}` : base;
  } catch {
    return base;
  }
}

function assertFreecutReady(freecutDir) {
  const harnessPath = path.join(freecutDir, 'dist', 'headless.html');
  const libDir = path.join(freecutDir, 'headless', 'lib');
  if (!fs.existsSync(harnessPath) || !fs.existsSync(libDir)) {
    fail(
      'engine-missing',
      `FreeCut no está compilado o falta headless/lib en ${freecutDir} (esperado dist/headless.html).`,
    );
  }
}

async function runJob(args) {
  const freecutDir = path.resolve(String(args['freecut-dir'] || DEFAULT_FREECUT_DIR));
  assertFreecutReady(freecutDir);

  if (!args.job || !args.out || !args['work-dir']) {
    fail('bad-args', 'Uso: --job <job.json> --out <out.mp4> --work-dir <dir> [--freecut-dir <dir>] [--browser <mode>]');
  }

  const jobFile = path.resolve(String(args.job));
  const outFile = path.resolve(String(args.out));
  const workDir = path.resolve(String(args['work-dir']));
  const browserMode = String(args.browser || process.env.FME_FREECUT_BROWSER || 'auto');

  if (!fs.existsSync(jobFile)) fail('bad-input', `No existe el archivo de job: ${jobFile}`);
  const spec = JSON.parse(fs.readFileSync(jobFile, 'utf8'));

  const workspaceDir = path.join(workDir, 'freecut-workspace');
  fs.mkdirSync(workspaceDir, { recursive: true });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  const requireFromFreecut = createRequire(path.join(freecutDir, 'package.json'));
  const { chromium } = requireFromFreecut('playwright');

  const modUrl = (rel) => pathToFileURL(path.join(freecutDir, rel)).href;
  const { chromeLaunchArgs } = await import(modUrl('headless/lib/cli.mjs'));
  const { prepareJob, renderJob, startHarness } = await import(modUrl('headless/lib/render-core.mjs'));
  const { PageSession } = await import(modUrl('headless/lib/page-session.mjs'));
  const { collectAddClipMedia } = await import(modUrl('headless/lib/workspace.mjs'));
  const {
    acquireWriterLock,
    assertAtomicReplace,
    commitStagedMedia,
    createProjectResource,
    getProjectResource,
    projectForEngine,
    saveProjectResource,
    stageLocalMedia,
  } = await import(modUrl('headless/lib/lifecycle-store.mjs'));

  const browserChoice = resolveBrowserLaunch(browserMode);
  const harness = await startHarness({ workspace: workspaceDir });
  const browser = await chromium.launch({
    ...browserChoice.launch,
    headless: true,
    args: chromeLaunchArgs(),
  });
  const session = new PageSession({ browser, harnessUrl: harness.harnessUrl });
  let releaseLock = null;

  try {
    await session.open();
    releaseLock = await acquireWriterLock(workspaceDir);
    await assertAtomicReplace(workspaceDir);

    const projectId = String(spec.sceneId || 'fme-scene').replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 64) || 'fme-scene';
    const createdProject = await session.page.evaluate(
      (cfg) => window.freecut.createProject(cfg),
      {
        id: projectId,
        name: String(spec.projectName || projectId),
        description: 'FME FDN-041 Level-A render job',
        width: spec.width,
        height: spec.height,
        fps: spec.fps,
        backgroundColor: '#000000',
      },
    );
    const createdResource = await createProjectResource(workspaceDir, createdProject);

    // Importa cada archivo de media único una sola vez dentro del workspace aislado.
    const mediaIdByPath = new Map();
    let mediaIndex = 0;
    for (const layer of spec.layers) {
      if (layer.kind !== 'video' && layer.kind !== 'audio' && layer.kind !== 'image') continue;
      if (mediaIdByPath.has(layer.mediaPath)) continue;
      mediaIndex += 1;
      const mediaId = `asset-${mediaIndex}`;
      const staged = await stageLocalMedia(workspaceDir, layer.mediaPath, mediaId);
      const probe = await session.page.evaluate(
        (payload) => window.freecut.probeMedia(payload),
        {
          url: harness.mediaUrlOf(staged.id),
          fileName: path.basename(staged.target),
          mimeType: staged.mimeType,
        },
      );
      await commitStagedMedia(staged, probe, { workspace: workspaceDir, projectId });
      mediaIdByPath.set(layer.mediaPath, mediaId);
    }

    // Construye pistas visuales en orden ascendente de zIndex (order 0 = fondo, -1/-2... = arriba).
    const ops = [];
    const visualZIndices = [
      ...new Set(
        spec.layers
          .filter((l) => l.kind === 'video' || l.kind === 'image' || l.kind === 'text')
          .map((l) => l.zIndex),
      ),
    ].sort((a, b) => a - b);

    const trackRefByZ = new Map();
    visualZIndices.forEach((z, idx) => {
      if (idx === 0) {
        trackRefByZ.set(z, 'track-1');
      } else {
        const callerId = `trackZ_${idx}`;
        ops.push({ callerId, op: 'addTrack', kind: 'video' });
        trackRefByZ.set(z, { $ref: `${callerId}#/detail/trackId` });
      }
    });

    spec.layers.forEach((layer, idx) => {
      if (layer.kind === 'text') {
        ops.push({
          op: 'addText',
          trackId: trackRefByZ.get(layer.zIndex),
          text: layer.text,
          from: layer.startFrame,
          durationInFrames: layer.durationFrames,
          ...(layer.fontSize !== undefined ? { fontSize: layer.fontSize } : {}),
          ...(layer.fontFamily !== undefined ? { fontFamily: layer.fontFamily } : {}),
          ...(layer.color !== undefined ? { color: layer.color } : {}),
        });
        return;
      }

      const mediaId = mediaIdByPath.get(layer.mediaPath);
      const callerId = `clip_${idx}`;
      const clipOp = {
        callerId,
        op: 'addClip',
        mediaId,
        from: layer.startFrame,
        durationInFrames: layer.durationFrames,
        ...(layer.kind === 'audio' ? { trackId: 'track-2' } : { trackId: trackRefByZ.get(layer.zIndex) }),
      };
      ops.push(clipOp);

      if (layer.sourceInFrame > 0 && (layer.kind === 'video' || layer.kind === 'audio')) {
        ops.push({
          op: 'updateItem',
          id: { $ref: `${callerId}#/detail/created/0/id` },
          updates: {
            sourceStart: layer.sourceInFrame,
            sourceEnd: layer.sourceInFrame + layer.durationFrames,
          },
        });
      }
    });

    const currentProject = await getProjectResource(workspaceDir, projectId);
    const edited = await session.page.evaluate(
      (payload) => window.freecut.editProject(payload),
      {
        project: projectForEngine(currentProject.project),
        ops,
        media: collectAddClipMedia(workspaceDir, ops),
      },
    );
    const normalized = await session.page.evaluate(
      (value) => window.freecut.normalizeProject(value),
      edited.project,
    );
    await saveProjectResource(workspaceDir, projectId, normalized, {
      expectedRevision: createdResource.revision,
    });

    const jobArgs = {
      project: projectId,
      out: outFile,
      codec: 'h264',
      container: 'mp4',
      quality: 'high',
      fps: spec.fps,
      resolution: `${spec.width}x${spec.height}`,
      in: '0',
      'out-sec': String(spec.durationFrames / spec.fps),
    };
    const prepared = prepareJob(workspaceDir, jobArgs, harness.mediaUrlOf);
    const renderSummary = await renderJob(session.page, prepared, {
      allowMissingMedia: false,
      downloadTimeoutMs: 0,
    });

    console.log(
      JSON.stringify({
        ok: true,
        browser: browserChoice.label,
        engineVersion: readEngineVersion(freecutDir),
        outputPath: renderSummary.outputPath,
        fileSize: renderSummary.fileSize,
        durationSeconds: renderSummary.durationSeconds,
        warnings: renderSummary.warnings ?? [],
      }),
    );
  } finally {
    await releaseLock?.().catch(() => {});
    await session.close().catch(() => {});
    await browser.close().catch(() => {});
    await harness.closeServers().catch(() => {});
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.version) {
    const freecutDir = path.resolve(String(args['freecut-dir'] || DEFAULT_FREECUT_DIR));
    assertFreecutReady(freecutDir);
    console.log(readEngineVersion(freecutDir));
    return;
  }
  await runJob(args);
}

main().catch((err) => {
  fail(err?.code || 'render-failed', err?.message || String(err));
});
