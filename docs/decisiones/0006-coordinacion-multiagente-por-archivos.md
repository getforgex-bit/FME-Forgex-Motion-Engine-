# ADR-0006: Coordinación multiagente por archivos versionados

- **Estado:** propuesta (2026-11-22) · **Dueño:** FORGEX MEDIA · **Revisable:** al cierre de la Fase 1 (primer uso real con varias sesiones)

## Contexto

FME se desarrollará con varias IA (Claude Code, Codex, Antigravity 2.0) y varias sesiones por herramienta. Las sesiones no comparten conversación; sí comparten el repositorio. Hace falta que cada una deje constancia de su avance y pueda comunicarse sin editar los mismos archivos.

## Decisión

- Protocolo en [`docs/agentes.md`](../agentes.md); estado en `coordinacion/` (`sesiones/`, `buzon/`, `reclamos/`), **un archivo por sesión, mensaje y reclamo** para evitar conflictos de git.
- Ayuda opcional `scripts/coord.mjs` (solo Node, con pruebas); los archivos también se pueden crear a mano.
- Los archivos compartidos (`STATUS.md`, `CHANGELOG.md`, roadmap, pruebas de aceptación) los edita solo un integrador.
- La bitácora incluye el id de sesión en el nombre del archivo.

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| Un único archivo de bitácora/estado compartido | Conflictos de fusión constantes con varias sesiones |
| Servidor de mensajería o MCP propio | Sistema adicional innecesario; contradice «integrar antes que construir» |
| Solo la memoria `.forgex/memory.jsonl` | Es un índice corto de hechos duraderos, no un canal de mensajes; un solo archivo implica conflictos |
| Issues/PR de GitHub | Requiere red y permisos por herramienta; no sirve sin remoto |

## Consecuencias

- **Positivas:** funciona con cualquier herramienta que lea y escriba archivos; auditable en el historial de git; sin infraestructura.
- **Negativas / costes:** latencia (hay que hacer commit, push y pull para ver los mensajes); no hay bloqueo atómico entre ramas distintas (un reclamo solo es visible tras publicarse).
- **Seguimiento:** revisar tras la Fase 1 si el ruido de `coordinacion/` en el historial o los reclamos obsoletos son un problema; valorar limpiar las sesiones cerradas.

## Evidencia

`npm test` → 5 pruebas en verde (`scripts/coord.test.mjs`). Carga de `AGENTS.md` por Antigravity 2.0: POR VALIDAR.
