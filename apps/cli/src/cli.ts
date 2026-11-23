/**
 * CLI de FME (FDN-081, FDN-080b): opera sin agente sobre la misma lógica que el servidor MCP
 * (`@fme/mcp/ops`: carga de proyectos, enrutado, jobs y previews) y sobre `@fme/project`,
 * `ConnectorRegistry`, `@fme/router` y los adaptadores registrados.
 *
 * Códigos de salida: 0 correcto · 1 error de la operación (proyecto inválido, ruta rechazada, job fallido)
 * · 2 uso incorrecto · 3 motor no disponible (el job no se ejecutó).
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { RevideoAdapter } from '@fme/adapter-revideo';
import { ConnectorRegistryError, type ConnectorAdapter, type ConnectorFilter } from '@fme/connectors';
import {
  DEFAULT_PREVIEW_VRAM_MIB,
  OpsError,
  buildRegistry,
  findLayer,
  loadProjectFile,
  previewRender,
  renderLayer,
  routeTaskFor,
  summarize,
} from '@fme/mcp/ops';
import { serialize, type ValidationIssue } from '@fme/project';
import { planRoute } from '@fme/router';

export const EXIT = { ok: 0, error: 1, usage: 2, engineUnavailable: 3 } as const;

export type CliIo = { stdout: (text: string) => void; stderr: (text: string) => void };

export type CliOptions = {
  /** Adaptadores disponibles; por defecto los de `defaultAdapters()`. */
  adapters?: ConnectorAdapter[];
};

/** Adaptadores ejecutables conocidos por la CLI. `FME_REVIDEO_ENGINE_DIR` cambia la carpeta del motor de Revideo. */
export function defaultAdapters(env: NodeJS.ProcessEnv = process.env): ConnectorAdapter[] {
  const engineDir = env.FME_REVIDEO_ENGINE_DIR;
  return [new RevideoAdapter(engineDir ? { engineDir } : {})];
}

const HELP = `fme: CLI de Forgex Motion Engine

Uso: fme <comando> [opciones]

Comandos:
  project validate <archivo>                    Valida (y migra en memoria) un proyecto
  project migrate <archivo> [--out <archivo>]   Migra a la versión actual (stdout si no hay --out)
  connectors list [--capability c] [--accepts t] [--produces t]
  route plan <archivo> --layer <id>             Planifica qué conector renderiza la capa
  job run <archivo> --layer <id> --out <dir>    Ejecuta el job (--alpha, --timeout <ms>)
  preview render <archivo> --layer <id> --out <dir>
                                                Preview de la capa a la resolución del perfil de 4 GB
                                                (--start <n> --end <n> en fotogramas de la capa, --vram <MiB>, --alpha, --timeout <ms>)

Opciones generales: --json (salida JSON), --help
Códigos de salida: 0 correcto, 1 error, 2 uso incorrecto, 3 motor no disponible
`;

class CliError extends Error {
  readonly code: string;
  readonly exit: number;
  readonly details?: unknown;
  constructor(code: string, message: string, exit: number = EXIT.error, details?: unknown) {
    super(message);
    this.code = code;
    this.exit = exit;
    this.details = details;
  }
}

type Output = { json: boolean; io: CliIo };

function emit(out: Output, value: unknown, human: string): void {
  out.io.stdout(out.json ? `${JSON.stringify(value, null, 2)}\n` : `${human}\n`);
}

function fail(out: Output, e: CliError): number {
  const body = { error: { code: e.code, message: e.message, ...(e.details !== undefined ? { details: e.details } : {}) } };
  if (out.json) out.io.stdout(`${JSON.stringify(body, null, 2)}\n`);
  else {
    out.io.stderr(`Error [${e.code}]: ${e.message}\n`);
    if (Array.isArray(e.details)) {
      for (const d of e.details as ValidationIssue[]) out.io.stderr(`  - ${d.path}: ${d.message}\n`);
    }
  }
  return e.exit;
}

