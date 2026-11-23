# Tanda actual: Tanda 2 (solapada con el final de la Tanda 1)

> Dueño: A0. _Actualizado el 2026-11-23._ Fichas completas en [BACKLOG.md](BACKLOG.md#fichas-de-la-tanda-2-ready-desde-el-2026-11-23).
> Integrado en `develop`: FDN-004, 010, 011, 021 y 022. Pruebas en `develop`: `npm run typecheck` OK y `npm test` 30/30.

| Equipo | Tarea | Estado | Worktree / rama | Rutas autorizadas |
|---|---|---|---|---|
| **Antigravity** | FDN-012 Verificar FreeCut | IN_PROGRESS | `FME-wt\antigravity` · `fdn/FDN-012-freecut` | `examples/fase1/freecut/**` |
| **Antigravity** | FDN-030 Registro de conectores | IN_PROGRESS | `FME-wt\antigravity-2` · `fdn/FDN-030-registro` | ver ficha |
| **Codex** | FDN-015 `run.ps1` en PS 5.1 (pequeña) y después FDN-031 Ejecución aislada | READY | `FME-wt\codex`: rama nueva desde `develop` (`fdn/FDN-015-ps51`, después `fdn/FDN-031-workers`) | ver fichas |
| **Codex** | FDN-024 Migraciones | READY | `FME-wt\codex-2`: rama nueva `fdn/FDN-024-migraciones` desde `develop` | ver ficha |
| **Claude A1** | FDN-016 FFmpeg del sistema para Revideo + ADR-0010 | READY | su worktree: rama nueva desde `develop` | `examples/fase1/revideo/**`, ADR-0010 |
| **Claude A2** | FDN-023 Fixtures y round-trip | READY | su worktree: rama nueva desde `develop` | ver ficha |
| **Claude A3** | FDN-013 Sonda de medios | READY | su worktree: rama nueva desde `develop` | `scripts/probe-media*.mjs` |
| **Libre** | FDN-060 Dirección artística: perfiles y reglas | READY | lo toma el primer equipo que quede libre (evento TOMADA) | `packages/art-direction/**` |
| **A0** | Integración, FDN-082 licencias | continuo | `FME` · `develop` | archivos compartidos |

**Importante para Codex:** las ramas `fdn/FDN-011-blender` y `fdn/FDN-022-tiempo` ya están integradas. Crea cada tarea nueva desde `develop` actualizado (`git switch -c <rama> develop`).

## Bloqueos conocidos
- FDN-005 (aprobación de la spec): solo la cierra el usuario. No bloquea ninguna tarea técnica.
- FDN-014 (cierre de la F1): espera a FDN-012 (FreeCut).
- FDN-032 (adaptador Revideo): espera a FDN-030 y FDN-031. FDN-040 (Blender): ídem. FDN-050 (router): espera a FDN-030.
- Las descargas siguen necesitando la confirmación explícita del usuario.

## Siguiente al integrar
- 012 → 014 y 041 · 030 → 050 · 030 + 031 → 032 (CL-A1) y 040 (CX) · 023 + 024 → 025.
