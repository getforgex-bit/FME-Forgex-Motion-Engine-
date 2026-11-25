import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      args[key] = true
    } else {
      args[key] = next
      i += 1
    }
  }
  return args
}

function resolveBrowserLaunch(browserMode) {
  const mode = (browserMode || 'auto').toLowerCase()
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
  ]
  const playwrightRoot = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright')

  const findPlaywrightChromium = () => {
    if (!fs.existsSync(playwrightRoot)) return null
    const entries = fs.readdirSync(playwrightRoot).filter((d) => d.startsWith('chromium-')).sort().reverse()
    for (const entry of entries) {
      const candidate = path.join(playwrightRoot, entry, 'chrome-win64', 'chrome.exe')
      if (fs.existsSync(candidate)) return candidate
    }
    return null
  }

  if (mode === 'chrome') return { label: 'chrome', launch: { channel: 'chrome' } }
  if (mode === 'msedge') return { label: 'msedge', launch: { channel: 'msedge' } }
  if (mode === 'playwright') {
    const exe = findPlaywrightChromium()
    if (!exe) throw new Error('No local Playwright Chromium found in %LOCALAPPDATA%\\ms-playwright')
    return { label: 'playwright-chromium', launch: { executablePath: exe } }
  }

  if (chromePaths.some((p) => p && fs.existsSync(p))) {
    return { label: 'chrome', launch: { channel: 'chrome' } }
  }
  if (fs.existsSync(edgePath)) {
    return { label: 'msedge', launch: { channel: 'msedge' } }
  }
  const pwExe = findPlaywrightChromium()
  if (pwExe) {
    return { label: 'playwright-chromium', launch: { executablePath: pwExe } }
  }
  throw new Error('No compatible Chromium browser found (checked Chrome, Edge, and ms-playwright cache)')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const freecutDir = path.resolve(args['freecut-dir'] || 'C:\\Users\\bogex\\Documents\\Forgex\\FME-ext\\freecut')
  const workspace = path.resolve(args.workspace)
  const inputFile = path.resolve(args.input)
  const outFile = path.resolve(args.out)
  const projectOut = args['project-out'] ? path.resolve(args['project-out']) : null
  const browserPref = typeof args.browser === 'string' ? args.browser : 'auto'

  if (!fs.existsSync(freecutDir)) throw new Error(`FreeCut directory not found: ${freecutDir}`)
  if (!fs.existsSync(path.join(freecutDir, 'dist', 'headless.html'))) {
    throw new Error(`FreeCut dist/headless.html not found in ${freecutDir}. Run npm run build first.`)
  }
  if (!fs.existsSync(inputFile)) throw new Error(`Input clip not found: ${inputFile}`)

  const requireFromFreecut = createRequire(path.join(freecutDir, 'package.json'))
  const { chromium } = requireFromFreecut('playwright')

  const modUrl = (rel) => pathToFileURL(path.join(freecutDir, rel)).href
  const { chromeLaunchArgs } = await import(modUrl('headless/lib/cli.mjs'))
  const { prepareJob, renderJob, startHarness } = await import(modUrl('headless/lib/render-core.mjs'))
  const { PageSession, probeGpu } = await import(modUrl('headless/lib/page-session.mjs'))
  const { collectAddClipMedia } = await import(modUrl('headless/lib/workspace.mjs'))
  const {
    acquireWriterLock,
    assertAtomicReplace,
    commitStagedMedia,
    createProjectResource,
    getProjectResource,
    projectForEngine,
    saveProjectResource,
    stageLocalMedia,
  } = await import(modUrl('headless/lib/lifecycle-store.mjs'))

  fs.mkdirSync(workspace, { recursive: true })
  fs.mkdirSync(path.dirname(outFile), { recursive: true })

  const browserChoice = resolveBrowserLaunch(browserPref)
  const startedAt = Date.now()
  const harness = await startHarness({ workspace })
  const browser = await chromium.launch({
    ...browserChoice.launch,
    headless: true,
    args: chromeLaunchArgs(),
  })
  const session = new PageSession({ browser, harnessUrl: harness.harnessUrl })

  let releaseLock = null
  try {
    await session.open()
    const gpu = await probeGpu(session.page)

    releaseLock = await acquireWriterLock(workspace)
    await assertAtomicReplace(workspace)

    const projectId = 'fdn012-sample'
    const createdProject = await session.page.evaluate(
      (cfg) => window.freecut.createProject(cfg),
      {
        id: projectId,
        name: 'FDN-012 FreeCut Sample',
        description: 'Verificacion Fase 1 FME',
        width: 1280,
        height: 720,
        fps: 30,
        backgroundColor: '#000000',
      },
    )
    const createdResource = await createProjectResource(workspace, createdProject)

    const mediaId = 'clip-5s'
    const staged = await stageLocalMedia(workspace, inputFile, mediaId)
    const probe = await session.page.evaluate(
      (payload) => window.freecut.probeMedia(payload),
      {
        url: harness.mediaUrlOf(staged.id),
        fileName: path.basename(staged.target),
        mimeType: staged.mimeType,
      },
    )
    const mediaResource = await commitStagedMedia(staged, probe, { workspace, projectId })

    const ops = [
      { op: 'addClip', mediaId, from: 0, durationInFrames: 150 },
      { callerId: 'overlayTrack', op: 'addTrack', kind: 'video' },
      {
        op: 'addText',
        trackId: { $ref: 'overlayTrack#/detail/trackId' },
        text: 'FDN-012 FreeCut',
        from: 15,
        durationInFrames: 90,
        fontSize: 48,
        color: '#ffffff',
      },
    ]

    const currentProject = await getProjectResource(workspace, projectId)
    const edited = await session.page.evaluate(
      (payload) => window.freecut.editProject(payload),
      {
        project: projectForEngine(currentProject.project),
        ops,
        media: collectAddClipMedia(workspace, ops),
      },
    )
    const normalized = await session.page.evaluate(
      (value) => window.freecut.normalizeProject(value),
      edited.project,
    )
    const saved = await saveProjectResource(workspace, projectId, normalized, {
      expectedRevision: createdResource.revision,
    })

    if (projectOut) {
      fs.mkdirSync(path.dirname(projectOut), { recursive: true })
      fs.writeFileSync(projectOut, `${JSON.stringify(saved.project, null, 2)}\n`, 'utf8')
    }

    const job = prepareJob(
      workspace,
      {
        project: projectId,
        out: outFile,
        codec: 'h264',
        container: 'mp4',
        quality: 'high',
        fps: 30,
        resolution: '1280x720',
      },
      harness.mediaUrlOf,
    )
    const renderSummary = await renderJob(session.page, job, {
      allowMissingMedia: false,
      downloadTimeoutMs: 120_000,
    })

    const totalMs = Date.now() - startedAt
    const report = {
      ok: true,
      freecutDir,
      browser: browserChoice.label,
      gpu,
      projectId,
      projectJsonPath: job.projectJsonPath,
      media: {
        id: mediaResource.id,
        mimeType: mediaResource.metadata.mimeType,
        duration: mediaResource.metadata.duration,
        width: mediaResource.metadata.width,
        height: mediaResource.metadata.height,
        fps: mediaResource.metadata.fps,
        codec: mediaResource.metadata.codec,
        audioCodec: mediaResource.metadata.audioCodec,
        audioCodecSupported: mediaResource.metadata.audioCodecSupported,
        videoCodecSupported: mediaResource.metadata.videoCodecSupported,
      },
      edit: {
        applied: edited.applied,
        results: edited.results,
        tracksCount: saved.project.timeline?.tracks?.length ?? 0,
        itemsCount: saved.project.timeline?.items?.length ?? 0,
      },
      render: {
        outputPath: renderSummary.outputPath,
        mimeType: renderSummary.mimeType,
        fileSize: renderSummary.fileSize,
        durationSeconds: renderSummary.durationSeconds,
        effectiveSettings: renderSummary.effectiveSettings,
        warnings: renderSummary.warnings,
      },
      totalMs,
    }
    console.log(JSON.stringify(report, null, 2))
  } finally {
    await releaseLock?.().catch(() => {})
    await session.close().catch(() => {})
    await browser.close().catch(() => {})
    await harness.closeServers().catch(() => {})
  }
}

main().catch((err) => {
  console.error(err?.stack || err?.message || String(err))
  process.exit(1)
})
