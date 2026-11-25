# 2026-11-23 · FDN-024 Migraciones de proyecto

- **Sesión** `codex-c2-r2` · **Rama** `fdn/FDN-024-migraciones`

## Hecho

- Implementé `migrateToCurrent` con un registro interno por versión de origen. Cada paso debe avanzar exactamente una versión y el resultado se valida con `parseProject`.
- El ejemplo v0 sintético convierte el FPS entero positivo en una tasa racional con denominador 1. La prueba compara el documento completo, incluidos activos, secuencias, capas, canales y referencias externas.
- Las versiones desconocidas y las entradas inválidas devuelven errores estructurados con ruta, código y mensaje.

## Verificado

| Comando | Resultado |
|---|---|
| `npm install --offline --ignore-scripts --no-package-lock --no-audit --no-fund` | Restauró Zod 4.6.7 desde la caché en el worktree. |
| `npm run typecheck` | OK después de corregir la inferencia de la versión en el bucle. |
| `npm test` | 34/34, incluidas cuatro pruebas de migraciones. |
| Importación de `dist/migrate.js` con Node | La fixture se migra a v1 con FPS 25/1. |
| `codegraph sync` y `codegraph affected packages/project/src/migrate.ts packages/project/test/migrate.test.ts` | Índice sincronizado y prueba `migrate.test.ts` detectada. |

## Pendiente

- Revisión e integración de A0. El enlace con la deserialización pública queda como seguimiento fuera de las rutas de esta tarea.
