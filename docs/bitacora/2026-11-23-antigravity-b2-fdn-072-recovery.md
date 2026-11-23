# 2026-11-23 · FDN-072: Recuperación ante VRAM, reintento seguro y backend alternativo (`@fme/recovery`)

- **Autor:** Antigravity B2 · **Sesión:** `antigravity-b2` · **Rama/commit:** `fdn/FDN-072-recovery` · **Fase:** 7 (FDN-072)

## Objetivo
Implementar el módulo de recuperación determinista `@fme/recovery` en `packages/recovery/` para clasificar fallos de ejecución, gestionar falta de VRAM (distinguiendo `'preview'` frente a `'final'`), aplicar reintentos seguros en directorios aislados, conmutar a los `fallbacks` del `RoutePlan` previa comprobación con `probe()`, y evitar contaminar el `JobRequest` o la caché ante errores.

## Hecho
- [`packages/recovery/package.json`](../../packages/recovery/package.json) y [`packages/recovery/tsconfig.json`](../../packages/recovery/tsconfig.json): workspace `@fme/recovery` con dependencias `"@fme/connectors": "0.0.0"`, `"@fme/router": "0.0.0"`, referencias a `../connectors` y `../router`, y `"rewriteRelativeImportExtensions": true`.
- [`packages/recovery/src/types.ts`](../../packages/recovery/src/types.ts): tipos para categorías de fallo (`ExecutionFailureCategory`), `ErrorClassification`, `AttemptMitigation`, `ExecutionAttempt`, `RecoveryDecision`, `RecoveryOptions` (`purpose`, `vramLimitMB` por defecto `4096`, `allowSubdivision`, `probeFallbackBeforeRun`, `onCacheStore`), `RecoveryOkResult` y `RecoveryEscalatedResult`.
- [`packages/recovery/src/classify.ts`](../../packages/recovery/src/classify.ts): `classifyExecutionError` determinista sobre `AdapterJobResult` o excepciones (`out-of-vram`, `out-of-ram`, `timeout`, `transient`, `invalid-input`, `engine-unavailable`, `cancelled`, `engine-crash`, `unknown`).
- [`packages/recovery/src/policy.ts`](../../packages/recovery/src/policy.ts): `decideRecoveryAction`, `parseFrameRangeSpec` y `splitFrameRange`. En `'preview'`, reduce `previewScale`/`samples` de forma acotada ante `out-of-vram`; en `'final'`, **nunca** degrada resolución ni muestras y solo admite subdivisión sin pérdida por `frameRange`/`durationFrames` (si `allowSubdivision: true`), backend alternativo o escalado explícito al usuario.
- [`packages/recovery/src/executor.ts`](../../packages/recovery/src/executor.ts): `executeWithRecovery` sobre `RoutePlan` y `ConnectorAdapter`, ejecutando cada intento con `jobId`/`workDir` aislados, verificando `probe()` antes de usar cada `fallback`, unificando salidas/procedencia en subdivisión por segmentos y llamando a `onCacheStore` únicamente si `finalResult.status === 'ok'`.
- [`packages/recovery/src/index.ts`](../../packages/recovery/src/index.ts): re-exportaciones públicas.
- [`packages/recovery/test/recovery.test.ts`](../../packages/recovery/test/recovery.test.ts): 7 pruebas en la suite `@fme/recovery (FDN-072)` con adaptadores conformes a `checkAdapterResult` y `planRoute` real de `@fme/router`.

## Verificado
| Comando | Resultado real |
|---|---|
| `npx.cmd tsc -b packages/recovery` | OK (exit `0`) |
| `npm.cmd run typecheck` | OK (`tsc -b && tsc -p tsconfig.test.json`, exit `0`) |
| `npm.cmd test` | OK (`tests 127`, `suites 5`, `pass 121`, `fail 0`, `skipped 6` [integración `revideo` sin motor local], `duration_ms 4462.1277`; `7/7` en `@fme/recovery (FDN-072)`) |
| `codegraph.cmd sync` | OK (`Synced 30 changed files` previo / `Synced 6 changed files` posterior, `+6 - 149 nodes in 1.8s`, `Resolved 1,751 pending references`) |
| `codegraph.cmd context "planRoute FallbackStrategy ConnectorAdapter AdapterJobResult"` | OK (consulta previa a editar) |
| `codegraph.cmd affected packages/recovery/src/index.ts packages/recovery/src/executor.ts packages/recovery/test/recovery.test.ts` | OK (`Affected test files (1): packages/recovery/test/recovery.test.ts`) |
| `graphify update .` | OK (`Rebuilt: 1469 nodes, 2491 edges, 120 communities`) |
| `git status --short` | Solo `packages/recovery/**` y esta bitácora (sin tocar `package.json` ni `tsconfig.json` raíz) |

## Decisiones tomadas
- Uso exclusivo de `import type` desde `@fme/connectors` y `@fme/router` en `packages/recovery/src/*.ts` para compatibilidad con `tsc -b` y *type stripping* de Node 24.
- `purpose` por defecto `'final'` y `allowSubdivision` por defecto `false` para impedir degradaciones silenciosas de calidad salvo habilitación explícita.

## Pendiente / próxima acción
- Revisión del commit en `fdn/FDN-072-recovery` por B0 antes de enviar `REVIEW` a `claude-code-a0`.
- Al integrar en `develop` (A0): añadir `{ "path": "./packages/recovery" }` en `references` de `tsconfig.json` raíz (no tocado en esta rama).

## Memoria actualizada
- Sin modificaciones en `.forgex/memory.jsonl` (reservado al integrador).
