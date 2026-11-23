# Tanda actual: Tanda 3

> Dueño: A0. _Actualizado el 2026-11-23 (integración 2)._ Fichas en [BACKLOG.md](BACKLOG.md#fichas-de-la-tanda-3-ready-desde-el-2026-11-23-integración-2).
> `develop` ≥ `b290224`: `npm run typecheck` OK y `npm test` 71/71. Integradas en esta ronda: FDN-013, 015, 016, 023, 024, 030, 031 y 060, más ADR-0011 (interfaz de adaptadores).

| Equipo | Tarea | Estado | Worktree / rama (nueva, desde `develop`) | Rutas autorizadas |
|---|---|---|---|---|
| **Antigravity** | FDN-012 Verificar FreeCut | **BLOCKED** (usuario) | `FME-wt\antigravity` · `fdn/FDN-012-freecut` | `examples/fase1/freecut/**` |
| **Antigravity** | FDN-050 Núcleo del router | READY | `FME-wt\antigravity-2` · `fdn/FDN-050-router` | `packages/router/**` |
| **Codex** | FDN-040 Adaptador Blender | READY | `FME-wt\codex` · `fdn/FDN-040-adapter-blender` | `packages/adapters/blender/**`, `runtime/engines/blender/**` |
| **Codex** | FDN-070 Caché por dependencias | READY | `FME-wt\codex-2` · `fdn/FDN-070-cache` | `packages/cache/**` |
| **Claude A1** | FDN-032 Adaptador Revideo | READY | su worktree · `fdn/FDN-032-adapter-revideo` | `packages/adapters/revideo/**`, `runtime/engines/revideo/**` |
| **Claude A2** | FDN-026 `deserialize` con migraciones | READY | su worktree · `fdn/FDN-026-deserialize-migra` | `packages/project/src/serialize.ts`, su test |
| **Claude A3** | — (sin tarea adecuada; en reposo) | — | — | — |
| **A0** | Integración, FDN-025 (tras 026), FDN-082 licencias | continuo | `FME` · `develop` | archivos compartidos |

## Bloqueos conocidos
- **FDN-012:** espera la confirmación del usuario para clonar FreeCut (commit `5ceeeb3`, MIT) e instalar sus dependencias (~380–700 MB). Bloquea FDN-014 (cierre de la F1) y FDN-041.
- FDN-005 (aprobación de la spec): solo la cierra el usuario.
- Las descargas siguen necesitando la confirmación explícita del usuario.

## Siguiente al integrar
- 026 → 025 (cierre de la F2) · 032 + 040 → 061 (con 060 ya hecho) · 050 → 051 y 080 · 012 → 014 y 041 · 032 + 040 + 041 → 042.
