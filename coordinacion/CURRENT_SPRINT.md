# Tanda actual: Tanda 8

> Dueño: A0. _Actualizado el 2026-11-23 (integración 7)._ Criterios: 3/8 (#1, #2 y #6, este último ya en los dos motores). Fichas en [BACKLOG.md](BACKLOG.md#fichas-de-la-tanda-8-ready-desde-el-2026-11-23-integración-7).
> `develop`: `schemaVersion` **3** (artefactos en el proyecto); `npm test` 192 pass + 8 skip. Con motores reales (A0): Blender 7/7 y FreeCut 14/14.
> **Paso 0 obligatorio:** `coord.mjs usuario --presente` en cada mensaje del usuario (ADR-0014).

| Equipo | Tarea | Estado | Worktree / rama (nueva desde `develop`) |
|---|---|---|---|
| **Claude A1** | **FDN-042c Pipeline híbrido → criterio #3** | READY | su worktree · `fdn/FDN-042c-pipeline` |
| **Claude A2** | FDN-080b `preview.render` y `project.export` reales | READY | su worktree · `fdn/FDN-080b-preview-export` |
| **Antigravity** | FDN-074a Audio y sincronía en `edit.compose` | READY | `FME-wt\antigravity` · `fdn/FDN-074a-audio` |
| **Codex** | FDN-073a Pruebas de seguridad y regresión | READY | `FME-wt\codex` · `fdn/FDN-073a-seguridad-regresion` |
| **Claude A3** | — (en reposo) | — | — |

## Bloqueos conocidos
- FDN-005 (aprobación de la spec): solo el usuario.
- FDN-043 (criterio #3) espera a 042c. FDN-052/053 (criterios #4 y #5), 074 y 075 (criterios #7 y #8) esperan a 043.

## Siguiente al integrar
- 042c → 043 (criterio #3) → 052, 053, 073, 074 y 075 · 074a → 074 · 080b + 042c → `project.export` real.
