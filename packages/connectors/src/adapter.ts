/**
 * Interfaz común de adaptadores (ADR-0011). La implementan Revideo (FDN-032),
 * Blender (FDN-040) y FreeCut (FDN-041).
 *
 * - `JobResult` (§8.3) no cambia: `AdapterJobResult` lo extiende con el id del job y la procedencia.
 * - Un adaptador ejecuta la herramienta externa mediante `@fme/runtime-workers` (`runIsolated`)
 *   y nunca con un shell.
 * - `probe()` comprueba la disponibilidad real. Si la herramienta no está, devuelve un diagnóstico;
 *   jamás afirma `available: true` sin haberla ejecutado.
 */
import type { CardAdvanced, CardSimple, JobRequest, JobResult } from './index.ts';

/** Procedencia de un artefacto generado (§2.4 trazabilidad, `RenderArtifact` de `@fme/project`). */
export type ArtifactProvenance = {
  uri: string;
  type: string;
  /** SHA-256 del archivo tal como está en disco. */
  sha256: string;
  /**
   * SHA-256 de los píxeles decodificados (RGBA), cuando el formato lleva metadatos volátiles
   * (p. ej. los PNG de Blender). Es el que se compara en regresión y caché.
   */
  contentSha256?: string;
  pluginId: string;
  pluginVersion: string;
  /** Versión exacta del motor ejecutado (p. ej. `5.2.3`, `0.11.0`), leída del propio motor. */
  engineVersion: string;
  params: Record<string, string | number | boolean>;
  seed?: number;
  startedAt: string;
  durationMs: number;
};

export type JobContext = {
  jobId: string;
  /** Directorio propio del job (lo crea quien llama, dentro de una raíz permitida). Solo se escribe aquí. */
  workDir: string;
  timeoutMs: number;
};

export type AdapterJobResult = JobResult & {
  jobId: string;
  /** Un elemento por cada salida de `outputs`, en el mismo orden. Vacío si `status !== 'ok'`. */
  provenance: ArtifactProvenance[];
};

export type ProbeResult = {
  available: boolean;
  engineVersion?: string;
  diagnostics: { code: string; message: string }[];
};

export interface ConnectorAdapter {
  readonly simple: CardSimple;
  readonly advanced: CardAdvanced;
  probe(): Promise<ProbeResult>;
  run(job: JobRequest, ctx: JobContext): Promise<AdapterJobResult>;
}

const SHA256 = /^[0-9a-f]{64}$/;

/**
 * Comprueba en runtime que un resultado cumple el contrato de ADR-0011.
 * Los tests de cada adaptador lo usan como prueba de conformidad.
 * Devuelve la lista de incumplimientos (vacía = conforme).
 */
export function checkAdapterResult(result: AdapterJobResult, adapter: Pick<ConnectorAdapter, 'simple'>): string[] {
  const issues: string[] = [];
  if (!['ok', 'failed', 'cancelled'].includes(result.status)) issues.push(`status inválido: ${String(result.status)}`);
  if (!result.jobId) issues.push('falta jobId');
  if (result.status === 'ok') {
    if (result.outputs.length === 0) issues.push('status ok sin outputs');
    if (result.provenance.length !== result.outputs.length) issues.push('provenance no tiene un elemento por output');
    result.outputs.forEach((o, i) => {
      const p = result.provenance[i];
      if (!p) return;
      if (p.uri !== o.uri) issues.push(`provenance[${i}].uri no coincide con outputs[${i}].uri`);
      if (!SHA256.test(p.sha256)) issues.push(`provenance[${i}].sha256 no es un SHA-256 hex`);
      if (p.contentSha256 !== undefined && !SHA256.test(p.contentSha256)) issues.push(`provenance[${i}].contentSha256 no es un SHA-256 hex`);
      if (p.pluginId !== adapter.simple.id) issues.push(`provenance[${i}].pluginId distinto de la tarjeta`);
      if (!p.engineVersion) issues.push(`provenance[${i}].engineVersion vacío`);
      if (!adapter.simple.produces.includes(o.type)) issues.push(`outputs[${i}].type ${o.type} no figura en produces`);
    });
  } else {
    if (result.diagnostics.length === 0) issues.push(`status ${result.status} sin diagnostics`);
    if (result.provenance.length !== 0) issues.push('provenance debe estar vacío si status no es ok');
  }
  return issues;
}
