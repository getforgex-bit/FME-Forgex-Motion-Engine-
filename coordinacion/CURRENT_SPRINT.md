# Tanda actual: Tanda 6

> Dueño: A0. _Actualizado el 2026-11-23 (integración 5)._ Criterios: 2/8. Fichas en [BACKLOG.md](BACKLOG.md#fichas-de-la-tanda-6-ready-desde-el-2026-11-23-integración-5).
> `develop` ≥ `cd92a71`: `npm test` 131 pass + 6 skip. A0, con los motores reales: Revideo 8/8 en paralelo ×3 y Blender 6/6.

| Equipo | Tarea | Estado | Worktree / rama | Rutas |
|---|---|---|---|---|
| **Antigravity** | FDN-041 Adaptador FreeCut | READY o IN_PROGRESS (sin evento todavía) | `FME-wt\antigravity` | `packages/adapters/freecut/**`, `runtime/engines/freecut/**` |
| **Codex** | **Sin cuota** desde ~07:00 UTC. FDN-071 a medias (C1 hecho; falta la segmentación de C2); FDN-070b sin empezar | — | `FME-wt\codex-2` · `fdn/FDN-071-render-plan` | — |
| **Claude A1** | FDN-061 Gradientes → backend (criterio #6) | READY | su worktree · `fdn/FDN-061-gradientes` | ver ficha |
| **Claude A2** | FDN-081 CLI | READY | su worktree · `fdn/FDN-081-cli` | `apps/cli/**` |
| **Claude A3** | — (en reposo) | — | — | — |
| **A0** | Integración; FDN-090 (relevo), si el usuario lo confirma | — | `FME` · `develop` | compartidos |

## Bloqueos conocidos
- **Codex sin cuota:** FDN-070b (EPERM de DiskCache) y FDN-071 esperan. El relevo por otro equipo necesita la decisión del usuario (FDN-090).
- FDN-042 (rutas A/B/C → criterio #3) espera a FDN-041.
- FDN-005 (aprobación de la spec): solo el usuario.

## Siguiente al integrar
- 041 → 042 → 043 (criterio #3) · 061 → 062 (criterio #6) · 043 → 052 → 053 (criterios #4 y #5) · 071 → 072.
