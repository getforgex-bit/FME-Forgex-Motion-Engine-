# Bitácora · FDN-074b — Reintento transitorio de FreeCut ante `ATOMIC_REPLACE_UNAVAILABLE`

- **Fecha:** 2026-11-23
- **Sesión:** `antigravity-b1` (`b1-freecut`)
- **Worktree / Rama:** `C:\Users\bogex\Documents\Forgex\FME-wt\antigravity` · `fdn/FDN-074b-freecut-retry` (desde `develop` `2b936d9`)
- **Estado:** **VERIFICADO** (listo para revisión de B0; sin evento `REVIEW` ni liberación todavía)

## 1. Cambios realizados (sin forkear ni modificar `FME-ext\freecut`)

- **`packages/adapters/freecut/src/adapter.ts`:**
  - Añadidas opciones en `FreeCutAdapterOptions`: `maxTransientRetries?: number` (defecto `3`, hasta 4 intentos totales), `retryBackoffMs?: number` (defecto `250`, backoff exponencial `retryBackoffMs * 2^(intento-1)`) y `sleep?: (ms: number) => Promise<void>`.
  - Exportado `isTransientAtomicReplaceFailure(code, errText)`: detecta `code === 'ATOMIC_REPLACE_UNAVAILABLE'`, subcadena `'ATOMIC_REPLACE_UNAVAILABLE'` o mensajes Windows de bloqueo en `assertAtomicReplace` (`EPERM`/`EBUSY`/`EACCES` junto a `.freecut-headless` o `.atomic-test`, en cualquier orden).
  - Bucle de reintentos en `FreeCutAdapter.run(job, ctx)`:
    - Intento 1 usa `${ctx.jobId}.engine` y `${ctx.jobId}.tmp` (100% compatible con tests previos).
    - Reintentos `2..N` crean `${ctx.jobId}.engine-retry-${attempt - 1}` y `${ctx.jobId}.tmp-retry-${attempt - 1}` limpios dentro de `ctx.workDir` y eliminan cualquier `outPath` parcial antes de relanzar.
    - Respeta el presupuesto `ctx.timeoutMs` (`remainingMs = ctx.timeoutMs - (Date.now() - startedAt.getTime())`): ajusta el timeout de `runIsolated` al tiempo restante y cancela reintentos si no hay margen para `backoffMs`.
    - Conserva historial de intentos fallidos en `diagnostics` (`code: 'ATOMIC_REPLACE_UNAVAILABLE'`) tanto si un reintento recupera el job (`status: 'ok'`) como si se agotan los reintentos (`status: 'failed'`).
- **`packages/adapters/freecut/test/retry.test.ts`:**
  - 4 tests unitarios con `cli.mjs` falso aislado (`workDir` propio, sin navegador):
    1. Falla 2 veces con `ATOMIC_REPLACE_UNAVAILABLE` y triunfa en el 3.er intento: 3 `--work-dir` distintos, 3 `TEMP` distintos, backoff `[25, 50]`, `status: 'ok'`, `checkAdapterResult === []`, `diagnostics.length === 2`.
    2. Falla 4 veces seguidas (agota 3 reintentos): backoff `[25, 50, 100]`, `status: 'failed'`, `checkAdapterResult === []`, `diagnostics.length === 4`.
    3. Error no transitorio (`render-failed`): 1 intento (`sleeps: []`), `status: 'failed'`, `checkAdapterResult === []`, `diagnostics.length === 1`.
    4. Error transitorio sin JSON (`EBUSY ... .freecut-headless\.atomic-test`) con backoff > `timeoutMs`: respeta presupuesto en 1 intento (`sleeps: []`), `status: 'failed'`, `checkAdapterResult === []`.
- **`packages/adapters/freecut/test/{adapter,compose,audio-sync}.integration.test.ts`:**
  - Ajustados los asserts de `diagnostics` en `status: 'ok'` para aceptar `[]` o diagnósticos de recuperación exclusivamente con `code === 'ATOMIC_REPLACE_UNAVAILABLE'`.

## 2. Verificación ejecutada

- `npx.cmd tsc -b packages/adapters/freecut` → exit `0`
- `npm.cmd run typecheck` (`tsc -b && tsc -p tsconfig.test.json`) → exit `0`
- `node --test packages/adapters/freecut/test/retry.test.ts` → exit `0` (`tests 4`, `pass 4`, `fail 0`, `skipped 0`, `14426.6005ms`)
- `node --test packages/adapters/freecut/test/*.test.ts` → exit `0` (`tests 24`, `pass 24`, `fail 0`, `skipped 0`, `35320.8745ms`)

### 6 corridas consecutivas de `npm.cmd test`

| Corrida | Exit | `tests` | `pass` | `fail` | `skipped` | `todo` | Duración (`duration_ms` / pared) | Fallos `ATOMIC_REPLACE_UNAVAILABLE` |
|---|---|---|---|---|---|---|---|---|
| 1/6 | `0` | 234 | 219 | 0 | 12 | 3 | `93450.7893 ms` (`94.75 s`) | `0` |
| 2/6 | `0` | 234 | 219 | 0 | 12 | 3 | `57297.8782 ms` (`57.98 s`) | `0` |
| 3/6 | `0` | 234 | 219 | 0 | 12 | 3 | `52928.1415 ms` (`53.49 s`) | `0` |
| 4/6 | `0` | 234 | 219 | 0 | 12 | 3 | `53586.5675 ms` (`54.13 s`) | `0` |
| 5/6 | `0` | 234 | 219 | 0 | 12 | 3 | `48184.6374 ms` (`48.80 s`) | `0` |
| 6/6 | `0` | 234 | 219 | 0 | 12 | 3 | `48977.0379 ms` (`49.57 s`) | `0` |

*(Los `12` skipped corresponden a pruebas del motor Revideo no instalado en este worktree; `0` fallos en las 6 corridas seguidas).*

## 3. Grafos (`CodeGraph` y `Graphify`)

- **CodeGraph:**
  - Pre-edición: `codegraph.cmd sync` (`17 changed files`, `Added: 8, Modified: 9 - 432 nodes in 7.4s`) + `codegraph.cmd context "FreeCutAdapter run"` + `codegraph.cmd impact FreeCutAdapter` (`44 affected symbols`).
  - Post-edición: `codegraph.cmd sync` (`5 changed files`, `Added: 1, Modified: 4 - 158 nodes in 1.7s`, `Resolved 0 pending references (6 unresolved)`) + `codegraph.cmd affected packages/adapters/freecut/src/adapter.ts packages/adapters/freecut/test/retry.test.ts` (`Affected test files (23)`).
- **Graphify:** `graphify update .` → `Rebuilt: 2300 nodes, 4401 edges, 166 communities`.
