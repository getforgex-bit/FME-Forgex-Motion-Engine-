# ADR-0003: FORGEX Stack como memoria y herramientas para agentes

- **Estado:** aceptada (2026-11-22) · **Dueño:** FORGEX MEDIA · **Revisable:** antes de cualquier uso comercial de FME o del trabajo hecho con GitNexus

## Contexto

Se pidió instalar en FME el "Segundo Cerebro" (`getforgex-bit/Segundo-Cerebro-Code-Mode`) para tener memoria y una forma común de almacenar cambios e información. En la rama `develop` de ese repo (commit `fcd1bbd`, 2026-11-22):
- **Lo vigente es `stack/` (FORGEX Stack):** pctx Code Mode + GitNexus + `@modelcontextprotocol/server-memory`.
- El gateway propio **Cerebro** (`crates/cerebro*`, `coordination/`) está **congelado** en `b122858` y no se debe reactivar sin petición explícita.

## Decisión

1. Instalar en FME **FORGEX Stack** desde `develop` (`stack/setup.sh`), no Cerebro.
2. Versionar `.forgex/memory.jsonl`, `AGENTS.md` y `CLAUDE.md`. **No** versionar `pctx.json`, `.mcp.json`, `.agents/`, `.codex/` ni `.gitnexus/`, porque llevan rutas absolutas o son índices locales.
3. Adoptar las convenciones de `develop`: idioma español con identificadores en inglés, distinguir propuesta/hecho/verificado citando comandos, ADR, `STATUS.md` y rama troncal `develop`.
4. Sembrar la memoria con la ficha del proyecto, las decisiones congeladas, las convenciones y las tareas del corto plazo.

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| Cerebro (gateway Rust) | Congelado por decisión del propio repo |
| Conectar GitNexus directo al cliente | ≈17,5k tokens fijos por sesión frente a ≈736 detrás de pctx (medición del kit) |
| Solo documentos Markdown | No da recuperación estructurada ni grafo de código a los agentes |

## Consecuencias

- **Positivas:** memoria compartida y versionada, bajo consumo de contexto y una instalación de un solo comando por máquina.
- **Negativas:**
  - ⚠ **GitNexus es PolyForm Noncommercial 1.0.0.** FME aspira a comercializarse: antes de cualquier uso comercial hay que migrar (CodeGraphContext o Serena, verificando su licencia en ese momento) o adquirir una licencia. GitNexus **no** se distribuye con FME; es una herramienta de desarrollo.
  - pctx ejecuta las herramientas que la IA invoque **sin aprobación por herramienta**: no se añaden servidores MCP destructivos detrás de `forgex`.
  - Cada persona debe ejecutar el setup en su máquina.
- **Seguimiento:** revisar este ADR al decidir la licencia de FME (ADR-0004).

## Evidencia

Instalación ejecutada en el entorno cloud de preparación del repo (Linux, Node 22). Resultado del `verify.mjs` registrado en `docs/bitacora/2026-11-22-preparacion-repositorio.md`.
