/**
 * @fme/connectors: contrato de conectores v0.1 (el "módem").
 *
 * Estado: PROPUESTO. Transcripción de la especificación v0.1, §8.3.
 * La implementación real añadirá validación en runtime, ids de job, progreso, logs,
 * cancelación, versiones de motor y políticas de acceso (Fase 3).
 *
 * Reglas (§8.5):
 * - El registro distingue 'yes' | 'no' | 'unknown'. Nunca se afirma compatibilidad por falta de datos.
 * - "Exportar" no equivale a "reabrir editable".
 * - Sustituir un plugin exige pruebas de regresión de la salida.
 */

export const CONTRACT_VERSION = '0.1' as const;

export type Support = 'yes' | 'no' | 'unknown';

export type Executor = 'cli' | 'api' | 'library' | 'mcp';

/** Tarjeta simple (obligatoria): se lee siempre, durante el descubrimiento y el filtrado. */
export type CardSimple = {
  id: string;
  name: string;
  version: string;
  contractVersion: typeof CONTRACT_VERSION;
  /** p. ej. 'animate.vector' */
  capabilities: string[];
  /** p. ej. 'application/json' o 'fme/scene+json' */
  accepts: string[];
  /** p. ej. 'video/mp4' */
  produces: string[];
  executor: Executor;
};

/** Tarjeta avanzada (bajo demanda): solo si un requisito no queda demostrado con la simple. */
export type CardAdvanced = {
  pluginId: string;
  /** p. ej. { alpha: 'yes', depth: 'unknown', keyframes: 'yes' } */
  technical: Record<string, Support>;
  limits?: Record<string, number | string>;
  permissions: string[];
  editability: 'native' | 'linked' | 'baked' | 'unknown';
  licenseReview: 'pending' | 'approved' | 'blocked';
};

export type JobRequest = {
  projectId: string;
  operation: string;
  inputs: { uri: string; type: string }[];
  requirements: Record<string, string | number | boolean>;
  seed?: number;
};

export type JobResult = {
  status: 'ok' | 'failed' | 'cancelled';
  outputs: { uri: string; type: string }[];
  diagnostics: { code: string; message: string }[];
};

// API pública del registro (re-exportaciones añadidas por A0 al integrar FDN-030; ADR-0009).
export { ADVANCED_SECTIONS, ConnectorRegistry, ConnectorRegistryError, createConnectorRegistry } from './registry.ts';
export type {
  AdvancedSection,
  ConnectorRegistryErrorCode,
  TechnicalExpectation,
  ConnectorFilter,
  ConnectorDiscoveryEntry,
  InspectSections,
  InspectResult,
} from './registry.ts';
