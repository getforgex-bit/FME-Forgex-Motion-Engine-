import type {
  CONTRACT_VERSION,
  CardAdvanced,
  CardSimple,
  Executor,
  Support,
} from './index.js';

// Valor alineado por tipo con CONTRACT_VERSION ('0.1'): evita import de valor './index.js'
// que fallaría bajo Node type stripping al ejecutarse los tests directamente sobre src/.
const EXPECTED_CONTRACT_VERSION: typeof CONTRACT_VERSION = '0.1';

/** Secciones consultables bajo demanda en la tarjeta avanzada. */
export const ADVANCED_SECTIONS = [
  'technical',
  'limits',
  'permissions',
  'editability',
  'licenseReview',
] as const;

export type AdvancedSection = (typeof ADVANCED_SECTIONS)[number];

/** Códigos de error estructurados del registro de conectores. */
export type ConnectorRegistryErrorCode =
  | 'INVALID_CARD'
  | 'INCOMPATIBLE_CONTRACT_VERSION'
  | 'DUPLICATE_CONNECTOR'
  | 'PLUGIN_ID_MISMATCH'
  | 'CONNECTOR_NOT_FOUND'
  | 'INVALID_INSPECT_SECTION'
  | 'INVALID_FILTER';

/** Error tipado emitido por las operaciones del registro de conectores. */
export class ConnectorRegistryError extends Error {
  readonly code: ConnectorRegistryErrorCode;
  readonly connectorId?: string;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ConnectorRegistryErrorCode,
    message: string,
    options?: {
      connectorId?: string;
      details?: Record<string, unknown>;
    },
  ) {
    super(message);
    this.name = 'ConnectorRegistryError';
    this.code = code;
    if (options?.connectorId !== undefined) {
      this.connectorId = options.connectorId;
    }
    if (options?.details !== undefined) {
      this.details = options.details;
    }
  }
}

/** Valor permitido al expresar un requisito técnico en un filtro de descubrimiento. */
export type TechnicalExpectation = Exclude<Support, 'unknown'>;

/** Criterios de descubrimiento y filtrado sobre tarjetas simples y requisitos técnicos. */
export type ConnectorFilter = {
  capability?: string;
  capabilities?: readonly string[];
  accepts?: string | readonly string[];
  produces?: string | readonly string[];
  executor?: Executor | readonly Executor[];
  technical?: Readonly<Record<string, TechnicalExpectation>>;
  requiredTechnical?: readonly string[];
};

/** Resultado de descubrimiento sin exponer el contenido de la tarjeta avanzada. */
export type ConnectorDiscoveryEntry = {
  card: CardSimple;
  requiresInspection: boolean;
  unknownRequirements: string[];
  inspectionSections: AdvancedSection[];
};

/** Subconjunto de secciones devuelto por `inspect`. */
export type InspectSections = Partial<Pick<CardAdvanced, AdvancedSection>>;

/** Respuesta estructurada de inspección selectiva de tarjeta avanzada. */
export type InspectResult = {
  pluginId: string;
  hasAdvanced: boolean;
  sections: InspectSections;
};

type RegistryEntry = {
  simple: CardSimple;
  advanced?: CardAdvanced;
};

const VALID_EXECUTORS: ReadonlySet<string> = new Set<Executor>([
  'cli',
  'api',
  'library',
  'mcp',
]);

const VALID_SUPPORTS: ReadonlySet<string> = new Set<Support>([
  'yes',
  'no',
  'unknown',
]);

const VALID_EDITABILITIES: ReadonlySet<string> = new Set<
  CardAdvanced['editability']
>(['native', 'linked', 'baked', 'unknown']);

const VALID_LICENSE_REVIEWS: ReadonlySet<string> = new Set<
  CardAdvanced['licenseReview']
>(['pending', 'approved', 'blocked']);

const VALID_ADVANCED_SECTIONS: ReadonlySet<string> = new Set<AdvancedSection>(
  ADVANCED_SECTIONS,
);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmptyStringArray(
  value: unknown,
  fieldName: string,
  connectorId?: string,
): asserts value is string[] {
  if (!Array.isArray(value) || !value.every(isNonEmptyString)) {
    throw new ConnectorRegistryError(
      'INVALID_CARD',
      `El campo "${fieldName}" debe ser un array de cadenas no vacías.`,
      connectorId !== undefined ? { connectorId } : undefined,
    );
  }
}

