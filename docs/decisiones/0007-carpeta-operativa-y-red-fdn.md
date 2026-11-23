# ADR-0007: Coordinar los tres equipos con una carpeta operativa local y documentos FDN versionados

- **Estado:** propuesta (2026-11-22; plan FDN v1 aprobado por el usuario) · **Dueño:** A0 (Claude Code, Opus 5.5) · **Revisable:** al cerrar la Tanda 1
- **Sustituye parcialmente a:** [ADR-0006](0006-coordinacion-multiagente-por-archivos.md). Se mantienen el principio de un archivo por autor, el formato de los archivos y `scripts/coord.mjs`. Cambia **dónde** viven los mensajes.

## Contexto

Tres aplicaciones (Claude Code Desktop, Antigravity y Codex Desktop) trabajan en paralelo sobre worktrees del mismo repositorio. Con ADR-0006, un mensaje solo se ve tras commit y push a una rama común. Eso obliga a hacer push continuamente, mezcla mensajería y código en la historia, y los worktrees no ven los cambios sin commit de los demás.

## Decisión

1. **Mensajería operativa fuera de git**, en `C:\Users\bogex\Documents\Forgex\FME-ops\` (`sesiones/`, `buzon/`, `reclamos/`, `estado/`). `coord.mjs` la localiza con `FME_COORD_DIR` o, si no existe, como `<padre del .git común>/../FME-ops`. Es la misma carpeta desde cualquier worktree.
2. **Documentación del plan versionada** en `coordinacion/` (MASTER_PLAN, BACKLOG, CURRENT_SPRINT, CONTINUATION…). **Solo la edita A0**, el integrador.
3. Los equipos comunican cambios de estado con mensajes `--tipo evento` o `--tipo solicitud` dirigidos a `claude-code-a0`. A0 los consolida al integrar.
4. La integración es local: los worktrees comparten `.git`, así que las ramas se ven sin push. No hay push al remoto sin autorización del usuario.

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| Mantener ADR-0006 (buzón versionado + push) | Un push por mensaje; ruido en la historia; los worktrees no ven nada sin commit |
| Un único archivo de estado compartido | Tres procesos escribiendo el mismo archivo: conflictos y pérdidas |
| Servicio de mensajería o MCP propio | Construir infraestructura que no aporta a FME (regla: integrar antes que construir) |

## Consecuencias

- **Positivas:** coordinación inmediata y sin conflictos de git. El estado consolidado sigue siendo verificable en git.
- **Negativas:** `FME-ops` no tiene historial ni copia de seguridad. Si se pierde, se reconstruye desde `coordinacion/` y las bitácoras. Solo funciona en esta máquina.
- **Seguimiento:** medir en `AGENT_PERFORMANCE.md` los conflictos y los mensajes perdidos durante la Tanda 1.

## Evidencia

`npm test`: 7/7 en verde, incluido el test nuevo de `evento`/`solicitud` y `resolverRaiz`. `node scripts/coord.mjs raiz` → `C:\Users\bogex\Documents\Forgex\FME-ops`. Falta comprobar el acceso desde los worktrees (bitácora del arranque).
