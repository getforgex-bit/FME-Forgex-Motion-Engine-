# Changelog

Todos los cambios relevantes de FME se documentan aquí.
Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado: [SemVer](https://semver.org/lang/es/) (mientras sea `0.x`, cualquier versión puede romper la compatibilidad).

## [Unreleased]

### Added
- `@fme/adapter-revideo`: primer adaptador real (ADR-0011), motor aislado en `runtime/engines/revideo` (FDN-032).
- `@fme/cache`: `dependencyHash`, `DependencyGraph` y `DiskCache` (FDN-070).
- `deserialize` aplica las migraciones; **Fase 2 cerrada** (FDN-025, FDN-026).
- `@fme/connectors`: registro dinámico con semántica `yes`/`no`/`unknown` (FDN-030, ADR-0009) e interfaz común de adaptadores con procedencia (ADR-0011).
- `@fme/runtime-workers`: `runIsolated`, ejecución sin shell con timeout que mata el árbol de procesos en Windows (FDN-031).
- `@fme/art-direction`: perfiles de estilo y reglas de animación deterministas (FDN-060).
- `@fme/project`: migraciones (`migrateToCurrent`, FDN-024) y fixtures, incluida la prueba híbrida de 10 s (FDN-023).
- `scripts/probe-media.mjs` (FDN-013). Blender `run.ps1` compatible con PS 5.1 (FDN-015). Revideo con el FFmpeg del sistema y vite 8.3.8 (FDN-016, ADR-0010).
- `@fme/project`: esquema Zod 4.6.7 con validación estricta (`parseProject`) y JSON Schema generado, serialización determinista (`serialize`/`deserialize`) y tiempo racional sin deriva con timecode drop-frame (FDN-021, FDN-022).
- Verificación de la Fase 1: Revideo 0.11.0 (`examples/fase1/revideo`, FDN-010) y Blender 5.2.3 headless (`examples/fase1/blender`, FDN-011), con scripts repetibles y tarjetas reales.
- `coordinacion/BENCHMARKS.md` verificado con fuentes (FDN-004).
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
