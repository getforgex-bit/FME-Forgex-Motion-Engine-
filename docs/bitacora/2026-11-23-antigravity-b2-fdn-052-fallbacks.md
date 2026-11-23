# 2026-11-23 · FDN-052: Criterios #4/#5 y fallbacks con adaptadores reales (`@fme/router` + `@fme/recovery`)

- **Autor:** Antigravity B2 · **Sesión:** `antigravity-b2` · **Rama/commit:** `fdn/FDN-052-fallbacks-reales` · **Fase:** 5 (FDN-052)

## Objetivo
Demostrar los criterios de aceptación #4 y #5 sobre las tarjetas reales de los tres adaptadores (`revideo`, `adapter.blender`, `adapter.freecut`) y validar fallbacks reales extremo a extremo en `@fme/recovery` usando instancias reales de `FreeCutAdapter` y `BlenderAdapter` sin modificar los adaptadores.

## Hecho
- [`packages/recovery/src/types.ts`](../../packages/recovery/src/types.ts) y [`packages/recovery/src/classify.ts`](../../packages/recovery/src/classify.ts):
  - Añadida categoría `unsupported-capability` (`fallbackEligible: true`, `retryable: false`) para `unsupported-alpha`, `unsupported-layer`, `unsupported-scene` y `unsupported-fps`.
  - Refinada clasificación de `ATOMIC_REPLACE_UNAVAILABLE` (`transient`, reintentable y con fallback elegible) y `browser-missing` / `blender-missing` / `ffprobe_no_disponible` (`engine-unavailable`).
- [`packages/recovery/.gitignore`](../../packages/recovery/.gitignore): ignora `.test-work/`.
- [`packages/router/test/real-adapters.test.ts`](../../packages/router/test/real-adapters.test.ts): pruebas de criterios #4 y #5 registrando las tarjetas reales de `packages/adapters/{revideo,blender,freecut}` con espía sobre `inspect`.
- [`packages/recovery/test/real-fallbacks.integration.test.ts`](../../packages/recovery/test/real-fallbacks.integration.test.ts):
  - Fallback real a `FreeCutAdapter` cuando el primario falla por `engine-missing` (MP4 1280×720, 30 FPS, 30 frames verificado con `probeMedia` y `checkAdapterResult === []`).
  - Fallback real a `BlenderAdapter` (5.2) tras criterio #5 (`alpha: 'yes'`, `advancedSectionsRequested: 2` solo `['technical']`, `checkAdapterResult === []`).
  - Escalado limpio sin alternativa y verificación de clasificación de `ATOMIC_REPLACE_UNAVAILABLE` y `unsupported-alpha`.

## Métricas reales criterios #4 y #5 (tarjetas reales de los 3 adaptadores)
| Escenario | Criterio | Seleccionado | `simpleCardsRead` | `advancedInspections` | `advancedSectionsRequested` | Secciones inspeccionadas |
|---|---|---|---|---|---|---|
| Título / animación vectorial (`animate.vector`, `video/mp4`) | #4 | `revideo` | 3 | 0 | 0 | `—` |
| Composición multipista (`edit.compose`, `video/mp4`) | #4 | `adapter.freecut` | 3 | 0 | 0 | `—` |
| Animación 3D (`animate.3d`, `image/png`) | #4 | `adapter.blender` | 3 | 0 | 0 | `—` |
| Render vídeo con alpha (`render.video`, `alpha: 'yes'`) | #5 | `revideo` | 3 | 2 | 2 | `revideo:[technical]`, `adapter.freecut:[technical]` |
| Escena 3D con alpha (`animate.3d`, `alpha: 'yes'`) | #5 | `adapter.blender` | 3 | 1 | 1 | `adapter.blender:[technical]` |
| Render vídeo híbrido con fallback (`render.video`, `video/mp4`) | #4 + fallback | `revideo` (fallback `adapter.freecut`) | 3 | 0 | 0 | `—` |

## Verificado
| Comando | Resultado real |
|---|---|
| `npx.cmd tsc -b packages/router packages/recovery` | OK (exit `0`) |
| `npm.cmd run typecheck` | OK (`tsc -b && tsc -p tsconfig.test.json`, exit `0`) |
| `node --test packages/router/test/*.test.ts packages/recovery/test/*.test.ts` | OK (`tests 25`, `suites 5`, `pass 25`, `fail 0`, `skipped 0`, `duration_ms 46957.8877`; fallbacks reales FreeCut `25029.8ms` y Blender `20592.0ms` sin skip) |
| `npm.cmd test` | OK (`tests 235`, `suites 7`, `pass 220`, `fail 0`, `skipped 12` [Revideo sin motor instalado en `runtime/engines/revideo`], `todo 3`, `duration_ms 80060.5178`) |
| `codegraph.cmd sync` | OK (`Synced 69 changed files` previo / `Synced 4 changed files` posterior, `+2 / ~2`, `126 nodes in 7.5s`) |
| `codegraph.cmd context "planRoute executeWithRecovery classifyExecutionError"` | OK (consulta previa a editar) |
| `codegraph.cmd affected ...` | OK (`3` archivos de test afectados: `real-fallbacks.integration.test.ts`, `recovery.test.ts`, `real-adapters.test.ts`) |
| `graphify update .` | OK (`Rebuilt: 2304 nodes, 4429 edges, 181 communities`) |
| `git status --short` | Solo `packages/router/**`, `packages/recovery/**` y esta bitácora |

## Pendiente / próxima acción
- Revisión del commit en `fdn/FDN-052-fallbacks-reales` por B0 antes de emitir evento `REVIEW` a `claude-code-a0`.
- Con la evidencia anterior, A0 podrá marcar ☑ los criterios #4 y #5 en `docs/pruebas-aceptacion.md` al integrar.

## Memoria actualizada
- Sin modificaciones en `.forgex/memory.jsonl` (reservado al integrador).
