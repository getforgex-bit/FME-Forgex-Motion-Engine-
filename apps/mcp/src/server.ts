/**
 * Servidor MCP mínimo de FME (FDN-080, spec §10). Es un adaptador de la API existente
 * (`@fme/project`, `ConnectorRegistry`, `@fme/router` y los adaptadores registrados), no un segundo sistema.
 * Las herramientas sin implementación devuelven un error estructurado `NOT_IMPLEMENTED`; no se simulan.
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  ADVANCED_SECTIONS,
  ConnectorRegistryError,
  checkAdapterResult,
  type ConnectorAdapter,
  type ConnectorFilter,
  type ConnectorRegistry,
  type JobRequest,
} from '@fme/connectors';
import { SCHEMA_VERSION, parseProject, serialize } from '@fme/project';
import { planRoute, type RouteOptions, type RouteTask } from '@fme/router';
import { exportProject } from './export.ts';
import { DEFAULT_PREVIEW_VRAM_MIB, OpsError, loadProjectFile, previewRender, summarize } from './ops.ts';
import { PathError, resolveInRoot } from './paths.ts';

export type FmeServerOptions = {
  /** Raíz permitida: todo proyecto y todo directorio de job queda dentro. */
  root: string;
  registry: ConnectorRegistry;
  /** Adaptadores ejecutables por `job.run`, por id de conector. Deben estar también en `registry`. */
  adapters?: ReadonlyMap<string, ConnectorAdapter>;
  /** Tope de tiempo por job en ms (por defecto 600 000; el valor por defecto de cada job es 120 000). */
  jobTimeoutMs?: number;
  name?: string;
  version?: string;
};

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: true };

export type StructuredError = { error: { code: string; message: string; details?: unknown } };