function cloneCardSimple(card: CardSimple): CardSimple {
  return {
    id: card.id,
    name: card.name,
    version: card.version,
    contractVersion: card.contractVersion,
    capabilities: [...card.capabilities],
    accepts: [...card.accepts],
    produces: [...card.produces],
    executor: card.executor,
  };
}

function cloneCardAdvanced(card: CardAdvanced): CardAdvanced {
  const cloned: CardAdvanced = {
    pluginId: card.pluginId,
    technical: { ...card.technical },
    permissions: [...card.permissions],
    editability: card.editability,
    licenseReview: card.licenseReview,
  };
  if (card.limits !== undefined) {
    cloned.limits = { ...card.limits };
  }
  return cloned;
}

function validateCardSimple(simple: CardSimple): void {
  if (!isPlainRecord(simple)) {
    throw new ConnectorRegistryError(
      'INVALID_CARD',
      'La tarjeta simple debe ser un objeto.',
    );
  }

  const candidateId = isNonEmptyString(simple.id) ? simple.id : undefined;

  if (simple.contractVersion !== EXPECTED_CONTRACT_VERSION) {
    throw new ConnectorRegistryError(
      'INCOMPATIBLE_CONTRACT_VERSION',
      `Versión de contrato incompatible: "${String(simple.contractVersion)}". Se esperaba "${EXPECTED_CONTRACT_VERSION}".`,
      {
        ...(candidateId !== undefined ? { connectorId: candidateId } : {}),
        details: {
          expected: EXPECTED_CONTRACT_VERSION,
          received: simple.contractVersion,
        },
      },
    );
  }

  if (!isNonEmptyString(simple.id)) {
    throw new ConnectorRegistryError(
      'INVALID_CARD',
      'El campo "id" de la tarjeta simple debe ser una cadena no vacía.',
    );
  }

  if (!isNonEmptyString(simple.name)) {
    throw new ConnectorRegistryError(
      'INVALID_CARD',
      'El campo "name" de la tarjeta simple debe ser una cadena no vacía.',
      { connectorId: simple.id },
    );
  }

  if (!isNonEmptyString(simple.version)) {
    throw new ConnectorRegistryError(
      'INVALID_CARD',
      'El campo "version" de la tarjeta simple debe ser una cadena no vacía.',
      { connectorId: simple.id },
    );
  }

  assertNonEmptyStringArray(simple.capabilities, 'capabilities', simple.id);
  assertNonEmptyStringArray(simple.accepts, 'accepts', simple.id);
  assertNonEmptyStringArray(simple.produces, 'produces', simple.id);

  if (!VALID_EXECUTORS.has(simple.executor)) {
    throw new ConnectorRegistryError(
      'INVALID_CARD',
      `Ejecutor no válido: "${String(simple.executor)}".`,
      { connectorId: simple.id },
    );
  }
}

function validateCardAdvanced(
  advanced: CardAdvanced,
  expectedPluginId: string,
): void {
  if (!isPlainRecord(advanced)) {
    throw new ConnectorRegistryError(
      'INVALID_CARD',
      'La tarjeta avanzada debe ser un objeto.',
      { connectorId: expectedPluginId },
    );
  }

  if (advanced.pluginId !== expectedPluginId) {
    throw new ConnectorRegistryError(
      'PLUGIN_ID_MISMATCH',
      `El pluginId "${String(advanced.pluginId)}" de la tarjeta avanzada no coincide con "${expectedPluginId}".`,
      {
        connectorId: expectedPluginId,
        details: {
          expectedPluginId,
          receivedPluginId: advanced.pluginId,
        },
      },
    );
  }

  if (!isPlainRecord(advanced.technical)) {
    throw new ConnectorRegistryError(
      'INVALID_CARD',
      'El campo "technical" de la tarjeta avanzada debe ser un objeto.',
      { connectorId: expectedPluginId },
    );
  }

  for (const [key, support] of Object.entries(advanced.technical)) {
    if (!isNonEmptyString(key) || !VALID_SUPPORTS.has(support)) {
      throw new ConnectorRegistryError(
        'INVALID_CARD',
        `Valor de soporte técnico no válido para "${key}": "${String(support)}".`,
        { connectorId: expectedPluginId },
      );
    }
  }

  if (advanced.limits !== undefined) {
    if (!isPlainRecord(advanced.limits)) {
      throw new ConnectorRegistryError(
        'INVALID_CARD',
        'El campo "limits" de la tarjeta avanzada debe ser un objeto.',
        { connectorId: expectedPluginId },
      );
    }
    for (const [key, limitValue] of Object.entries(advanced.limits)) {
      const isValidNumber =
        typeof limitValue === 'number' && Number.isFinite(limitValue);
      const isValidString = typeof limitValue === 'string';
      if (!isNonEmptyString(key) || (!isValidNumber && !isValidString)) {
        throw new ConnectorRegistryError(
          'INVALID_CARD',
          `Valor de límite no válido para "${key}".`,
          { connectorId: expectedPluginId },
        );
      }
    }
  }

  assertNonEmptyStringArray(
    advanced.permissions,
    'permissions',
    expectedPluginId,
  );

  if (!VALID_EDITABILITIES.has(advanced.editability)) {
    throw new ConnectorRegistryError(
      'INVALID_CARD',
      `Valor de editability no válido: "${String(advanced.editability)}".`,
      { connectorId: expectedPluginId },
    );
  }

  if (!VALID_LICENSE_REVIEWS.has(advanced.licenseReview)) {
    throw new ConnectorRegistryError(
      'INVALID_CARD',
      `Valor de licenseReview no válido: "${String(advanced.licenseReview)}".`,
      { connectorId: expectedPluginId },
    );
  }
}

