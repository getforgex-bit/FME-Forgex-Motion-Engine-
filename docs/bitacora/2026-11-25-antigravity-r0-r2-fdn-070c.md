# 2026-11-25 · FDN-070c · Intermitente de enlace de directorio y sustitución de raíz en Windows

- **Sesión:** `antigravity-r0-r2` (equipo `antigravity-relevo`)
- **Relevo de:** `codex` (continuación tras integración parcial `3f00c9d` / `a73aeed` en `develop`)
- **Rama:** `fdn/FDN-070c-cache-concurrencia-relevo-antigravity-relevo`
- **Worktree:** `C:\Users\bogex\Documents\Forgex\FME-wt\antigravity-relevo-070c`
- **Base integrada:** `develop` (`b9416b0`, merge limpio `9a828cd`)

## Diagnóstico (causa raíz verificada en Windows NTFS)

En la integración 11 (`3f00c9d`), el test de concurrencia (`'publica una entrada completa con escrituras concurrentes'`) quedó resuelto, pero A0 observó 1 fallo de 6 ejecuciones de `npm test` en `'rechaza un enlace de directorio, una entrada enlazada y una raíz sustituida'` (`packages/cache/test/cache.test.ts`).

1. **Auditoría de `packages/cache/src/store.ts` (descartado fallo de `DiskCache`):**
   - Durante las 10 aserciones de ese test, `DiskCache` solo ejecuta `lstatSync` y `realpathSync.native` (`inspectDirectory`, `verifyDirectory` y `checkEntry`) y rechaza antes de abrir o escribir temporales.
   - Verificado en Windows con un archivo bloqueado de forma exclusiva (`FileShare.None`): `lstatSync(dir).isDirectory() === true`, `realpathSync.native(dir)` OK, `lstatSync(file).isFile() === true` y `nlink === 1`. Las operaciones `rename`/`unlink` de `DiskCache.set` ya cuentan con `retryFileOperation` y `withEntryAccess`.
   - También se verificaron 200 sustituciones consecutivas `rename(nested, original)` + `mkdir(nested)` sobre NTFS con `{ bigint: true }`: `0/200` colisiones de `(dev, ino)` (al conservar `original` vivo, el registro MFT no se reutiliza).
2. **Causa raíz 1 — `rename(nested, join(root, 'original'))` sin reintentos en `packages/cache/test/cache.test.ts` (VERIFICADO):**
   - Justo antes del renombrado, el test crea `outsideFile` (`writeFile`) y el enlace duro `join(nested, filename)` (`link`) dentro de `%TEMP%` y lee `outsideFile`.
   - En Windows NTFS, renombrar un directorio (`MoveFileExW` / `FileRenameInformation`) falla inmediatamente con **`EPERM`** si cualquier proceso mantiene un descriptor abierto sobre cualquier archivo hijo dentro de `nested`, **incluso un lector con `FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE`** (como Windows Defender `MsMpEng.exe`/`WdFilter.sys` o el indexador escaneando archivos `.bin` recién creados bajo la carga de CPU/disco de `npm test`).
   - Reproducido de forma determinista abriendo `nested\<archivo>` en modo lectura (`fsp.open(nestedFile, 'r')`): `EPERM: operation not permitted, rename '...\allowed\cache' -> '...\allowed\original'`.
3. **Causa raíz 2 — `rm(root, { recursive: true, force: true })` con `maxRetries: 0` en `temporaryRoot` (VERIFICADO):**
   - `temporaryRoot` registraba `context.after(() => rm(root, { recursive: true, force: true }))` sin `maxRetries`/`retryDelay` sobre un árbol temporal con 2 junctions NTFS (`escape` y `cache/<key>.bin`), enlaces duros y subdirectorios.
   - Reproducido de forma determinista con retención transitoria de directorio en Windows: `rm(..., { recursive: true, force: true })` falló inmediatamente con `EBUSY: resource busy or locked, rmdir`, mientras que con `{ recursive: true, force: true, maxRetries: 10, retryDelay: 100 }` completó correctamente (mismo patrón ya usado en `tests/regresion/render.test.ts:35`).

## Hecho

- Cambio mínimo y aislado en `packages/cache/test/cache.test.ts` (sin modificar `packages/cache/src/store.ts` ni contratos):
  - `temporaryRoot`: añade `maxRetries: 10, retryDelay: 100` al `rm` de limpieza en `context.after`.
  - `renameDirectory`: helper específico de prueba que reintenta únicamente en `win32` los códigos transitorios `EPERM`/`EBUSY`/`EACCES` con retroceso exponencial acotado a `2_000 ms` (10 ms → 200 ms) para la sustitución del directorio `nested` → `original`.
