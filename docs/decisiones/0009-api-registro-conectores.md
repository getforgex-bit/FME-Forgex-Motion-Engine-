# ADR-0009: API del registro dinámico de conectores (`@fme/connectors`)

- **Estado:** propuesta (2026-11-22) · **Dueño:** B2 (`antigravity-b2`) · **Revisable:** al integrar FDN-050 (núcleo del router)

## Contexto

La especificación v0.1 (§8.3 y §8.5, reflejada en [contratos.md](../contratos.md#2-contrato-de-conectores-v01-08)) separa las capacidades de cada conector en dos tarjetas:

- `CardSimple`: obligatoria, leída siempre durante el descubrimiento y el filtrado preliminar.
- `CardAdvanced`: consultada bajo demanda, únicamente cuando un requisito no queda demostrado con la tarjeta simple.

Además, el contrato impone que el registro distinga `'yes' | 'no' | 'unknown'` y **nunca** asuma compatibilidad por falta de datos. Para preparar FDN-032/040/041 (adaptadores) y FDN-050 (router de 8 pasos) sin modificar los tipos base de [`packages/connectors/src/index.ts`](../../packages/connectors/src/index.ts) ni añadir dependencias externas, se requiere definir la API del registro dinámico en [`packages/connectors/src/registry.ts`](../../packages/connectors/src/registry.ts).

## Decisión

1. **Clase `ConnectorRegistry` + factoría `createConnectorRegistry()`:**
   - Se expone la clase `ConnectorRegistry` (estado encapsulado con `#entries: Map<string, RegistryEntry>`) y la función factoría `createConnectorRegistry()` para facilitar la inyección y el aislamiento en tests y sesiones de router.
2. **Validación estricta en `register(simple, advanced?)` y copias defensivas:**
   - Se verifica `simple.contractVersion === CONTRACT_VERSION` (`'0.1'`), rechazando versiones incompatibles con `ConnectorRegistryError` (`code: 'INCOMPATIBLE_CONTRACT_VERSION'`).
   - Se validan `id`, `name`, `version`, los arrays `capabilities`/`accepts`/`produces`, `executor`, los duplicados por `simple.id` (`'DUPLICATE_CONNECTOR'`) y, si se aporta tarjeta avanzada, la coherencia `advanced.pluginId === simple.id` (`'PLUGIN_ID_MISMATCH'`) y la validez de `technical`, `limits`, `permissions`, `editability` y `licenseReview`.
   - Tanto en almacenamiento como en lectura (`listSimple` e `inspect`) se devuelven copias defensivas para garantizar inmutabilidad frente a mutaciones externas.
3. **Baja con `unregister(id)`:**
   - Devuelve `boolean` indicando si el conector existía y fue eliminado.
4. **Descubrimiento con `listSimple(filter?)` y semántica `yes` / `no` / `unknown`:**
   - Filtros soportados en `ConnectorFilter`: `capability`, `capabilities` (semántica *AND*), `accepts` (`string | readonly string[]`, *AND*), `produces` (`string | readonly string[]`, *AND*), `executor` (`Executor | readonly Executor[]`, *OR* por ser atributo escalar), `technical?: Readonly<Record<string, 'yes' | 'no'>>` y el atajo `requiredTechnical?: readonly string[]` (equivalente a `'yes'`).
   - Un filtro que contradiga `requiredTechnical` y `technical` sobre la misma clave lanza `ConnectorRegistryError('INVALID_FILTER')`.
   - Para cada requisito técnico solicitado:
     - Si el conector declara el valor opuesto explícito (`'no'` frente a `'yes'`, o `'yes'` frente a `'no'`), queda **excluido** del resultado.
     - Si el conector declara `'unknown'`, omite la clave en `technical` o no tiene `CardAdvanced`, **no** se excluye ni se marca como confirmado: se incluye en `ConnectorDiscoveryEntry` con `requiresInspection: true`, la lista de `unknownRequirements: string[]` y `inspectionSections: ['technical']`.
   - `ConnectorDiscoveryEntry` expone únicamente `{ card: CardSimple, requiresInspection, unknownRequirements, inspectionSections }`, preservando limpia la fase de descubrimiento sin filtrar secciones avanzadas.
5. **Inspección selectiva con `inspect(id, sections[])`:**
   - Acepta un subconjunto de `ADVANCED_SECTIONS` (`'technical' | 'limits' | 'permissions' | 'editability' | 'licenseReview'`), deduplica manteniendo el orden y valida nombres desconocidos (`'INVALID_INSPECT_SECTION'`).
   - Si `id` no está registrado, lanza `ConnectorRegistryError('CONNECTOR_NOT_FOUND')` (error claro de descubrimiento/referencia para el router).
   - Si `id` existe pero no tiene `CardAdvanced`, devuelve de forma segura `{ pluginId: id, hasAdvanced: false, sections: {} }`.
   - Si tiene `CardAdvanced`, rellena exclusivamente las claves solicitadas (omitiendo `limits` si es `undefined` en la tarjeta para cumplir `exactOptionalPropertyTypes`).
6. **Errores estructurados (`ConnectorRegistryError`):**
   - Extiende `Error` con `code: ConnectorRegistryErrorCode` (`INVALID_CARD`, `INCOMPATIBLE_CONTRACT_VERSION`, `DUPLICATE_CONNECTOR`, `PLUGIN_ID_MISMATCH`, `CONNECTOR_NOT_FOUND`, `INVALID_INSPECT_SECTION`, `INVALID_FILTER`), `connectorId?` y `details?`.

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| Singleton global único | Acopla tests y distintos flujos de router; una clase con factoría permite instancias aisladas y también instanciar un singleton en la capa de aplicación si se desea |
| Devolver `undefined` en `inspect(id)` cuando `id` no existe | Mezcla "conector inexistente" con "conector sin tarjeta avanzada"; lanzar `CONNECTOR_NOT_FOUND` distingue ambos fallos y devuelve `{ hasAdvanced: false, sections: {} }` cuando el conector sí existe |
| Excluir conectores con `'unknown'` en `listSimple` | Rompe el principio de §8.5: descartaría conectores potencialmente válidos antes de inspeccionar bajo demanda su tarjeta avanzada |
| Devolver la `CardAdvanced` completa en `inspect(id)` | Aumenta el consumo innecesario de contexto para los agentes (el router solo necesita las secciones pendientes de verificar) |
| Validar con Zod en `@fme/connectors` | Introduciría una dependencia nueva en este paquete cuando `CardSimple` y `CardAdvanced` pueden validarse sin dependencias en ~100 líneas; revisable si se unifica validación en Fase 3 |

## Consecuencias

- **Positivas:** cero dependencias nuevas; contrato tipado estricto compatible con `exactOptionalPropertyTypes` y `noUncheckedIndexedAccess`; FDN-050 puede distinguir candidatos confirmados de candidatos que requieren `inspect(id, entry.inspectionSections)` sin tocar `index.ts`. Al usar `import type` desde `./index.js` y alinear `EXPECTED_CONTRACT_VERSION: typeof CONTRACT_VERSION = '0.1'`, `src/registry.ts` es compatible tanto con `tsc -b` (`NodeNext`) como con la ejecución directa de tests por *type stripping* de Node 24 (`node --test`).
- **Negativas / costes:** las re-exportaciones desde `packages/connectors/src/index.ts` quedan pendientes de integración por A0; los filtros de `limits`, `permissions`, `editability` y `licenseReview` quedan fuera de `listSimple` y se resuelven tras `inspect` en el router. Si en el futuro cambia `CONTRACT_VERSION` en `index.ts`, `tsc` detectará de inmediato la discordancia de tipo en `EXPECTED_CONTRACT_VERSION`.
- **Seguimiento:** al implementar FDN-050 (router de 8 pasos), verificar que `ConnectorFilter` y `ConnectorDiscoveryEntry` cubren todas las consultas del paso de descubrimiento y actualizar el estado de este ADR a `aceptada`.

## Evidencia

- Implementación: [`packages/connectors/src/registry.ts`](../../packages/connectors/src/registry.ts).
- Tests unitarios (`node:test`): [`packages/connectors/test/registry.test.ts`](../../packages/connectors/test/registry.test.ts).
- Verificación ejecutada con `npm.cmd run typecheck`, `npm.cmd test`, `codegraph.cmd sync` y `codegraph.cmd affected` (detalles en la bitácora de la tarea).
