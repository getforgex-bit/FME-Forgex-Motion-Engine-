# 2026-11-23 · FDN-050: Núcleo del enrutador de 8 pasos (`@fme/router`)

- **Autor:** Antigravity B2 · **Sesión:** `antigravity-b2` · **Rama/commit:** `fdn/FDN-050-router` · **Fase:** 5 (FDN-050)

## Objetivo
Implementar el núcleo del enrutador inteligente (`@fme/router`) en `packages/router/` siguiendo la secuencia de 8 pasos y los 3 modos (`auto`, `manual`, `hybrid`) de `docs/arquitectura.md` (§3), con inspección selectiva bajo demanda sobre `ConnectorRegistry`, métricas base para FDN-051 y pruebas unitarias sobre las tarjetas reales de Revideo y Blender.

## Hecho
- [`packages/router/package.json`](../../packages/router/package.json) y [`packages/router/tsconfig.json`](../../packages/router/tsconfig.json): paquete `@fme/router` con dependencia `"@fme/connectors": "0.0.0"`, referencia de proyecto a `../connectors` y `"rewriteRelativeImportExtensions": true`.
- [`packages/router/src/types.ts`](../../packages/router/src/types.ts): tipos `RouterRegistry`, `RouteMode`, `ROUTE_STEP_NAMES`, `RouteTask`, `RouteOptions`, `RoutePolicy`, `LimitRequirement`, `RejectionRecord`, `CandidateScoreBreakdown`, `RouteStepTrace`, `RouteMetrics`, `FallbackStrategy`, `RoutePlan` y `WorkflowRoutePlan`.
- [`packages/router/src/router.ts`](../../packages/router/src/router.ts):
  - `planRoute(registry, task, options?)`: ejecuta los 8 pasos (`translate-requirements` → `discover-simple` → `filter-hard-simple` → `inspect-advanced` → `check-policy-availability` → `score-and-select` → `execution-plan` → `fallback-strategy`).
  - Descubrimiento en dos fases: lee todas las tarjetas simples (`metrics.simpleCardsRead`), descarta por capacidades/formatos/ejecutor/exclusiones en `filter-hard-simple`, e invoca `inspect(id, sectionsNeeded)` **únicamente** en finalistas y **únicamente** con las secciones exigidas por la tarea (`technical`, `limits`, `permissions`, `editability`, `licenseReview`).
  - Semántica estricta: `'unknown'`, clave ausente o `hasAdvanced === false` se rechazan como restricción dura (`UNVERIFIED_TECHNICAL_REQUIREMENT`, etc.) y nunca se tratan como compatibles.
  - Restricciones duras de permisos (`deniedPermissions`, `allowedPermissions`), licencia (`blocked`, `requireApprovedLicense`), editabilidad, límites y disponibilidad sin compensación por puntuación.
  - `planWorkflow(registry, tasks, options?)`: soporta flujos multi-tarea en modo híbrido con pasos fijados mediante `pinnedByOperation`.
- [`packages/router/src/index.ts`](../../packages/router/src/index.ts): re-exportaciones públicas de `types.ts` y `router.ts`.
- [`packages/router/test/router.test.ts`](../../packages/router/test/router.test.ts): 7 pruebas en la suite `@fme/router (FDN-050)` usando las tarjetas reales de `examples/fase1/revideo/` y `examples/fase1/blender/` más tarjeta simulada de editor, cubriendo los 8 criterios de aceptación (incluyendo spy de `inspect(id, ['technical'])` exclusivo y conteos `simpleCardsRead` / `advancedSectionsRequested`).

## Verificado
| Comando | Resultado real |
|---|---|
| `npx.cmd tsc -b packages/router` | OK (exit `0`) |
| `npm.cmd run typecheck` | OK (`tsc -b && tsc -p tsconfig.test.json`, exit `0`) |
| `npm.cmd test` | OK (`tests 78`, `suites 3`, `pass 78`, `fail 0`, `duration_ms 4393.6914`; `7/7` en `@fme/router (FDN-050)` + 71 existentes) |
| `codegraph.cmd sync` | OK (`Synced 4 changed files`, `Added: 4 - 149 nodes in 2.5s`, `Resolved 993 pending references`) |
| `codegraph.cmd context "ConnectorRegistry CardSimple CardAdvanced"` | OK (consulta previa a editar) |
| `codegraph.cmd affected packages/router/src/index.ts packages/router/src/router.ts packages/router/test/router.test.ts` | OK (`Affected test files (1): packages/router/test/router.test.ts`) |
| `graphify update .` | OK (`Rebuilt: 1077 nodes, 1710 edges, 93 communities`) |
| `git status --short` | Solo `packages/router/**` y esta bitácora (sin tocar `package.json` ni `tsconfig.json` raíz) |

## Decisiones tomadas
- Uso de `import type` desde `@fme/connectors` en `packages/router/src/*.ts` para compatibilidad simultánea con `tsc -b` y ejecución directa de tests por *type stripping* de Node 24.
- Priorización en `buildErrorForRejection` del rechazo perteneciente al paso más avanzado alcanzado por un candidato (evitando que descartes tempranos de conectores ajenos enmascaren el fallo específico de licencia/disponibilidad de un finalista).

## Pendiente / próxima acción
- Revisión del commit en `fdn/FDN-050-router` por B0 antes de emitir evento `REVIEW` a `claude-code-a0`.
- Al integrar en `develop` (A0): añadir `{ "path": "./packages/router" }` en `references` de `tsconfig.json` raíz (no modificado en esta rama por estar reservado al integrador).
- Base lista para FDN-051 (medición de tokens: tarjeta simple frente a avanzada).

## Memoria actualizada
- Sin modificaciones en `.forgex/memory.jsonl` (reservado al integrador).