/** Traduce los errores de las operaciones compartidas; `ENGINE_UNAVAILABLE` tiene su propio código de salida. */
function fromOps(e: OpsError): CliError {
  return new CliError(e.code, e.message, e.code === 'ENGINE_UNAVAILABLE' ? EXIT.engineUnavailable : EXIT.error, e.details);
}

function load(file: string) {
  try {
    return loadProjectFile(resolve(file));
  } catch (e) {
    if (e instanceof OpsError) throw fromOps(e);
    throw e;
  }
}

function locate(project: ReturnType<typeof load>['project'], layerId: string) {
  try {
    return findLayer(project, layerId);
  } catch (e) {
    if (e instanceof OpsError) throw fromOps(e);
    throw e;
  }
}

function requireString(value: string | undefined, name: string): string {
  if (value === undefined || value === '') throw new CliError('USAGE', `Falta ${name}.`, EXIT.usage);
  return value;
}

function intOption(value: string | undefined, name: string, min: number): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) throw new CliError('USAGE', `${name} debe ser un entero ≥ ${min}.`, EXIT.usage);
  return n;
}

export async function run(argv: string[], io: CliIo, options: CliOptions = {}): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        json: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
        layer: { type: 'string' },
        out: { type: 'string' },
        capability: { type: 'string' },
        accepts: { type: 'string' },
        produces: { type: 'string' },
        timeout: { type: 'string' },
        alpha: { type: 'boolean' },
        start: { type: 'string' },
        end: { type: 'string' },
        vram: { type: 'string' },
      },
    });
  } catch (e) {
    const out: Output = { json: argv.includes('--json'), io };
    return fail(out, new CliError('USAGE', (e as Error).message, EXIT.usage));
  }
  const { values, positionals } = parsed;
  const out: Output = { json: values.json === true, io };
  if (values.help || positionals.length === 0) {
    io.stdout(HELP);
    return values.help ? EXIT.ok : EXIT.usage;
  }

  try {
    const command = positionals.slice(0, 2).join(' ');
    const file = positionals[2];
    if (positionals.length > 3) throw new CliError('USAGE', `Argumentos de más: ${positionals.slice(3).join(' ')}`, EXIT.usage);
    const adapters = options.adapters ?? defaultAdapters();

    switch (command) {
      case 'project validate': {
        const { project, sourceVersion } = load(requireString(file, 'el archivo del proyecto'));
        const migratedFrom = sourceVersion !== project.schemaVersion ? sourceVersion : undefined;
        const summary = summarize(project);
        emit(out, { valid: true, ...(migratedFrom !== undefined ? { migratedFrom } : {}), summary },
          `Válido: «${project.name}» (schemaVersion ${project.schemaVersion}${migratedFrom !== undefined ? `, migrado desde ${String(migratedFrom)}` : ''}), ${summary.layers} capas.`);
        return EXIT.ok;
      }
      case 'project migrate': {
        const { project } = load(requireString(file, 'el archivo del proyecto'));
        const text = serialize(project);
        if (values.out !== undefined) {
          writeFileSync(resolve(values.out), text);
          emit(out, { migrated: true, out: resolve(values.out), schemaVersion: project.schemaVersion }, `Migrado a schemaVersion ${project.schemaVersion}: ${values.out}`);
        } else if (out.json) {
          emit(out, { migrated: true, project }, '');
        } else {
          io.stdout(text);
        }
        return EXIT.ok;
      }
      case 'connectors list': {
        if (file !== undefined) throw new CliError('USAGE', 'connectors list no recibe argumentos posicionales.', EXIT.usage);
        const filter: ConnectorFilter = {};
        if (values.capability !== undefined) filter.capability = values.capability;
        if (values.accepts !== undefined) filter.accepts = values.accepts;
        if (values.produces !== undefined) filter.produces = values.produces;
        const entries = buildRegistry(adapters).listSimple(filter);
        emit(out, { connectors: entries },
          entries.length === 0 ? 'Ningún conector coincide.'
            : entries.map((e) => `${e.card.id} ${e.card.version} [${e.card.executor}] ${e.card.capabilities.join(', ')}${e.requiresInspection ? ' (requiere inspección)' : ''}`).join('\n'));
        return EXIT.ok;
      }
      case 'route plan': {
        const { project } = load(requireString(file, 'el archivo del proyecto'));
        const { layer } = locate(project, requireString(values.layer, '--layer <id>'));
        const plan = planRoute(buildRegistry(adapters), routeTaskFor(layer));
        emit(out, plan, `${plan.status === 'planned' ? `Conector elegido: ${plan.selected?.connectorId}` : 'Sin conector'}. ${plan.justification}`);
        return plan.status === 'planned' ? EXIT.ok : EXIT.error;
      }
      case 'job run': {
        const projectFile = resolve(requireString(file, 'el archivo del proyecto'));
        const { project } = load(projectFile);
        const { layer } = locate(project, requireString(values.layer, '--layer <id>'));
        const outDir = resolve(requireString(values.out, '--out <dir>'));
        const timeoutMs = intOption(values.timeout, '--timeout', 1) ?? 120_000;
        const jobId = randomUUID();
        const rendered = await renderLayer({
          adapters, projectFile, project, layer, jobId, workDir: resolve(outDir, jobId), timeoutMs,
          ...(values.alpha ? { alpha: true } : {}),
        });
        const { result, conformance } = rendered;
        emit(out, { connectorId: rendered.connectorId, engineVersion: rendered.engineVersion, result, conformance },
          result.status === 'ok'
            ? `Job ${result.jobId} correcto: ${result.outputs.map((o) => o.uri).join(', ')}`
            : `Job ${result.jobId} ${result.status}: ${result.diagnostics.map((d) => `${d.code}: ${d.message}`).join('; ')}`);
        return result.status === 'ok' && conformance.length === 0 ? EXIT.ok : EXIT.error;
      }
      case 'preview render': {
        const projectFile = resolve(requireString(file, 'el archivo del proyecto'));
        const layerId = requireString(values.layer, '--layer <id>');
        const outDir = resolve(requireString(values.out, '--out <dir>'));
        const startFrame = intOption(values.start, '--start', 0);
        const endFrame = intOption(values.end, '--end', 1);
        const vramBudgetMiB = intOption(values.vram, '--vram', 1) ?? DEFAULT_PREVIEW_VRAM_MIB;
        const timeoutMs = intOption(values.timeout, '--timeout', 1) ?? 120_000;
        mkdirSync(outDir, { recursive: true });
        const preview = await previewRender({
          adapters, projectFile, layerId, workRoot: outDir, vramBudgetMiB, timeoutMs,
          ...(startFrame !== undefined ? { startFrame } : {}),
          ...(endFrame !== undefined ? { endFrameExclusive: endFrame } : {}),
          ...(values.alpha ? { alpha: true } : {}),
        });
        const { result, conformance } = preview;
        emit(out, preview,
          result.status === 'ok'
            ? `Preview ${preview.profile.width}×${preview.profile.height}, fotogramas ${preview.range.startFrame}–${preview.range.endFrameExclusive}: ${result.outputs.map((o) => o.uri).join(', ')}`
            : `Preview ${result.status}: ${result.diagnostics.map((d) => `${d.code}: ${d.message}`).join('; ')}`);
        return result.status === 'ok' && conformance.length === 0 ? EXIT.ok : EXIT.error;
      }
      default:
        throw new CliError('USAGE', `Comando desconocido: «${positionals.join(' ')}». Usa --help.`, EXIT.usage);
    }
  } catch (e) {
    if (e instanceof CliError) return fail(out, e);
    if (e instanceof OpsError) return fail(out, fromOps(e));
    if (e instanceof ConnectorRegistryError) return fail(out, new CliError(e.code, e.message));
    return fail(out, new CliError('INTERNAL_ERROR', e instanceof Error ? e.message : String(e)));
  }
}
