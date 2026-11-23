# Tanda actual: Tanda 5

> Dueño: A0. _Actualizado el 2026-11-23 (integración 4)._ **Fases 1, 2 y 3 cerradas; criterios 2/8.** Fichas en [BACKLOG.md](BACKLOG.md#fichas-de-la-tanda-5-ready-desde-el-2026-11-23-integración-4).
> `develop`: `npm test` 108 pass + 6 skip. `schemaVersion` **2**. Regla nueva: los adaptadores leen proyectos con `deserialize` o `migrateToCurrent`.
> Fallo intermitente conocido: EPERM de `DiskCache` en Windows (~1 de 5 en `npm test`), en corrección con FDN-070b.

| Equipo | Tarea | Estado | Worktree / rama | Rutas |
|---|---|---|---|---|
| **Antigravity** | FDN-041 Adaptador FreeCut (nivel A) | READY | `FME-wt\antigravity` · `fdn/FDN-041-adapter-freecut` | `packages/adapters/freecut/**`, `runtime/engines/freecut/**` |
| **Antigravity** | (segundo trabajador libre: FDN-072, si Neon lo ve útil) | READY (libre) | `FME-wt\antigravity-2` | ficha resumida de FDN-072 |
| **Codex** | FDN-040 devuelta (schemaVersion 2) y FDN-070b (EPERM) | READY | `FME-wt\codex`: su rama de 040; después `fdn/FDN-070b-cache-windows` | ver fichas |
| **Codex** | FDN-071 Segmentos y preview | IN_PROGRESS | `FME-wt\codex-2` | `packages/render-plan/**` |
| **Claude A1** | FDN-032b (`layer.text`) y FDN-034b (tests en paralelo) | READY | su worktree | `packages/adapters/revideo/**` |
| **Claude A2** | FDN-080 Servidor MCP mínimo | READY (requiere confirmar una descarga) | su worktree | `apps/mcp/**` |
| **Claude A3** | FDN-051 Medición de tokens del router | READY | su worktree | `packages/router/test/tokens.test.ts` |
| **A0** | Integración; FDN-082 | continuo | `FME` · `develop` | compartidos |

## Bloqueos conocidos
- FDN-005 (aprobación de la spec): solo el usuario.
- FDN-042 (rutas A/B/C) espera a 040 y 041. FDN-061 espera a 040. FDN-052 espera a 043.

## Siguiente al integrar
- 040 → 061 · 040 + 041 → 042 → 043 (criterio #3) · 051 + 052 → 053 (criterios #4 y #5) · 080 → 081.
