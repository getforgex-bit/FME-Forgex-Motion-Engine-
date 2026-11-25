# ADR-0001: Registrar las decisiones con ADR

- **Estado:** aceptada (2026-11-22) · **Dueño:** FORGEX MEDIA · **Revisable:** al cierre de la Fase 3

## Contexto

FME lo desarrollarán personas y varios agentes IA (Claude Code, Codex, Antigravity) en sesiones independientes. Sin un registro explícito, las decisiones se pierden entre conversaciones y se vuelven a discutir. La spec v0.1 (§21.2) ya fija decisiones que deben seguir trazables.

## Decisión

1. Las decisiones de arquitectura, alcance, licencias y seguridad se registran como ADR en `docs/decisiones/`.
2. Se acompañan de: una entidad `decision` en la memoria (`.forgex/memory.jsonl`), una fila en la tabla de `STATUS.md` y, si cambian el comportamiento, una entrada en `CHANGELOG.md`.
3. El trabajo de cada sesión se documenta en `docs/bitacora/` (qué se hizo, cómo se verificó y qué queda).

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| Solo la memoria MCP | Útil para agentes, pero poco legible para personas y sin espacio para alternativas |
| Solo issues de GitHub | Dependen de la plataforma y no viajan con el código |

## Consecuencias

- **Positivas:** trazabilidad, menos re-discusión y contexto barato para los agentes.
- **Negativas:** pequeño coste de escritura por decisión.
- **Seguimiento:** revisar en la Fase 3 si el volumen de ADR es razonable.
