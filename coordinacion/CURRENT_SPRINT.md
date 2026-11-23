# Tanda actual: Tanda 4 (solapada con la Tanda 3)

> Dueño: A0. _Actualizado el 2026-11-23 (integración 3)._ **Fase 2 cerrada (criterio #2 ☑).** Fichas en [BACKLOG.md](BACKLOG.md#fichas-de-la-tanda-4-ready-desde-el-2026-11-23-integración-3).
> `develop` ≥ `78d6f76`: `npm run typecheck` OK y `npm test` 92 pass + 4 skip (integración de Revideo sin motor en este checkout). Job real de Revideo verificado por A0: 6/6.

| Equipo | Tarea | Estado | Worktree / rama (nueva desde `develop`) | Rutas |
|---|---|---|---|---|
| **Antigravity** | FDN-012 Verificar FreeCut | IN_PROGRESS (descarga autorizada) | `FME-wt\antigravity` | `examples/fase1/freecut/**` |
| **Antigravity** | FDN-050 Núcleo del router | IN_PROGRESS | `FME-wt\antigravity-2` | `packages/router/**` |
| **Codex** | FDN-040 Adaptador Blender | IN_PROGRESS (avance: 5/5 con Blender real) | `FME-wt\codex` | `packages/adapters/blender/**`, `runtime/engines/blender/**` |
| **Codex** | FDN-071 Segmentos y preview | READY | `FME-wt\codex-2` · `fdn/FDN-071-render-plan` | `packages/render-plan/**` |
| **Claude A1** | FDN-033 E2E de la Fase 3, después FDN-034 temporales | READY | su worktree | ver fichas |
| **Claude A2** | FDN-028 Contenido de las capas de texto (contrato, ADR-0012) | READY | su worktree | ver ficha |
| **Claude A3** | — (en reposo) | — | — | — |
| **A0** | Integración; cierre de la F3 con FDN-033; FDN-082 | continuo | `FME` · `develop` | compartidos |

## Bloqueos conocidos
- FDN-005 (aprobación de la spec): solo el usuario.
- FDN-014 (cierre de la F1) y FDN-041 esperan a FDN-012.
- FDN-061 espera a FDN-040. FDN-051 y FDN-080 esperan a FDN-050.

## Siguiente al integrar
- 033 → cierre de la F3 · 040 → 061 · 050 → 051 y 080 · 012 → 014 y 041 · 028 → 032b · 071 → 072.
