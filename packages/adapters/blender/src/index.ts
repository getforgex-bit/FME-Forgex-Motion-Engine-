import { lstatSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTRACT_VERSION } from '@fme/connectors';
import { runIsolated } from '@fme/runtime-workers';
import { cameraType, collectArtifacts, isRecord, pngType } from './artifacts.ts';
import { checkRoots, requirePath } from './paths.ts';
import { operation, prepareJob, projectType } from './request.ts';
import type { AdapterJobResult, CardAdvanced, CardSimple, ConnectorAdapter, JobContext, JobRequest, ProbeResult } from '@fme/connectors';
import type { IsolatedRunResult, WorkerArgument } from '@fme/runtime-workers';

type BlenderDiagnostic = { code: string; message: string; severity: 'error' | 'warning' };
export type BlenderJobResult = Omit<AdapterJobResult, 'diagnostics'> & { diagnostics: BlenderDiagnostic[] };
export type BlenderAdapter = Omit<ConnectorAdapter, 'run'> & {
  run(job: JobRequest, ctx: JobContext): Promise<BlenderJobResult>;
};

export type BlenderAdapterOptions = {
  /** Directorios locales, controlados por el anfitrión, para proyectos, assets y jobs. */
  allowedRoots: readonly string[];
  /** Configuración de confianza, nunca parte de JobRequest. */
  blenderPath?: string;
};

const defaultBlender = process.platform === 'win32'
  ? 'C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe'
  : process.platform === 'darwin' ? '/Applications/Blender.app/Contents/MacOS/Blender' : '/usr/bin/blender';
const script = fileURLToPath(new URL('../../../../runtime/engines/blender/render_scene.py', import.meta.url));
const pluginId = 'adapter.blender';
const pluginVersion = '0.0.0';
const probeTimeoutMs = 30_000;

function makeSimpleCard(): CardSimple {
  return {
    id: pluginId,
    name: 'Blender',
    version: pluginVersion,
    contractVersion: CONTRACT_VERSION,
    capabilities: ['animate.3d', operation],
    accepts: [projectType],
    produces: [pngType, cameraType],
    executor: 'cli',
  };
}

function makeAdvancedCard(): CardAdvanced {
  return {
    pluginId,
    technical: { headless: 'yes', alpha: 'yes', keyframes: 'yes', audioInPngSequence: 'no', depth: 'unknown', gpuCompute: 'unknown' },
    permissions: ['read:local-project', 'read:local-model3d', 'read:bundled-script', 'write:job'],
    editability: 'unknown',
    licenseReview: 'pending',
  };
}

function executablePath(configured: string): string {
  if (!isAbsolute(configured)) throw new Error('Configura FME_BLENDER_PATH como ruta absoluta al ejecutable.');
  // La ruta del motor procede de la configuración del anfitrión, nunca de un job.
  const executable = realpathSync.native(configured);
  if (!lstatSync(executable).isFile()) throw new Error('La ruta del motor no identifica un archivo.');
  return executable;
}

