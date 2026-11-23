# Tanda actual: Tanda 9 (hacia la prueba híbrida completa)

> Dueño: A0. _Actualizado el 2026-11-23 (integración 8)._ **Fase 4 cerrada. Criterios 4/8** (#1, #2, #3 y #6). Fichas en [BACKLOG.md](BACKLOG.md#fichas-de-la-tanda-9-ready-desde-el-2026-11-23-integración-8-hacia-la-prueba-híbrida-completa).
> `develop`: `npm test` 215 pass + 12 skip + 3 TODO. Fallo intermitente conocido: `ATOMIC_REPLACE_UNAVAILABLE` de FreeCut (~1 de cada 6) → FDN-074b.
> **Paso 0 obligatorio:** `coord.mjs usuario --presente` en cada mensaje del usuario (ADR-0014).

| Equipo | Tarea | Criterio | Worktree / rama (nueva desde `develop`) |
|---|---|---|---|
| **Claude A1** | FDN-075a Cambio parcial sin rehacer todo | **#8** | su worktree · `fdn/FDN-075a-incremental` |
| **Claude A2** | FDN-080c `project.export` real | (#7) | su worktree · `fdn/FDN-080c-export` |
| **Antigravity** | FDN-074b reintento de FreeCut y FDN-052 fallbacks reales | **#4, #5** | `FME-wt\antigravity` y `FME-wt\antigravity-2` |
| **Codex** | FDN-073b Endurecimiento de rutas | (seguridad) | `FME-wt\codex` · `fdn/FDN-073b-endurecimiento` |
| **Claude A3** | — (en reposo) | — | — |

## Bloqueos conocidos
- FDN-005 (aprobación de la spec): solo el usuario.
- FDN-063 (técnicas `2.5d`, `3d-with-2d` y guiado 3D) sin asignar: entra cuando haya un equipo libre.

## Siguiente al integrar
- 052 → 053 (criterios #4 y #5) · 075a → criterio #8 · 080c + 074a → criterio #7 (exportación con audio y sincronía medida sobre la híbrida) → FDN-075 (prueba híbrida completa).
