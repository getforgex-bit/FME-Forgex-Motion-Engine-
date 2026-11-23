/**
 * `project.export` (FDN-080c): exporta el proyecto con `runHybrid` de `@fme/pipeline` (Revideo, Blender y FreeCut
 * reales). Compartido por el servidor MCP y la CLI. Solo usa la firma pública `runHybrid(projectPath, outDir, options)`.
 */
import { mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { RevideoAdapter } from '@fme/adapter-revideo';
import type { HybridOptions } from '@fme/pipeline';
import { OpsError, loadProjectFile, summarize } from './ops.ts';

export type ExportStepSummary = {
  step: string;
  layerId?: string;
  operation: string;
  adapterId: string;
  status: 'ok' | 'failed';
  /** Suma de `durationMs` de la procedencia del paso (0 si el paso no dejó procedencia). */
  durationMs: number;
  outputs: string[];
  diagnostics: { code: string; message: string; severity?: string }[];
};

export type ExportResult = {
  mp4: string;
  projectPath: string;
  summary: ReturnType<typeof summarize>;
  /** Un elemento por paso del pipeline, en orden de ejecución. `runHybrid` no emite eventos: se informa al terminar. */
  progress: ExportStepSummary[];
  adaptersInProvenance: string[];
  artifacts: { id: string; type: string; uri: string }[];
};

export type ExportOptions = {
  projectFile: string;
  /** Carpeta de salida: no debe existir o estar vacía (no se sobrescribe un export anterior). */
  outDir: string;
  /** Resolución con la que Blender renderiza, `ANCHOxALTO` (por defecto la del pipeline, 960x540). */
  blenderResolution?: string;
  /** Tiempo máximo por paso en ms (por defecto 15 min, el de `runHybrid`). */
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
};

const RESOLUTION = /^[1-9]\d{1,4}x[1-9]\d{1,4}$/;

type StepLike = {
  id: string;
  layerId?: string;
  operation: string;
  adapterId: string;
  status: 'ok' | 'failed';
  diagnostics: ExportStepSummary['diagnostics'];
  provenance: readonly { uri: string; durationMs: number }[];
};

function summarizeSteps(steps: readonly StepLike[]): ExportStepSummary[] {
  return steps.map((s) => ({
    step: s.id,
    ...(s.layerId !== undefined ? { layerId: s.layerId } : {}),
    operation: s.operation,
    adapterId: s.adapterId,
    status: s.status,
    durationMs: s.provenance.reduce((n, p) => n + p.durationMs, 0),
    outputs: s.provenance.map((p) => p.uri),
    diagnostics: s.diagnostics,
  }));
}

/**
 * El pipeline se carga bajo demanda para no cargar los tres adaptadores en las demás operaciones.
 * Variables de entorno reconocidas: `FME_REVIDEO_ENGINE_DIR`, `FME_PUPPETEER_CACHE_DIR`, `FME_FFMPEG_PATH`,
 * `FME_FFPROBE_PATH`, `FME_BLENDER_PATH` y `FME_FREECUT_DIR`.
 * Errores: `ENGINE_UNAVAILABLE` (falta un motor; no se ejecutó ningún paso), `NO_CONNECTOR`, `INVALID_PROJECT`,
 * `OUT_DIR_NOT_EMPTY`, `INVALID_RESOLUTION` y `EXPORT_FAILED` (con el progreso hasta el fallo en `details`).
 */
export async function exportProject(options: ExportOptions): Promise<ExportResult> {
  const env = options.env ?? process.env;
  if (options.blenderResolution !== undefined && !RESOLUTION.test(options.blenderResolution)) {
    throw new OpsError('INVALID_RESOLUTION', `blenderResolution debe tener la forma ANCHOxALTO (p. ej. 960x540), no «${options.blenderResolution}».`);
  }
  const projectFile = resolve(options.projectFile);
  loadProjectFile(projectFile); // errores estructurados antes de tocar el disco
  const outDir = resolve(options.outDir);
  try {
    if (readdirSync(outDir).length > 0) {
      throw new OpsError('OUT_DIR_NOT_EMPTY', `La carpeta de salida «${outDir}» no está vacía; no se sobrescribe un export anterior.`);
    }
  } catch (e) {
    if (e instanceof OpsError) throw e;
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  mkdirSync(outDir, { recursive: true });

  const { runHybrid } = await import('@fme/pipeline');
  const hybridOptions: HybridOptions = {
    ...(options.blenderResolution !== undefined ? { blenderResolution: options.blenderResolution } : {}),
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    ...(env.FME_PUPPETEER_CACHE_DIR ? { puppeteerCacheDir: env.FME_PUPPETEER_CACHE_DIR } : {}),
    ...(env.FME_FFMPEG_PATH ? { ffmpegPath: env.FME_FFMPEG_PATH } : {}),
    ...(env.FME_FFPROBE_PATH ? { ffprobePath: env.FME_FFPROBE_PATH } : {}),
    ...(env.FME_BLENDER_PATH ? { blenderPath: env.FME_BLENDER_PATH } : {}),
    ...(env.FME_FREECUT_DIR ? { freecutDir: env.FME_FREECUT_DIR } : {}),
  };
  if (env.FME_REVIDEO_ENGINE_DIR) {
    // `HybridOptions` no expone la carpeta del motor de Revideo: se inyecta un adaptador ya construido.
    const probeWorkDir = resolve(outDir, 'probe', 'revideo');
    mkdirSync(probeWorkDir, { recursive: true });
    hybridOptions.adapters = {
      revideo: new RevideoAdapter({
        engineDir: env.FME_REVIDEO_ENGINE_DIR,
        probeWorkDir,
        ...(hybridOptions.ffmpegPath ? { ffmpegPath: hybridOptions.ffmpegPath } : {}),
        ...(hybridOptions.ffprobePath ? { ffprobePath: hybridOptions.ffprobePath } : {}),
        ...(hybridOptions.puppeteerCacheDir ? { puppeteerCacheDir: hybridOptions.puppeteerCacheDir } : {}),
      }),
    };
  }

  const result = await runHybrid(projectFile, outDir, hybridOptions);
  const progress = summarizeSteps(result.steps);
  if (result.status !== 'ok' || !result.mp4 || !result.projectPath || !result.project) {
    const first = result.diagnostics[0];
    const details = { diagnostics: result.diagnostics, progress };
    switch (first?.code) {
      case 'engine-missing':
        throw new OpsError('ENGINE_UNAVAILABLE', `Falta un motor; no se ejecutó ningún paso. ${first.message}`, details);
      case 'plan-rejected':
        throw new OpsError('NO_CONNECTOR', first.message, details);
      case 'invalid-project':
      case 'bad-project':
        throw new OpsError('INVALID_PROJECT', first.message, details);
      case 'bad-input':
        throw new OpsError('FILE_NOT_FOUND', first.message, details);
      default:
        throw new OpsError('EXPORT_FAILED', first ? first.message : 'La exportación falló sin diagnóstico.', details);
    }
  }
  return {
    mp4: result.mp4,
    projectPath: result.projectPath,
    summary: summarize(result.project),
    progress,
    adaptersInProvenance: result.adaptersInProvenance,
    artifacts: (result.project.artifacts ?? []).map((a) => ({ id: a.id, type: a.type, uri: a.uri })),
  };
}