- **Seguridad sin debilitar:** todas las aserciones de `DiskCache` permanecen intactas (rechazo de junction en `directory` y `allowedRoot` `/junction/`, rechazo de hardlink en entrada `/sin enlaces/` preservando `outsideFile`, rechazo de raíz sustituida `/cambió/` y rechazo de junction en entrada `/sin enlaces/`).

## Verificado

| Comando | Resultado real |
|---|---|
| `codegraph explore "DiskCache inspectDirectory verifyDirectory checkEntry withEntryAccess"` | 35 símbolos en 2 archivos (`verifyDirectory` 1 llamador, `checkEntry` 2 llamadores, `inspectDirectory` 2 llamadores, `withEntryAccess` 2 llamadores). |
| `codegraph sync` | Exit `0`: sincronizados 5 archivos (`Added: 2, Modified: 3`, 131 nodos en 2,0 s; 7 referencias resueltas). |
| `codegraph affected packages/cache/src/store.ts packages/cache/test/cache.test.ts` | 9 archivos de prueba afectados (`apps/mcp/test/fixture-server.ts`, `apps/mcp/test/ops.test.ts`, `packages/adapters/revideo/test/e2e.integration.test.ts`, `packages/cache/test/cache.test.ts`, `packages/pipeline/test/av-sync.integration.test.ts`, `packages/pipeline/test/hybrid.integration.test.ts`, `packages/pipeline/test/incremental.integration.test.ts`, `packages/render-plan/test/render-plan.test.ts`, `tests/seguridad/limits.test.ts`). |
| `npm.cmd run typecheck` | Exit `0` (`tsc -b && tsc -p tsconfig.test.json`). |
| `node --test packages/cache/test/cache.test.ts` | Exit `0`: `11/11` aprobados, `0` fallos, `0` omitidos, `0` TODO (`3149.7511 ms`; enlace/junction `34.8776 ms`, concurrencia `401.7628 ms`). |
| Estrés de 50 repeticiones (`--test-name-pattern "rechaza un enlace de directorio"`) | Exit `0`: **`50/50`** aprobados, `0` fallos (`16469 ms`). |
| `git diff --check` | Exit `0` (limpio). |

### 8 ejecuciones consecutivas de `npm.cmd test` (Node `v24.21.0`, Windows)

Suite sobre `develop` (`b9416b0`, merge `9a828cd`): **266 tests totales** (`248` aprobados, `0` fallos, `18` omitidos por ausencia de `runtime/engines/revideo/node_modules` en worktree, `0` TODO; Blender y FreeCut reales ejecutados).

| Corrida | Exit | Wall (s) | `duration_ms` | Pass / Fail / Skip / Todo | `'rechaza un enlace de directorio…'` | `'escrituras concurrentes'` |
|---:|---:|---:|---:|---|---|---|
| 1 | 0 | 52,02 | 51451,9611 | 248 / 0 / 18 / 0 | ✔ `112.1183ms` | ✔ `1172.5367ms` |
| 2 | 0 | 65,74 | 65024,1520 | 248 / 0 / 18 / 0 | ✔ `108.42ms` | ✔ `1157.0164ms` |
| 3 | 0 | 51,36 | 50787,1875 | 248 / 0 / 18 / 0 | ✔ `96.1978ms` | ✔ `1935.0525ms` |
| 4 | 0 | 60,98 | 60377,4279 | 248 / 0 / 18 / 0 | ✔ `136.3228ms` | ✔ `1377.2317ms` |
| 5 | 0 | 55,53 | 54780,8415 | 248 / 0 / 18 / 0 | ✔ `89.3462ms` | ✔ `1163.0348ms` |
| 6 | 0 | 51,78 | 51223,3057 | 248 / 0 / 18 / 0 | ✔ `100.3ms` | ✔ `1436.3313ms` |
| 7 | 0 | 52,01 | 51431,4753 | 248 / 0 / 18 / 0 | ✔ `73.7424ms` | ✔ `1037.1155ms` |
| 8 | 0 | 68,94 | 67902,4962 | 248 / 0 / 18 / 0 | ✔ `93.592ms` | ✔ `1867.8847ms` |

- **Resultado global:** **8/8 corridas consecutivas con `exit 0` y `0` fallos** (`248/248` tests activos aprobados en cada corrida).

## Pendiente

- Revisión independiente por `@verifier-2` y cierre/integración final de FDN-070c en `develop` por A0.