function toStringList(value: string | readonly string[] | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  return typeof value === 'string' ? [value] : [...value];
}

function includesAll(haystack: readonly string[], needles: readonly string[]): boolean {
  return needles.every((needle) => haystack.includes(needle));
}

function collectTechnicalExpectations(
  filter: ConnectorFilter,
): Array<[string, TechnicalExpectation]> {
  const expectations = new Map<string, TechnicalExpectation>();

  if (filter.requiredTechnical !== undefined) {
    for (const key of filter.requiredTechnical) {
      if (!isNonEmptyString(key)) {
        throw new ConnectorRegistryError(
          'INVALID_FILTER',
          'Los requisitos en "requiredTechnical" deben ser cadenas no vacías.',
        );
      }
      expectations.set(key, 'yes');
    }
  }

  if (filter.technical !== undefined) {
    for (const [key, expected] of Object.entries(filter.technical)) {
      if (!isNonEmptyString(key)) {
        throw new ConnectorRegistryError(
          'INVALID_FILTER',
          'Las claves en "technical" deben ser cadenas no vacías.',
        );
      }
      if (expected !== 'yes' && expected !== 'no') {
        throw new ConnectorRegistryError(
          'INVALID_FILTER',
          `El filtro técnico para "${key}" debe ser "yes" o "no", se recibió "${String(expected)}".`,
        );
      }
      const existing = expectations.get(key);
      if (existing !== undefined && existing !== expected) {
        throw new ConnectorRegistryError(
          'INVALID_FILTER',
          `Conflicto en filtro técnico para "${key}": requerido simultáneamente como "${existing}" y "${expected}".`,
        );
      }
      expectations.set(key, expected);
    }
  }

  return [...expectations.entries()];
}

function matchesSimpleCriteria(
  card: CardSimple,
  filter: ConnectorFilter,
): boolean {
  if (
    filter.capability !== undefined &&
    !card.capabilities.includes(filter.capability)
  ) {
    return false;
  }

  if (
    filter.capabilities !== undefined &&
    !includesAll(card.capabilities, filter.capabilities)
  ) {
    return false;
  }

  const requiredAccepts = toStringList(filter.accepts);
  if (requiredAccepts.length > 0 && !includesAll(card.accepts, requiredAccepts)) {
    return false;
  }

  const requiredProduces = toStringList(filter.produces);
  if (
    requiredProduces.length > 0 &&
    !includesAll(card.produces, requiredProduces)
  ) {
    return false;
  }

  if (filter.executor !== undefined) {
    if (typeof filter.executor === 'string') {
      if (card.executor !== filter.executor) {
        return false;
      }
    } else if (!filter.executor.includes(card.executor)) {
      return false;
    }
  }

  return true;
}

