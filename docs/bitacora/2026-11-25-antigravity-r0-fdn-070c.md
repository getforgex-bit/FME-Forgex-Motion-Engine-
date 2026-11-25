# 2026-11-25 · FDN-070c · Relevo y verificación de concurrencia de caché en Windows

- **Sesión:** `antigravity-r0` (equipo `antigravity-relevo`)
- **Relevo de:** `codex` (`codex-c2-r9`, punta origen `a73aeed`)
- **Rama:** `fdn/FDN-070c-cache-concurrencia-relevo-antigravity-relevo`
- **Worktree:** `C:\Users\bogex\Documents\Forgex\FME-wt\antigravity-relevo-070c`
- **Base integrada:** `develop` (`abbb646`, merge limpio `f3fc4d2`)

## Hecho y auditoría de `a73aeed`

1. Se creó el worktree exclusivo desde `a73aeed` y se integró `develop` (`abbb646`) limpiamente sin conflictos (`f3fc4d2`).
2. Se instalaron dependencias de workspace en el worktree con `npm.cmd ci --offline` sin tocar `package.json` ni `package-lock.json` (`git status` limpio).
3. Se inicializó CodeGraph en el worktree y se consultó el impacto de `packages/cache/src/store.ts`:
   - `codegraph init`: 135 archivos, 2.854 nodos, 7.938 aristas.
   - `codegraph affected packages/cache/src/store.ts`: 9 archivos de prueba afectados (`apps/mcp/test/fixture-server.ts`, `apps/mcp/test/ops.test.ts`, `packages/adapters/revideo/test/e2e.integration.test.ts`, `packages/cache/test/cache.test.ts`, `packages/pipeline/test/av-sync.integration.test.ts`, `packages/pipeline/test/hybrid.integration.test.ts`, `packages/pipeline/test/incremental.integration.test.ts`, `packages/render-plan/test/render-plan.test.ts`, `tests/seguridad/limits.test.ts`).
   - `codegraph explore "DiskCache withEntryAccess"`: 57 símbolos en 4 archivos (`withEntryAccess` con 2 llamadores internos en `store.ts`; `DiskCache` con 5 llamadores en `packages/cache/src/index.ts` y `packages/pipeline/src/stepcache.ts`).
4. **Auditoría técnica de `packages/cache/src/store.ts` y `packages/cache/test/cache.test.ts` (VERIFICADO):**
   - **Cola FIFO en Windows (`pendingWindowsEntries` + `withEntryAccess`):** serializa `#readEntry` y la fase `rename` de `set` por ruta canónica dentro del proceso (no-op en POSIX). Libera el turno en `finally` tras `await file.close()` y elimina la entrada del `Map` cuando es la cola vigente (sin fugas ni bloqueos ante errores).
   - **Sensibilidad a mayúsculas/minúsculas en Windows:** `inspectDirectory()` normaliza `allowedRoot` y `directory` con `realpathSync.native()`, y `#entryPath()` restringe `key` a SHA-256 hexadecimal en minúsculas (`[0-9a-f]{64}`). Comprobado en Node `v24.21.0` sobre Windows: `realpathSync.native(p.toLowerCase()) === realpathSync.native(p.toUpperCase())` devolvió `true`. Además, en prueba de estrés con dos instancias (`root.toLowerCase()` frente a `root.toUpperCase()`), 120 escrituras escalonadas y 320 lecturas concurrentes de 64 KB completaron en `3333.2 ms` con 0 fallos y 1 archivo final.
   - **Escritura en paralelo y limpieza de temporales:** la escritura y `sync()` de `.cache-<uuid>.tmp` siguen ejecutándose en paralelo fuera de `withEntryAccess`; si fallan la publicación o la escritura, se reintenta `unlink` con `retryFileOperation` y se preserva la causa original (o `AggregateError`). En prueba de estrés rápida (24 escritores × 25 escrituras = 600 escrituras y 24 lectores × 25 lecturas = 600 lecturas de 64 B), completó en `5892.0 ms` con 0 fallos y 1 archivo final.
   - **Presupuesto de reintentos y procesos externos:** `withEntryAccess` envuelve `retryFileOperation('rename', ...)`, de modo que la espera local no consume el presupuesto de `1_000 ms` reservado para bloqueos externos (`EPERM`/`EBUSY`/`EACCES`). `#readEntry` revalida los directorios al obtener turno (`if (windows) this.#verifyDirectories()`).
   - **Conclusión:** el fix heredado de `a73aeed` es sólido, mínimo y sin debilidades reproducibles; se mantiene intacto.

