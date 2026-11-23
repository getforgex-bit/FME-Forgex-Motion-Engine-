// Servidor de prueba (solo tests): tarjetas reales de Revideo y un adaptador de prueba que NO renderiza,
// para comprobar el cableado de job.run (rutas, directorio de job, conformidad) sin motor.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { advanced, simple } from '@fme/adapter-revideo';
import { createConnectorRegistry, type AdapterJobResult, type ConnectorAdapter } from '@fme/connectors';
import { createFmeServer } from '../src/server.ts';

const root = process.argv[2];
if (!root) throw new Error('Falta la raíz');

const adapter: ConnectorAdapter = {
  simple,
  advanced,
  async probe() {
    return { available: true, engineVersion: 'test-double', diagnostics: [] };
  },
  async run(job, ctx): Promise<AdapterJobResult> {
    mkdirSync(ctx.workDir, { recursive: true });
    const out = join(ctx.workDir, 'out.txt');
    writeFileSync(out, JSON.stringify({ inputs: job.inputs, jobId: ctx.jobId }));
    return {
      jobId: ctx.jobId,
      status: 'failed',
      outputs: [],
      provenance: [],
      diagnostics: [{ code: 'TEST_DOUBLE', message: `workDir=${ctx.workDir}` }],
    };
  },
};

const registry = createConnectorRegistry();
registry.register(simple, advanced);
const server = createFmeServer({ root, registry, adapters: new Map([[simple.id, adapter]]) });
await server.connect(new StdioServerTransport());
