import { SCHEMA_VERSION } from './index.ts';
import { parseProject, type ParseProjectResult } from './schema.ts';

type VersionedProject = Record<string, unknown> & { schemaVersion: number };
type MigrationError = Extract<ParseProjectResult, { ok: false }>;
type MigrationResult = { ok: true; value: VersionedProject } | MigrationError;
type Migration = (project: Readonly<Record<string, unknown>>) => MigrationResult;

function failure(path: string, code: string, message: string): MigrationError {
  return { ok: false, errors: [{ path, code, message }] };
}

/** Ejemplo para el formato sintético v0, cuyo FPS era un entero positivo. */
function migrateV0ToV1(project: Readonly<Record<string, unknown>>): MigrationResult {
  const fps = project.fps;
  if (typeof fps !== 'number' || !Number.isSafeInteger(fps) || fps <= 0) {
    return failure('fps', 'invalid-migration-input', 'El FPS de la versión 0 debe ser un entero positivo seguro.');
  }
  return { ok: true, value: { ...project, schemaVersion: 1, fps: { num: fps, den: 1 } } };
}

/** v1 → v2 (ADR-0012): `Layer.text` es opcional, así que solo cambia la versión. */
function migrateV1ToV2(project: Readonly<Record<string, unknown>>): MigrationResult {
  return { ok: true, value: { ...project, schemaVersion: 2 } };
}

// Cada clave indica la versión de origen. Cada paso debe avanzar exactamente una versión.
const migrations: ReadonlyMap<number, Migration> = new Map([
  [0, migrateV0ToV1],
  [1, migrateV1ToV2],
]);

function hasSchemaVersion(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) &&
    Object.hasOwn(value, 'schemaVersion');
}

/** Migra un valor JSON a la versión actual y valida el resultado con el esquema de proyecto. */
export function migrateToCurrent(raw: unknown): ParseProjectResult {
  if (!hasSchemaVersion(raw)) return parseProject(raw);

  const sourceVersion = raw.schemaVersion;
  if (typeof sourceVersion !== 'number' || !Number.isSafeInteger(sourceVersion) || sourceVersion < 0) {
    return failure('schemaVersion', 'unknown-schema-version', 'schemaVersion debe ser un entero seguro no negativo.');
  }

  let project = raw;
  let version = sourceVersion;
  while (version < SCHEMA_VERSION) {
    const migration = migrations.get(version);
    if (!migration) return parseProject(project);

    let result: MigrationResult;
    try {
      result = migration(project);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al migrar el proyecto.';
      return failure('$', 'migration-failed', `Falló la migración de v${version} a v${version + 1}. ${message}`);
    }
    if (!result.ok) return result;
    if (result.value.schemaVersion !== version + 1) {
      return failure('schemaVersion', 'invalid-migration-version', `La migración de v${version} debe producir v${version + 1}.`);
    }

    project = result.value;
    version = result.value.schemaVersion;
  }

  return parseProject(project);
}
