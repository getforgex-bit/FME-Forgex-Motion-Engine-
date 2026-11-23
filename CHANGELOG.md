# Changelog

Todos los cambios relevantes de FME se documentan aquí.
Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado: [SemVer](https://semver.org/lang/es/) (mientras sea `0.x`, cualquier versión puede romper la compatibilidad).

## [Unreleased]

### Added
- Estructura del repositorio según la spec v0.1 §11.2 (`apps/`, `packages/`, `runtime/`, `examples/`, `docs/`).
- Especificación integral v0.1 (PDF) y documentación navegable en `docs/`.
- Roadmap con objetivos a corto, mediano y largo plazo (`docs/roadmap.md`).
- Contratos TypeScript propuestos: `@fme/project` (Anexo A) y `@fme/connectors` (§8.3).
- ADR 0001–0005, plantillas de ADR y bitácora, y `STATUS.md`.
- FORGEX Stack (Segundo Cerebro, rama `develop`): memoria del proyecto en `.forgex/memory.jsonl`, bloque de instrucciones en `AGENTS.md` y `CLAUDE.md`.
- CI de GitHub Actions: typecheck y validación de la memoria.
- Red de desarrollo FDN en `coordinacion/` (ADR-0007): plan maestro, backlog FDN-xxx, grafo de dependencias, tanda actual, protocolo «Continúa», política de Graphify/CodeGraph y prompts para Antigravity, Codex y las sesiones Claude.
- `coord.mjs`: carpeta operativa compartida `FME-ops`, detectada desde cualquier worktree (`raiz`), y tipos de mensaje `evento` y `solicitud`.
- Tests de paquetes con `node:test` y type stripping (`packages/*/test/**/*.test.ts`), y typecheck de los tests (`tsconfig.test.json`, `@types/node`).
- ADR-0008 (propuesta): validación en runtime con Zod 4.
- Coordinación multiagente (Claude Code, Codex, Antigravity, varias sesiones): protocolo en `docs/agentes.md`, estado en `coordinacion/`, ayuda `scripts/coord.mjs` con pruebas (`npm test`) y ADR-0006.
