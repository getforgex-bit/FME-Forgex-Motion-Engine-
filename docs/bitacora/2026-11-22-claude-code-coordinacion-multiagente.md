# 2026-11-22 · Coordinación multiagente

- **Autor:** Claude Code · **Sesión:** (anterior al protocolo) · **Rama/commit:** claude/practical-gates-8agr0m (sin commit) · **Fase:** transversal

## Objetivo
Dejar el protocolo y las herramientas para que varias IA (Claude Code, Codex, Antigravity 2.0) y varias sesiones documenten su avance y se comuniquen.

## Hecho
- Protocolo `docs/agentes.md` y ADR-0006; bloque «Coordinación multiagente» en `AGENTS.md`.
- Estado compartido en `coordinacion/` (sesiones, buzón, reclamos), un archivo por autor.
- `scripts/coord.mjs` (registrar, avance, enviar, buzon, reclamar, liberar, cerrar, estado) y `scripts/coord.test.mjs`; `npm test` añadido a CI.
- Bitácora con id de sesión; memoria: `convention:coordinacion-multiagente`.

## Verificado
| Comando | Resultado real |
|---|---|
| `npm test` | 5 pruebas en verde |
| `npm run check:memory` | OK, 24 entidades y 11 relaciones |
| `npm run typecheck` | **No ejecutable aquí**: `tsc` no está instalado (falta `npm install`); no se tocó TypeScript |

No verificado: uso real simultáneo desde Codex y Antigravity; que Antigravity 2.0 cargue `AGENTS.md`.

## Decisiones tomadas
- Coordinación por archivos versionados, integrador único para archivos compartidos → ADR-0006 (propuesta).

## Pendiente / próxima acción
- El usuario designa integrador y rama de coordinación (`develop` aún no existe).
- Probar el protocolo con dos herramientas en la Fase 1 y ajustar.
- Decidir si se versionan `.codegraph/` y `graphify-out/` (hoy sin seguimiento).

## Memoria actualizada
- `convention:coordinacion-multiagente` (+ relación `part_of` FME).
