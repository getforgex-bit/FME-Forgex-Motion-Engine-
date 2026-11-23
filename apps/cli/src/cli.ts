/**
 * CLI de FME (FDN-081): opera sin agente sobre la misma API que `apps/mcp`
 * (`@fme/project`, `ConnectorRegistry`, `@fme/router` y los adaptadores registrados).
 *
 * Códigos de salida: 0 correcto · 1 error de la operación (proyecto inválido, ruta rechazada, job fallido)
 * · 2 uso incorrecto · 3 motor no disponible (el job no se ejecutó).
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { RevideoAdapter } from '@fme/adapter-revideo';
import {
  ConnectorRegistryError,
  checkAdapterResult,
  createConnectorRegistry,
  type ConnectorAdapter,
  type ConnectorFilter,
  type ConnectorRegistry,
  type JobRequest,
} from '@fme/connectors';
import { deserialize, serialize, type Layer, type Project, type ValidationIssue } from '@fme/project';
import { planRoute, type RouteTask } from '@fme/router';

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

function loadProject(file: string): { project: Project; sourceVersion: unknown } {
  let text: string;
  try {
    text = readFileSync(resolve(file), 'utf8').replace(/\r\n/g, '\n');
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    throw new CliError(err.code === 'ENOENT' ? 'FILE_NOT_FOUND' : 'FILE_UNREADABLE', `No se puede leer «${file}»: ${err.message}`);
  }
  const result = deserialize(text);
  if (!result.ok) {
    const unknown = result.errors.some((i) => i.code === 'unknown-schema-version');
    throw new CliError(unknown ? 'UNKNOWN_SCHEMA_VERSION' : 'INVALID_PROJECT', `El proyecto «${file}» no es válido.`, EXIT.error, result.errors);
  }
  let sourceVersion: unknown;
  try {
    sourceVersion = (JSON.parse(text) as { schemaVersion?: unknown }).schemaVersion;
  } catch {
    sourceVersion = undefined;
  }
  return { project: result.value, sourceVersion };
}

function summarize(p: Project) {
  const layers = p.sequences.flatMap((s) => s.scenes.flatMap((sc) => sc.layers));
  return {
    id: p.id,
    name: p.name,
    schemaVersion: p.schemaVersion,
    fps: p.fps,
    size: { width: p.width, height: p.height },
    assets: p.assets.length,
    sequences: p.sequences.length,
    scenes: p.sequences.reduce((n, s) => n + s.scenes.length, 0),
    layers: layers.length,
  };
}

function findLayer(project: Project, layerId: string): Layer {
  for (const seq of project.sequences) {
    for (const scene of seq.scenes) {
      const layer = scene.layers.find((l) => l.id === layerId);
      if (layer) return layer;
    }
  }
  throw new CliError('LAYER_NOT_FOUND', `No existe la capa «${layerId}» en el proyecto.`);
}

/** Capacidad que debe tener el conector que renderice una capa. Las capas text y svg las pinta `render.video`. */
function capabilityFor(layer: Layer): string {
  return layer.kind === 'text' || layer.kind === 'svg' ? 'render.video' : `render.${layer.kind}`;
}

function buildRegistry(adapters: ConnectorAdapter[]): ConnectorRegistry {
  const registry = createConnectorRegistry();
  for (const a of adapters) registry.register(a.simple, a.advanced);
  return registry;
}

function routeTaskFor(layer: Layer): RouteTask {
  return {
    operation: 'render.video',
    requiredCapabilities: [capabilityFor(layer)],
    requiredAccepts: ['fme/project+json'],
  };
}

function requireString(value: string | undefined, name: string): string {
  if (value === undefined || value === '') throw new CliError('USAGE', `Falta ${name}.`, EXIT.usage);
  return value;
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
        const { project, sourceVersion } = loadProject(requireString(file, 'el archivo del proyecto'));
        const migratedFrom = sourceVersion !== project.schemaVersion ? sourceVersion : undefined;
        const summary = summarize(project);
        emit(out, { valid: true, ...(migratedFrom !== undefined ? { migratedFrom } : {}), summary },
          `Válido: «${project.name}» (schemaVersion ${project.schemaVersion}${migratedFrom !== undefined ? `, migrado desde ${String(migratedFrom)}` : ''}), ${summary.layers} capas.`);
        return EXIT.ok;
      }
      case 'project migrate': {
        const { project } = loadProject(requireString(file, 'el archivo del proyecto'));
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
        const { project } = loadProject(requireString(file, 'el archivo del proyecto'));
        const layer = findLayer(project, requireString(values.layer, '--layer <id>'));
        const plan = planRoute(buildRegistry(adapters), routeTaskFor(layer));
        emit(out, plan, `${plan.status === 'planned' ? `Conector elegido: ${plan.selected?.connectorId}` : 'Sin conector'}. ${plan.justification}`);
        return plan.status === 'planned' ? EXIT.ok : EXIT.error;
      }
      case 'job run': {
        const projectFile = resolve(requireString(file, 'el archivo del proyecto'));
        const { project } = loadProject(projectFile);
        const layer = findLayer(project, requireString(values.layer, '--layer <id>'));
        const outDir = resolve(requireString(values.out, '--out <dir>'));
        const timeoutMs = values.timeout === undefined ? 120_000 : Number(values.timeout);
        if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new CliError('USAGE', '--timeout debe ser un entero positivo (ms).', EXIT.usage);

        const plan = planRoute(buildRegistry(adapters), routeTaskFor(layer));
        const connectorId = plan.selected?.connectorId;
        const adapter = adapters.find((a) => a.simple.id === connectorId);
        if (plan.status !== 'planned' || adapter === undefined) {
          throw new CliError('NO_CONNECTOR', `Ningún conector puede renderizar la capa «${layer.id}». ${plan.justification}`, EXIT.error, plan.rejections);
        }
        const probe = await adapter.probe();
        if (!probe.available) {
          throw new CliError('ENGINE_UNAVAILABLE', `El motor de «${adapter.simple.id}» no está disponible; no se ejecutó el job.`, EXIT.engineUnavailable, probe.diagnostics);
        }
        const jobId = randomUUID();
        const workDir = resolve(outDir, jobId);
        mkdirSync(workDir, { recursive: true });
        const job: JobRequest = {
          projectId: project.id,
          operation: 'render.video',
          inputs: [{ uri: projectFile, type: 'fme/project+json' }],
          requirements: { layerId: layer.id, ...(values.alpha ? { alpha: true } : {}) },
          seed: project.seed,
        };
        const result = await adapter.run(job, { jobId, workDir, timeoutMs });
        const conformance = checkAdapterResult(result, adapter);
        emit(out, { connectorId: adapter.simple.id, engineVersion: probe.engineVersion, result, conformance },
          result.status === 'ok'
            ? `Job ${result.jobId} correcto: ${result.outputs.map((o) => o.uri).join(', ')}`
            : `Job ${result.jobId} ${result.status}: ${result.diagnostics.map((d) => `${d.code}: ${d.message}`).join('; ')}`);
        return result.status === 'ok' && conformance.length === 0 ? EXIT.ok : EXIT.error;
      }
      default:
        throw new CliError('USAGE', `Comando desconocido: «${positionals.join(' ')}». Usa --help.`, EXIT.usage);
    }
  } catch (e) {
    if (e instanceof CliError) return fail(out, e);
    if (e instanceof ConnectorRegistryError) return fail(out, new CliError(e.code, e.message));
    return fail(out, new CliError('INTERNAL_ERROR', e instanceof Error ? e.message : String(e)));
  }
}