function tempEnvironment(directory: string) {
  return { TEMP: directory, TMP: directory, TMPDIR: directory };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function unavailable(code: string, text: string): ProbeResult {
  return { available: false, diagnostics: [{ code, message: text }] };
}

function failed(ctx: JobContext, code: string, text: string): BlenderJobResult {
  return { jobId: ctx.jobId, status: 'failed', outputs: [], provenance: [], diagnostics: [
    { code, message: text, severity: 'error' },
  ] };
}

function timedOut(result: IsolatedRunResult): boolean {
  if (result.killed) return true;
  const report: unknown = JSON.parse(readFileSync(join(dirname(result.stdoutPath), 'worker.json'), 'utf8'));
  return isRecord(report) && report.timedOut === true;
}

async function probeBlender(configured: string): Promise<ProbeResult> {
  let probeDir: string | undefined;
  try {
    const executable = executablePath(configured);
    probeDir = mkdtempSync(join(realpathSync.native(tmpdir()), 'fme-blender-probe-'));
    const result = await runIsolated({ cmd: executable, args: ['--version'], workDir: probeDir,
      allowedPaths: [executable, probeDir], timeoutMs: probeTimeoutMs, env: tempEnvironment(probeDir) });
    if (timedOut(result)) return unavailable('BLENDER_PROBE_TIMEOUT', 'Blender no respondió a --version a tiempo.');
    if (result.exitCode !== 0) return unavailable('BLENDER_UNAVAILABLE', 'No se pudo ejecutar blender --version.');
    const output = readFileSync(result.stdoutPath, 'utf8');
    const version = /^Blender (\d+\.\d+\.\d+)(?:\s|$)/m.exec(output)?.[1];
    if (!version) return unavailable('BLENDER_VERSION_UNKNOWN', 'Blender no informó una versión reconocida.');
    return { available: true, engineVersion: version, diagnostics: [] };
  } catch (error) {
    return unavailable('BLENDER_UNAVAILABLE', message(error));
  } finally {
    if (probeDir !== undefined) rmSync(probeDir, { recursive: true, force: true, maxRetries: 2 });
  }
}

export function createBlenderAdapter(options: BlenderAdapterOptions): BlenderAdapter {
  const configured = options.blenderPath ?? process.env.FME_BLENDER_PATH ?? defaultBlender;
  const allowedRoots = [...options.allowedRoots];
  return {
    simple: makeSimpleCard(),
    advanced: makeAdvancedCard(),
    probe: () => probeBlender(configured),
    async run(job, ctx) {
      let prepared;
      let workDir;
      try {
        const roots = checkRoots(allowedRoots);
        workDir = requirePath(ctx.workDir, roots, 'directory');
        if (!ctx.jobId || !Number.isSafeInteger(ctx.timeoutMs) || ctx.timeoutMs < 1 || ctx.timeoutMs > 2_147_483_647) {
          throw new Error('jobId y timeoutMs válidos son obligatorios.');
        }
        prepared = prepareJob(job, roots);
      } catch (error) {
        return failed(ctx, 'BLENDER_INVALID_JOB', message(error));
      }

      let executable;
      try {
        executable = executablePath(configured);
      } catch (error) {
        return failed(ctx, 'BLENDER_UNAVAILABLE', message(error));
      }

      const diagnostics: BlenderDiagnostic[] = [];
      const { layer, modelPath, request, cameraGuide } = prepared;
      if (!modelPath) diagnostics.push({
        severity: 'warning',
        code: 'BLENDER_ASSET_MISSING',
        message: 'El asset de la capa ' + layer.id + ' no está disponible. Se renderizó un primitivo de sustitución.',
      });

      let result;
      const startedAt = new Date().toISOString();
      try {
        const requestPath = join(mkdtempSync(join(workDir, 'blender-input-')), 'request.json');
        writeFileSync(requestPath, JSON.stringify(request) + '\n', { flag: 'wx', mode: 0o600 });
        const args: WorkerArgument[] = ['-b', '--factory-startup', '--disable-autoexec', '--python-exit-code', '1',
          '-P', { path: script }, '--', { path: requestPath }];
        const allowedPaths = [executable, script, workDir];
        if (modelPath) {
          args.push({ path: modelPath });
          allowedPaths.push(modelPath);
        }
        result = await runIsolated({ cmd: executable, args, workDir, allowedPaths, timeoutMs: ctx.timeoutMs, env: tempEnvironment(workDir) });
        if (timedOut(result)) return failed(ctx, 'BLENDER_TIMEOUT', 'Se agotó el tiempo de ejecución de Blender.');
        if (result.exitCode !== 0) {
          return failed(ctx, 'BLENDER_RENDER_FAILED', 'Blender no terminó correctamente. Consulta ' + result.stderrPath + '.');
        }
      } catch (error) {
        return failed(ctx, 'BLENDER_RENDER_FAILED', message(error));
      }

      try {
        const directory = requirePath(dirname(dirname(result.stdoutPath)), [workDir], 'directory');
        const artifacts = collectArtifacts(directory, request, {
          pluginId,
          pluginVersion,
          startedAt,
          durationMs: result.durationMs,
          seed: request.seed,
          params: {
            layerId: layer.id,
            startFrame: layer.startFrame,
            durationFrames: request.durationFrames,
            width: request.width,
            height: request.height,
            fpsNum: request.fps.num,
            fpsDen: request.fps.den,
            fallbackPrimitive: modelPath === undefined,
          },
        }, cameraGuide);
        return { jobId: ctx.jobId, status: 'ok', ...artifacts, diagnostics };
      } catch (error) {
        return failed(ctx, 'BLENDER_INVALID_OUTPUT', message(error));
      }
    },
  };
}