function evaluateTechnicalRequirements(
  entry: RegistryEntry,
  expectations: readonly (readonly [string, TechnicalExpectation])[],
): {
  excluded: boolean;
  unknownRequirements: string[];
} {
  if (expectations.length === 0) {
    return { excluded: false, unknownRequirements: [] };
  }

  const unknownRequirements: string[] = [];

  for (const [key, expected] of expectations) {
    const actual: Support = entry.advanced?.technical[key] ?? 'unknown';
    if (actual === 'unknown') {
      unknownRequirements.push(key);
      continue;
    }
    if (actual !== expected) {
      return { excluded: true, unknownRequirements: [] };
    }
  }

  return { excluded: false, unknownRequirements };
}

/**
 * Registro dinámico en memoria de conectores del contrato v0.1.
 *
 * Separa el descubrimiento por tarjeta simple (`listSimple`) de la consulta
 * selectiva de tarjeta avanzada (`inspect`), evitando asumir compatibilidad
 * cuando un requisito técnico figura como `'unknown'` o no está documentado.
 */
export class ConnectorRegistry {
  readonly #entries = new Map<string, RegistryEntry>();

  get size(): number {
    return this.#entries.size;
  }

  has(id: string): boolean {
    return this.#entries.has(id);
  }

  register(simple: CardSimple, advanced?: CardAdvanced): void {
    validateCardSimple(simple);

    if (this.#entries.has(simple.id)) {
      throw new ConnectorRegistryError(
        'DUPLICATE_CONNECTOR',
        `Ya existe un conector registrado con id "${simple.id}".`,
        { connectorId: simple.id },
      );
    }

    const stored: RegistryEntry = {
      simple: cloneCardSimple(simple),
    };

    if (advanced !== undefined) {
      validateCardAdvanced(advanced, simple.id);
      stored.advanced = cloneCardAdvanced(advanced);
    }

    this.#entries.set(simple.id, stored);
  }

  unregister(id: string): boolean {
    return this.#entries.delete(id);
  }

  listSimple(filter: ConnectorFilter = {}): ConnectorDiscoveryEntry[] {
    const technicalExpectations = collectTechnicalExpectations(filter);
    const results: ConnectorDiscoveryEntry[] = [];

    for (const entry of this.#entries.values()) {
      if (!matchesSimpleCriteria(entry.simple, filter)) {
        continue;
      }

      const evaluation = evaluateTechnicalRequirements(
        entry,
        technicalExpectations,
      );
      if (evaluation.excluded) {
        continue;
      }

      const requiresInspection = evaluation.unknownRequirements.length > 0;
      results.push({
        card: cloneCardSimple(entry.simple),
        requiresInspection,
        unknownRequirements: evaluation.unknownRequirements,
        inspectionSections: requiresInspection ? ['technical'] : [],
      });
    }

    return results;
  }

  inspect(id: string, sections: readonly AdvancedSection[]): InspectResult {
    const entry = this.#entries.get(id);
    if (entry === undefined) {
      throw new ConnectorRegistryError(
        'CONNECTOR_NOT_FOUND',
        `No existe ningún conector registrado con id "${id}".`,
        { connectorId: id },
      );
    }

    const uniqueSections: AdvancedSection[] = [];
    const seen = new Set<AdvancedSection>();
    for (const section of sections) {
      if (!VALID_ADVANCED_SECTIONS.has(section)) {
        throw new ConnectorRegistryError(
          'INVALID_INSPECT_SECTION',
          `Sección de tarjeta avanzada no válida: "${String(section)}".`,
          { connectorId: id, details: { section } },
        );
      }
      if (!seen.has(section)) {
        seen.add(section);
        uniqueSections.push(section);
      }
    }

    if (entry.advanced === undefined) {
      return {
        pluginId: id,
        hasAdvanced: false,
        sections: {},
      };
    }

    const selected: InspectSections = {};
    for (const section of uniqueSections) {
      switch (section) {
        case 'technical':
          selected.technical = { ...entry.advanced.technical };
          break;
        case 'limits':
          if (entry.advanced.limits !== undefined) {
            selected.limits = { ...entry.advanced.limits };
          }
          break;
        case 'permissions':
          selected.permissions = [...entry.advanced.permissions];
          break;
        case 'editability':
          selected.editability = entry.advanced.editability;
          break;
        case 'licenseReview':
          selected.licenseReview = entry.advanced.licenseReview;
          break;
      }
    }

    return {
      pluginId: id,
      hasAdvanced: true,
      sections: selected,
    };
  }
}

/** Crea una nueva instancia aislada de `ConnectorRegistry`. */
export function createConnectorRegistry(): ConnectorRegistry {
  return new ConnectorRegistry();
}
