# Tanda actual: Tanda 7 (Fase 4: integración real)

> Dueño: A0. _Actualizado el 2026-11-23 (integración 6)._ **Criterios: 3/8** (#1, #2 y #6). Fichas en [BACKLOG.md](BACKLOG.md#fichas-de-la-tanda-7-ready-desde-el-2026-11-23-integración-6-fase-4-integración-real).
> `develop` ≥ `1304753`: `npm test` 178 pass + 8 skip. Con los motores reales (A0): Revideo 9/9, CLI 9/9, FreeCut 7/7 y Blender 6/6.
> **Paso 0 obligatorio:** `coord.mjs usuario --presente` en cada mensaje del usuario (ADR-0014).

| Equipo | Tarea | Estado | Worktree / rama (nueva, desde `develop`) | Rutas |
|---|---|---|---|---|
| **Antigravity** | FDN-042a FreeCut compone pistas y overlays | READY | `FME-wt\antigravity` · `fdn/FDN-042a-compose` | `packages/adapters/freecut/**`, `runtime/engines/freecut/**` |
| **Codex** | FDN-061b Gradientes en Blender | READY | `FME-wt\codex` · `fdn/FDN-061b-blender-gradientes` | `packages/adapters/blender/**`, `runtime/engines/blender/**` |
| **Claude A2** | FDN-042b Artefactos en el proyecto (ADR-0015, v3) | READY | su worktree | ver ficha |
| **Claude A1** | FDN-042c Pipeline híbrido (cuando estén 042a y 042b) | BACKLOG | — | — |
| **Claude A3** | — (en reposo) | — | — | — |
| **A0** | Integración; cierre de la F6 (FDN-062) cuando esté 061b | continuo | `FME` · `develop` | compartidos |

## Bloqueos conocidos
- FDN-005 (aprobación de la spec): solo el usuario.
- FDN-042c espera a 042a y 042b. FDN-043 (criterio #3) espera a 042c. FDN-052, 073 y 074 esperan a 043.

## Siguiente al integrar
- 042a + 042b → 042c → 043 (criterio #3) → 052/053 (criterios #4 y #5) y 073/074/075 (criterios #7 y #8) · 061b → 062 (cierre de la F6).