function ok(value: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

function fail(code: string, message: string, details?: unknown): ToolResult {
  const body: StructuredError = { error: { code, message, ...(details !== undefined ? { details } : {}) } };
  return { content: [{ type: 'text', text: JSON.stringify(body, null, 2) }], isError: true };
}

/** Convierte cualquier excepción conocida en un error estructurado. */
function fromThrown(e: unknown): ToolResult {
  if (e instanceof PathError) return fail(e.code, e.message);
  if (e instanceof OpsError) return fail(e.code, e.message, e.details);
  if (e instanceof ConnectorRegistryError) return fail(e.code, e.message);
  const err = e as NodeJS.ErrnoException;
  if (err?.code === 'ENOENT') return fail('FILE_NOT_FOUND', 'El archivo no existe.');
  if (err?.code === 'EEXIST') return fail('FILE_EXISTS', 'El archivo ya existe; no se sobrescribe.');
  return fail('INTERNAL_ERROR', e instanceof Error ? e.message : String(e));
}

const NOT_IMPLEMENTED = {
  'preview.inspect': 'La inspección de resultados (fotogramas, métricas) aún no existe.',
} as const;

export function createFmeServer(options: FmeServerOptions): McpServer {
  const { root, registry } = options;
  const adapters = options.adapters ?? new Map<string, ConnectorAdapter>();
  const server = new McpServer({ name: options.name ?? 'fme', version: options.version ?? '0.0.0' });

  server.registerTool(
    'project.create',
    {
      description: 'Crea un proyecto universal vacío (schemaVersion actual). Con `path` lo guarda dentro de la raíz sin sobrescribir.',
      inputSchema: {
        id: z.string().min(1),
        name: z.string(),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        fps: z.strictObject({ num: z.number().int().positive(), den: z.number().int().positive() }).default({ num: 30, den: 1 }),
        seed: z.number().int().default(0),
        path: z.string().optional(),
      },
    },
    async (args) => {
      try {
        const parsed = parseProject({
          schemaVersion: SCHEMA_VERSION,
          id: args.id,
          name: args.name,
          fps: args.fps,
          width: args.width,
          height: args.height,
          seed: args.seed,
          assets: [],
          sequences: [],
        });
        if (!parsed.ok) return fail('INVALID_PROJECT', 'El proyecto no es válido.', parsed.errors);
        let saved: string | undefined;
        if (args.path !== undefined) {
          const file = resolveInRoot(root, args.path);
          mkdirSync(dirname(file), { recursive: true });
          writeFileSync(file, serialize(parsed.value), { flag: 'wx' });
          saved = relative(resolve(root), file);
        }
        return ok({ project: parsed.value, summary: summarize(parsed.value), ...(saved !== undefined ? { savedAs: saved } : {}) });
      } catch (e) {
        return fromThrown(e);
      }
    },
  );

  server.registerTool(
    'project.open',
    {
      description: 'Abre un proyecto de la raíz (migrando versiones anteriores) y devuelve el resumen y, opcionalmente, el proyecto completo.',
      inputSchema: { path: z.string(), includeProject: z.boolean().default(false) },
    },
    async (args) => {
      try {
        const { project } = loadProjectFile(resolveInRoot(root, args.path));
        return ok({ summary: summarize(project), ...(args.includeProject ? { project } : {}) });
      } catch (e) {
        return fromThrown(e);
      }
    },
  );

  server.registerTool(
    'connectors.list',
    {
      description: 'Lista las tarjetas simples de los conectores registrados, con filtros opcionales. `unknown` nunca cuenta como `yes`: marca «requiere inspección».',
      inputSchema: {
        capability: z.string().optional(),
        accepts: z.string().optional(),
        produces: z.string().optional(),
        executor: z.enum(['cli', 'api', 'library', 'mcp']).optional(),
      },
    },
    async (args) => {
      try {
        const filter: ConnectorFilter = {};
        if (args.capability !== undefined) filter.capability = args.capability;
        if (args.accepts !== undefined) filter.accepts = args.accepts;
        if (args.produces !== undefined) filter.produces = args.produces;
        if (args.executor !== undefined) filter.executor = args.executor;
        return ok({ connectors: registry.listSimple(filter) });
      } catch (e) {
        return fromThrown(e);
      }
    },
  );

  server.registerTool(
    'connectors.inspect',
    {
      description: 'Devuelve solo las secciones pedidas de la tarjeta avanzada de un conector.',
      inputSchema: { id: z.string().min(1), sections: z.array(z.enum(ADVANCED_SECTIONS)).min(1) },
    },
    async (args) => {
      try {
        return ok(registry.inspect(args.id, args.sections));
      } catch (e) {
        return fromThrown(e);
      }
    },
  );

  server.registerTool(
    'route.plan',
    {
      description: 'Planifica (sin ejecutar) qué conector debe realizar una tarea, con el enrutador de 8 pasos y su justificación.',
      inputSchema: {
        task: z.strictObject({
          id: z.string().optional(),
          operation: z.string().min(1),
          requiredCapabilities: z.array(z.string()).optional(),
          requiredAccepts: z.array(z.string()).optional(),
          requiredProduces: z.array(z.string()).optional(),
          requiredEditability: z.array(z.enum(['native', 'linked', 'baked', 'unknown'])).optional(),
          availableConnectorIds: z.array(z.string()).optional(),
        }),
        options: z
          .strictObject({
            mode: z.enum(['auto', 'manual', 'hybrid']).optional(),
            manualConnectorId: z.string().optional(),
            preferredConnectorIds: z.array(z.string()).optional(),
            excludedConnectorIds: z.array(z.string()).optional(),
          })
          .optional(),
      },
    },
    async (args) => {
      try {
        return ok(planRoute(registry, args.task as RouteTask, (args.options ?? {}) as RouteOptions));
      } catch (e) {
        return fromThrown(e);
      }
    },
  );

  server.registerTool(
    'job.run',
    {
      description: 'Ejecuta un job con el adaptador registrado del conector indicado. Las entradas deben estar dentro de la raíz; la salida se escribe en un directorio propio del job.',
      inputSchema: {
        connectorId: z.string().min(1),
        job: z.strictObject({
          projectId: z.string().min(1),
          operation: z.string().min(1),
          inputs: z.array(z.strictObject({ uri: z.string().min(1), type: z.string().min(1) })),
          requirements: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
          seed: z.number().int().optional(),
        }),
        timeoutMs: z.number().int().positive().optional(),
      },
    },
    async (args) => {
      try {
        const adapter = adapters.get(args.connectorId);
        if (adapter === undefined || !registry.has(args.connectorId)) {
          return fail('ADAPTER_NOT_AVAILABLE', `No hay un adaptador ejecutable registrado para «${args.connectorId}».`);
        }
        const inputs = args.job.inputs.map((i) => ({ uri: resolveInRoot(root, i.uri), type: i.type }));
        const job: JobRequest = {
          projectId: args.job.projectId,
          operation: args.job.operation,
          inputs,
          requirements: args.job.requirements,
          ...(args.job.seed !== undefined ? { seed: args.job.seed } : {}),
        };
        const jobId = randomUUID();
        const workDir = resolveInRoot(root, `.fme-jobs/${jobId}`);
        mkdirSync(workDir, { recursive: true });
        const cap = options.jobTimeoutMs ?? 600_000;
        const timeoutMs = Math.min(args.timeoutMs ?? 120_000, cap);
        const result = await adapter.run(job, { jobId, workDir, timeoutMs });
        return ok({ result, conformance: checkAdapterResult(result, adapter) });
      } catch (e) {
        return fromThrown(e);
      }
    },
  );

  server.registerTool(
    'preview.render',
    {
      description: 'Genera una preview real de una capa (o de un rango de sus fotogramas) a la resolución del perfil de 4 GB (@fme/render-plan) con el adaptador que la enrute. Devuelve ENGINE_UNAVAILABLE sin ejecutar nada si falta el motor.',
      inputSchema: {
        path: z.string(),
        layerId: z.string().min(1),
        startFrame: z.number().int().min(0).optional(),
        endFrame: z.number().int().positive().optional().describe('Exclusivo, relativo a la capa'),
        vramBudgetMiB: z.number().positive().default(DEFAULT_PREVIEW_VRAM_MIB),
        alpha: z.boolean().default(false),
        timeoutMs: z.number().int().positive().optional(),
      },
    },
    async (args) => {
      try {
        const file = resolveInRoot(root, args.path);
        const workRoot = resolveInRoot(root, '.fme-jobs');
        mkdirSync(workRoot, { recursive: true });
        const cap = options.jobTimeoutMs ?? 600_000;
        const rendered = await previewRender({
          adapters: [...adapters.values()],
          projectFile: file,
          layerId: args.layerId,
          workRoot,
          vramBudgetMiB: args.vramBudgetMiB,
          timeoutMs: Math.min(args.timeoutMs ?? 120_000, cap),
          alpha: args.alpha,
          ...(args.startFrame !== undefined ? { startFrame: args.startFrame } : {}),
          ...(args.endFrame !== undefined ? { endFrameExclusive: args.endFrame } : {}),
        });
        return ok(rendered);
      } catch (e) {
        return fromThrown(e);
      }
    },
  );

  server.registerTool(
    'project.export',
    {
      description: 'Exporta el proyecto con el pipeline híbrido (Revideo + Blender + FreeCut reales): MP4 final y proyecto con los artefactos enlazados, dentro de la raíz. Puede tardar minutos. Devuelve ENGINE_UNAVAILABLE sin ejecutar ningún paso si falta un motor; el progreso por pasos va en `progress` (se informa al terminar).',
      inputSchema: {
        path: z.string(),
        outDir: z.string().optional().describe('Carpeta vacía o inexistente dentro de la raíz; por defecto .fme-exports/<id>'),
        blenderResolution: z.string().optional().describe('ANCHOxALTO con la que renderiza Blender, p. ej. 960x540'),
        timeoutMs: z.number().int().positive().max(3_600_000).optional().describe('Tiempo máximo por paso'),
      },
    },
    async (args) => {
      try {
        const file = resolveInRoot(root, args.path);
        const outDir = resolveInRoot(root, args.outDir ?? `.fme-exports/${randomUUID()}`);
        const exported = await exportProject({
          projectFile: file,
          outDir,
          ...(args.blenderResolution !== undefined ? { blenderResolution: args.blenderResolution } : {}),
          ...(args.timeoutMs !== undefined ? { timeoutMs: args.timeoutMs } : {}),
        });
        return ok({ ...exported, outDir });
      } catch (e) {
        return fromThrown(e);
      }
    },
  );

  for (const [name, reason] of Object.entries(NOT_IMPLEMENTED)) {
    server.registerTool(name, { description: `No implementada todavía. ${reason}`, inputSchema: {} }, async () =>
      fail('NOT_IMPLEMENTED', reason, { tool: name }),
    );
  }

  return server;
}