## Verificado

| Comando | Resultado real |
|---|---|
| `npm.cmd run typecheck` | Exit `0` (`tsc -b && tsc -p tsconfig.test.json`). |
| `node --test packages/cache/test/cache.test.ts` | Exit `0`: `11/11` aprobados, `0` fallos, `0` omitidos, `0` TODO (`2928.7585 ms`; `'publica una entrada completa con escrituras concurrentes'` en `386.1132 ms`). |
| `git diff --check` | Exit `0` (limpio). |

### 8 ejecuciones consecutivas de `npm.cmd test` (Node `v24.21.0`, Windows)

Suite sobre `develop` (`abbb646`): **252 tests totales** (`0` TODO; `18` omitidos porque `runtime/engines/revideo/node_modules` no está instalado en el worktree ni en el checkout principal; Blender y FreeCut reales ejecutados).

| Corrida | Exit | Wall (s) | `duration_ms` | Pass / Fail / Skip / Todo | `'publica una entrada completa con escrituras concurrentes'` | Observaciones |
|---:|---:|---:|---:|---|---|---|
| 1 | 0 | 71,53 | 70845,39 | 234 / 0 / 18 / 0 | ✔ `1537.7234ms` | Suite limpia |
| 2 | 0 | 58,30 | 57705,26 | 234 / 0 / 18 / 0 | ✔ `1864.1421ms` | Suite limpia |
| 3 | 0 | 83,31 | 82688,24 | 234 / 0 / 18 / 0 | ✔ `1014.6423ms` | Suite limpia |
| 4 | 0 | 76,52 | 75888,86 | 234 / 0 / 18 / 0 | ✔ `1298.2148ms` | Suite limpia |
| 5 | 0 | 75,47 | 74012,26 | 234 / 0 / 18 / 0 | ✔ `2146.0827ms` | Suite limpia |
| 6 | 1 | 142,67 | 137880,41 | 233 / 1 / 18 / 0 | ✔ `4212.3924ms` | `BLENDER_TIMEOUT` en `gradients.integration.test.ts` (solape de GPU/CPU con `npm test` paralelo de `FDN-063b`) |
| 7 | 0 | 133,01 | 126669,99 | 234 / 0 / 18 / 0 | ✔ `1510.3756ms` | Suite limpia |
| 8 | 1 | 184,04 | 179743,64 | 233 / 1 / 18 / 0 | ✔ `1898.7674ms` | `BLENDER_TIMEOUT` en `adapter.test.ts` (solape de GPU/CPU con `npm test` paralelo de `FDN-063b`) |

- **Resultado de caché:** **8/8 corridas consecutivas aprobadas sin ningún fallo** en `'publica una entrada completa con escrituras concurrentes'` (`1014.6 ms` – `4212.4 ms`), incluso bajo saturación doble de CPU/GPU en las corridas 6–8.
- **Sin regresiones en caché ni en la suite:** las corridas 1–5 y 7 finalizaron `234/234` con `0` fallos; los dos únicos fallos en las corridas 6 y 8 fueron `BLENDER_TIMEOUT` de motor externo por contención simultánea de otro `npm test` del relevo ejecutándose a la vez en la misma máquina.

## Pendiente

- Revisión independiente por `@verifier` y envío a `REVIEW` / integración en `develop` por A0.
