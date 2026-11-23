# Tanda actual: Tanda 1

> Dueño: A0. _Abierta el 2026-11-22._ Fichas completas en [BACKLOG.md](BACKLOG.md#fichas-de-las-tareas-ready).

| Equipo | Tarea | Estado | Worktree / rama | Rutas autorizadas |
|---|---|---|---|---|
| **Antigravity** | FDN-012 Verificar FreeCut | READY | `FME-wt\antigravity` · `fdn/FDN-012-freecut` | `examples/fase1/freecut/**` |
| **Antigravity** | FDN-030 Registro de conectores | READY | `FME-wt\antigravity-2` · `fdn/FDN-030-registro` | `packages/connectors/src/registry.ts`, `packages/connectors/test/**`, `docs/decisiones/0009-*` |
| **Codex** | FDN-011 Verificar Blender | READY | `FME-wt\codex` · `fdn/FDN-011-blender` | `examples/fase1/blender/**` |
| **Codex** | FDN-022 Tiempo racional | READY | `FME-wt\codex-2` · `fdn/FDN-022-tiempo` | `packages/project/src/time.ts`, `packages/project/test/time.test.ts` |
| **Claude A1** | FDN-010 Verificar Revideo | READY | worktree de la app · `fdn/FDN-010-revideo` | `examples/fase1/revideo/**` |
| **Claude A2** | FDN-021 Esquema y serialización | READY | worktree de la app · `fdn/FDN-021-esquema` | ver ficha |
| **Claude A3** | FDN-004 Benchmarks | READY | worktree de la app · `fdn/FDN-004-benchmarks` | `coordinacion/BENCHMARKS.md` |
| **A0** | Integración, revisión y FDN-082 | continuo | `FME` · `develop` | archivos compartidos |

## Bloqueos conocidos
- FDN-005 (aprobación de la spec): solo la cierra el usuario. No bloquea ninguna tarea técnica.
- Descargas de la Fase 1 (clon de FreeCut y paquetes npm de Revideo y Zod): **requieren la confirmación explícita del usuario** en la aplicación que las ejecute, y solo desde las fuentes oficiales citadas en las fichas. Antes de descargar, el equipo indica qué, de dónde y su tamaño aproximado. Mientras espera, avanza en lo que no dependa de la descarga.

## Siguiente al integrar
- 010 + 011 + 012 → 014 (cierre de la F1); 012 → 041; 011 → 040.
- 021 → 023 y 024; 022 → 023.
- 030 → 050; 003 → 031 y 013 (ya READY para la Tanda 2 en cuanto un equipo quede libre).
