#!/usr/bin/env node
/**
 * Entrada stdio del servidor MCP de FME. Uso: `node dist/main.js --root <carpeta>` (o `FME_MCP_ROOT`).
 * Por defecto no registra adaptadores: `FME_MCP_ADAPTERS=revideo` registra el de Revideo si está instalado
 * (`FME_REVIDEO_ENGINE_DIR` cambia la carpeta de su motor).
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createConnectorRegistry, type ConnectorAdapter } from '@fme/connectors';
import { createFmeServer } from './server.ts';

function rootFromArgs(argv: string[]): string {
  const i = argv.indexOf('--root');
  const fromArg = i >= 0 ? argv[i + 1] : undefined;
  const root = fromArg ?? process.env.FME_MCP_ROOT;
  if (!root) {
    process.stderr.write('Falta la raíz: usa --root <carpeta> o FME_MCP_ROOT.\n');
    process.exit(2);
  }
  return root;
}

async function loadAdapters(): Promise<ConnectorAdapter[]> {
  const wanted = (process.env.FME_MCP_ADAPTERS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const adapters: ConnectorAdapter[] = [];
  for (const name of wanted) {
    if (name !== 'revideo') {
      process.stderr.write(`Adaptador desconocido: ${name}\n`);
      process.exit(2);
    }
    const moduleName = '@fme/adapter-revideo';
    const mod = (await import(moduleName)) as { RevideoAdapter: new (opts?: { engineDir?: string }) => ConnectorAdapter };
    const engineDir = process.env.FME_REVIDEO_ENGINE_DIR;
    adapters.push(new mod.RevideoAdapter(engineDir ? { engineDir } : {}));
  }
  return adapters;
}

const registry = createConnectorRegistry();
const adapters = new Map<string, ConnectorAdapter>();
for (const a of await loadAdapters()) {
  registry.register(a.simple, a.advanced);
  adapters.set(a.simple.id, a);
}
const server = createFmeServer({ root: rootFromArgs(process.argv.slice(2)), registry, adapters });
await server.connect(new StdioServerTransport());
