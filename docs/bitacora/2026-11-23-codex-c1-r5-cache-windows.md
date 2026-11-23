# 2026-11-23 · FDN-070b · Publicación de caché en Windows

- **Sesión:** `codex-c1-r5` (GPT-6.2 Sol).
- **Rama:** `fdn/FDN-070b-cache-windows`.

## Hecho

- En Windows, `DiskCache.set` reintenta `rename` y el `unlink` del temporal ante `EPERM`, `EBUSY` o `EACCES`. El backoff empieza en 10 ms, se limita a 250 ms por espera y tiene un presupuesto aproximado de 1 s por operación.
- Cada intento vuelve a verificar los directorios y los archivos pertinentes. El destino permanece disponible hasta el renombrado atómico. Si el temporal ya desapareció, se tolera solo el `ENOENT` de `unlink`.
- El error de agotamiento incluye `code: CACHE_RETRY_EXHAUSTED`, la operación, el número de intentos y el error nativo como causa. Los errores no reintentables se conservan. Si falla también el cierre o la limpieza, `AggregateError` conserva el fallo principal y el secundario.

## Verificado

El código anterior falló con `EPERM` en el primer intento del test concurrente reforzado. En Windows 11 con Node 24.21.0, el test usa 12 escritores y 96 lecturas del mismo destino. Verifica que cada lectura coincide con una versión completa y que al terminar queda únicamente la entrada publicada.

| Comando | Resultado con el cambio final |
|---|---|
| `npm run typecheck` | Correcto. |
| `node --test packages/cache/test/cache.test.ts` | 11/11. Las regresiones inducen los tres códigos transitorios y verifican el agotamiento y la conservación de errores. |
| `node --test --test-name-pattern 'publica una entrada completa' packages/cache/test/cache.test.ts` | 50 ejecuciones consecutivas correctas. |
| `npm test` | Cinco ejecuciones consecutivas. Cada una pasó 117 pruebas, con 0 fallos y 6 omisiones de integración por motor Revideo ausente. |
| `git diff --check` y `git diff --cached --check` | Correctos. |
| `codegraph sync` y `codegraph affected packages/cache/src/store.ts packages/cache/test/cache.test.ts` | Identificó `cache.test.ts` y el E2E de Revideo. |

GitNexus no tiene este worktree indexado. Graphify no fue necesario para el cambio local en el almacén. La primera serie de aceptación se interrumpió al limitar el manejo de `ENOENT` al syscall de limpieza. Se repitió la secuencia completa sobre el cambio final.

## Pendiente

- A0 revisa e integra la rama. El checkout de prueba carece del motor externo de Revideo y su suite lo reporta como motivo de omisión.
