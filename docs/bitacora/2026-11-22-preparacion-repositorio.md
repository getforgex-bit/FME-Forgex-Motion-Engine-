# 2026-11-22 · Preparación del repositorio

- **Autor:** Claude Code (sesión cloud) · **Rama:** `claude/practical-gates-8agr0m` · **Fase:** 0

## Objetivo
Convertir el repo vacío en la base del proyecto descrito en la *Especificación integral v0.1*, con documentación, objetivos a corto/mediano/largo plazo e instalación del Segundo Cerebro (FORGEX Stack) como memoria común.

## Hecho
- Estructura de la spec §11.2: `apps/`, `packages/{project,connectors,art-direction,router,adapters}`, `runtime/{workers,cache}`, `examples/prueba-hibrida-10s/`, `docs/`.
- PDF de la spec en `docs/especificacion/` (SHA-256 `0aec59aa…d71d8`) + versión navegable en `docs/*.md`.
- `docs/roadmap.md` con horizontes corto (Fases 0–3), mediano (4–7) y largo (8+), sin fechas inventadas.
- Contratos TypeScript PROPUESTOS: `@fme/project` (Anexo A + `ExternalProjectRef`/`RenderArtifact` de §7.1) y `@fme/connectors` (§8.3).
- ADR 0001–0005, plantillas, `STATUS.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `AGENTS.md`/`CLAUDE.md` y plantillas de GitHub.
- CI (`.github/workflows/ci.yml`): `npm ci`, typecheck y validación de la memoria. **No se ha ejecutado en GitHub todavía.**
- Revisado `Segundo-Cerebro-Code-Mode` en `develop` (`fcd1bbd`): lo vigente es `stack/`; Cerebro está congelado (`b122858`). Se adoptan sus convenciones (ADR, STATUS, verdad verificada y troncal `develop`).
- FORGEX Stack instalado con `stack/setup.sh` y memoria sembrada vía `execute_typescript`.

## Verificado
| Comando | Resultado real |
|---|---|
| `npm install && npm run typecheck` | OK (TypeScript 5.9.3, `tsc -b` sin errores) |
| `~/forgex-stack/stack/setup.sh <FME>` | `gitnexus analyze`: 320 nodos / 371 aristas; configuración escrita; **`RESULTADO: OK`** |
| `verify.mjs` (dentro del setup) | pctx con 3 herramientas ≈736 tokens fijos; memoria creada/leída/borrada; `Gitnexus.query` respondió a través de pctx; GitNexus directo ≈17 489 tokens |
| Siembra de la memoria vía pctx `execute_typescript` | 23 entidades y 10 relaciones; `Memory.searchNodes("Fase 1")` devuelve resultados |
| `npm run check:memory` | `✔ .forgex/memory.jsonl: 23 entidades, 10 relaciones` |

**No verificado:** los clientes reales en la máquina del usuario (Claude Code/Desktop, Codex y Antigravity), `setup.ps1` en Windows y la CI en GitHub. La instalación se hizo en el contenedor cloud (Linux, Node 22.23.5); en la máquina del usuario hay que volver a ejecutar el setup.

## Decisiones tomadas
- ADR-0001 a 0003 aceptadas; ADR-0004 (licencia) y ADR-0005 (npm workspaces) **propuestas**, pendientes del visto bueno del usuario.

## Pendiente / próxima acción
1. El usuario aprueba formalmente la spec v0.1 (cierre de la Fase 0) y las ADR propuestas.
2. Ejecutar FORGEX Stack en la máquina local (ver `docs/memoria-y-registro.md`).
3. Crear la rama `develop` como troncal (si se acepta la convención).
4. Fase 1: fijar versiones y ejecutar las pruebas de FreeCut, Revideo y Blender.

## Memoria actualizada
- `FME` (project), 10 `decision:*`, 5 `convention:*`, 3 `task:fase-*`, 2 `gotcha:*` y 2 `component:*`.
