# 2026-11-22 · FDN-030: Registro dinámico de conectores y ADR-0009

- **Autor:** Antigravity B2 · **Sesión:** `antigravity-b2` · **Rama/commit:** `fdn/FDN-030-registro` · **Fase:** 3 (FDN-030)

## Objetivo
Implementar el registro dinámico en memoria de conectores del contrato v0.1 en `@fme/connectors` (`register`, `unregister`, `listSimple`, `inspect`) con semántica estricta `yes`/`no`/`unknown`, pruebas unitarias y ADR-0009, sin modificar `packages/connectors/src/index.ts` ni añadir dependencias externas.

## Hecho
- [`packages/connectors/src/registry.ts`](../../packages/connectors/src/registry.ts):
  - Clase `ConnectorRegistry` y factoría `createConnectorRegistry()`.
  - Error estructurado `ConnectorRegistryError` con códigos tipados (`INVALID_CARD`, `INCOMPATIBLE_CONTRACT_VERSION`, `DUPLICATE_CONNECTOR`, `PLUGIN_ID_MISMATCH`, `CONNECTOR_NOT_FOUND`, `INVALID_INSPECT_SECTION`, `INVALID_FILTER`).
  - `register(simple, advanced?)`: validación de `contractVersion === '0.1'` (alineado en tipo con `typeof CONTRACT_VERSION` vía `import type` desde `./index.js`), validación de campos obligatorios, coherencia `advanced.pluginId === simple.id`, rechazo de duplicados y copias defensivas en almacenamiento.
  - `unregister(id)`: baja booleana por `id`.
  - `listSimple(filter?)`: filtrado por `capability`, `capabilities`, `accepts`, `produces`, `executor`, `technical` y `requiredTechnical`; exclusión ante incompatibilidad explícita (`'no'` vs `'yes'` o viceversa); marcado explícito con `requiresInspection: true`, `unknownRequirements` e `inspectionSections: ['technical']` cuando el valor es `'unknown'`, falta la clave o falta `CardAdvanced` (nunca tratando `'unknown'` como `'yes'`), sin exponer la tarjeta avanzada.
  - `inspect(id, sections[])`: devolución selectiva y deduplicada únicamente de las secciones solicitadas (`technical`, `limits`, `permissions`, `editability`, `licenseReview`) con copias defensivas; error `CONNECTOR_NOT_FOUND` si no existe el conector y `{ pluginId, hasAdvanced: false, sections: {} }` si no tiene tarjeta avanzada.
- [`packages/connectors/test/registry.test.ts`](../../packages/connectors/test/registry.test.ts): 9 pruebas en la suite `ConnectorRegistry (FDN-030)` cubriendo alta/baja, duplicados, `contractVersion` incompatible, `pluginId` inconsistente, filtros, semántica `yes`/`no`/`unknown` (con y sin `CardAdvanced`), `inspect` selectivo (`Object.keys`, vacías, duplicadas, sin `limits`, sin tarjeta avanzada, inexistente, sección inválida) y aislamiento frente a mutaciones externas.
- [`docs/decisiones/0009-api-registro-conectores.md`](../decisiones/0009-api-registro-conectores.md): ADR-0009 con estado `propuesta (2026-11-22)` justificando API, tipos, errores estructurados, semántica `unknown → requiere inspección`, `inspect` selectivo y compatibilidad con *type stripping* de Node 24.

## Verificado
| Comando | Resultado real |
|---|---|
| `npm.cmd run typecheck` | OK (`tsc -b && tsc -p tsconfig.test.json`, código 0) |
| `npm.cmd test` | OK (`tests 16`, `suites 1`, `pass 16`, `fail 0`; 9 tests nuevos de `ConnectorRegistry (FDN-030)` + 7 existentes en verde) |
| `codegraph.cmd status` | OK (`Files: 7`, `Nodes: 146`, `Edges: 242` inicial; índice al día) |
| `codegraph.cmd context "CardSimple CardAdvanced"` / `explore "CardSimple"` | OK (consultados antes de editar) |
| `codegraph.cmd sync` | OK (`Synced 2 changed files`, `Added: 2 - 66 nodes in 1.4s`) |
| `codegraph.cmd affected packages/connectors/src/registry.ts packages/connectors/test/registry.test.ts` | OK (`Affected test files (1): packages/connectors/test/registry.test.ts`) |
| `graphify update .` | OK (`Rebuilt: 559 nodes, 694 edges, 43 communities`) |
| `git status --short` / `git diff --stat` | Solo los 4 archivos autorizados; `packages/connectors/src/index.ts` sin cambios |

## Decisiones tomadas
- ADR-0009 (propuesta): diseño de `ConnectorRegistry`, `createConnectorRegistry()`, `ConnectorRegistryError`, `ConnectorFilter`, `ConnectorDiscoveryEntry` e `InspectResult`, además de `import type` + `EXPECTED_CONTRACT_VERSION: typeof CONTRACT_VERSION = '0.1'` para compatibilidad simultánea entre `tsc -b` (`NodeNext`) y `node --test` (*type stripping* directo sobre `src/`).

## Pendiente / próxima acción
- Revisión del commit en `fdn/FDN-030-registro` por B0 antes de emitir evento `REVIEW` a `claude-code-a0`.
- Al integrar en `develop` (A0): valorar re-exportar `registry.js` desde `packages/connectors/src/index.ts` (fuera del alcance de FDN-030).
- Conectar FDN-050 (núcleo del router) sobre `listSimple` e `inspect`.

## Memoria actualizada
- Sin modificaciones en `.forgex/memory.jsonl` (reservado al integrador / fuera de rutas autorizadas).
