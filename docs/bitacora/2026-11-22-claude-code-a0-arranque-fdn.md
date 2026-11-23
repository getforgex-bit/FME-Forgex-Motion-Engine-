# 2026-11-22 · Arranque de la red FDN (tres equipos)

- **Autor:** Claude Code A0 (Opus 5.5) · **Sesión:** `claude-code-a0` · **Rama/commit:** `claude/practical-gates-8agr0m` → `develop` · **Fase:** transversal (FDN-001, 002, 003, 006 y 020)

## Objetivo
Reorganizar el plan para ejecutarlo en paralelo con Claude Code, Antigravity y Codex, y dejar «Continúa» operativo sin depender del historial de la conversación.

## Hecho
- Diagnóstico del repo: Fase 0; solo hay tipos de contrato y `coord.mjs`.
- Plan FDN v1 aprobado por el usuario.
- `coordinacion/`: MASTER_PLAN, BACKLOG (FDN-001…082 con fichas), DEPENDENCY_GRAPH, CURRENT_SPRINT, TEAM_STATUS, TASK_PROTOCOL, INTEGRATION, CONTINUATION, GRAPH_TOOLS, BENCHMARKS (POR VALIDAR), MODEL_ROUTING, AGENT_PERFORMANCE y `prompts/` (ANTIGRAVITY, CODEX, CLAUDE-WORKERS).
- `coord.mjs`: carpeta operativa `FME-ops` detectada desde cualquier worktree (`raiz`), tipos `evento` y `solicitud`, y test nuevo. ADR-0007.
- Tests de paquetes (`node:test` + type stripping), `tsconfig.test.json` y `@types/node` 24.19.2 (dev, MIT, registrado). Smoke test en `packages/project/test/`.
- ADR-0008 (propuesta): Zod 4.
- `.gitignore`: índices de grafos y salidas de la Fase 1.

## Verificado
| Comando | Resultado real |
|---|---|
| `npm install` | 3 paquetes añadidos, 0 vulnerabilidades |
| `npm run typecheck` | OK (`tsc -b` + `tsc -p tsconfig.test.json`) |
| `npm test` | 7/7 en verde |
| `node scripts/coord.mjs raiz` | `C:\Users\bogex\Documents\Forgex\FME-ops` |
| `graphify --version` / `graphify update .` | 0.9.115 / 128 nodos, 126 aristas, 11 comunidades |
| `codegraph --version` / `codegraph status` | 1.6.4 / índice al día, construido con un motor anterior |

La verificación de los worktrees se anota en la sección siguiente.

## Pendiente / próxima acción
- El usuario abre Antigravity y Codex con los prompts de `coordinacion/prompts/`.
- FDN-005: aprobación de la spec v0.1 por el usuario.
- A0: integrar los eventos REVIEW de la Tanda 1.

## Memoria actualizada
- `decision:red-fdn-tres-equipos` y `gotcha:graphify-extract-usa-llm`.

## 2026-11-23 · Integración 1 (A0)
| Rama | Commit | Revisión de A0 | Resultado |
|---|---|---|---|
| fdn/FDN-021-esquema | b0325f9 | rutas OK (+`packages/project/tsconfig.json`, justificado); typecheck; test 18/18 | fusionada (fff45fd) |
| fdn/FDN-022-tiempo | 026af28 | rutas OK; typecheck; test 30/30 | fusionada (67c164d) |
| — | cde3c23 | re-exportaciones en `index.ts`; `dist` carga 12 exportaciones; `codegraph affected` → 4 tests | commit A0 |
| fdn/FDN-011-blender | b0a7db7 | A0 ejecutó `blender -b -P render_scene.py`: 90 PNG 960×540 RGBA en 23 s; SHA-256 RGBA `c9706f10…450b` **idéntico** al de C1. `run.ps1` falla en Windows PowerShell 5.1 (`IncompleteHashLiteral`, `if` como valor de hashtable) → FDN-015 | fusionada (c8f9c09) |
| fdn/FDN-010-revideo | 6ee5826 | rutas OK, aislado (lockfile propio, `node_modules` ignorado). **No re-ejecutado por A0** (~800 MB de descargas); evidencia de A1: dos `npm run verify`, el segundo limpio | fusionada (7eb001d) |
| fdn/FDN-004-benchmarks | 7cdfd04 | solo BENCHMARKS.md; contrasta los datos iniciales; marca las contradicciones | fusionada (a94c03b) |

Después: `npm run typecheck` OK y `npm test` 30/30 en `develop`. Nuevas tareas READY: 013, 015, 016, 023, 024, 031 y 060. Licencias registradas: zod, Revideo, FFmpeg bundled GPLv3, Chrome for Testing, Blender y FFmpeg del sistema.

## 2026-11-23 · Integración 2 (A0)
Cada fusión se hizo con `merge --no-commit` y después `npm run typecheck` + `npm test` **antes** del commit (lección de la integración 1).

| Rama | Commit | Resultado tras fusionar |
|---|---|---|
| FDN-030 registro | 4ee6910 | test 39/39 |
| FDN-024 migraciones | 8cbdde3 | 43/43 |
| FDN-023 fixtures | 1a35a36 | 49/49 |
| FDN-013 sonda de medios | f271d29 | 56/56 |
| FDN-015 PS 5.1 | d216597 | 56/56. A0: `powershell -File run.ps1 -RunName a0-ps51` → código 0, 90 fotogramas, SHA-256 RGBA `c9706f10…450b` (idéntico) |
| FDN-016 FFmpeg del sistema | c8ba756 | 56/56. No re-ejecutado por A0 (motor no instalado en este checkout) |
| FDN-031 workers | e73f706 | lockfile regenerado offline; tests del worker añadidos a `npm test` → 61/61 |
| FDN-060 art-direction | b78af00 | referencia en `tsconfig.json` + lockfile → 68/68 |

Re-exportaciones en `@fme/connectors` (registro) y `@fme/project` (`migrateToCurrent`). Los paquetes compilados de project, connectors, art-direction y workers cargan bien.
ADR-0011 (interfaz de adaptadores): `adapter.ts` + 3 tests → **71/71**. Workspaces `packages/adapters/*` preparados.
Graphify (`god-nodes`): `parseProject` y `ConnectorRegistry` son los nodos centrales; los cambios en ellos exigen `codegraph impact`.
Bloqueo: FDN-012 espera la confirmación del usuario para la descarga de FreeCut.

## 2026-11-23 · Integración 3 y cierre de la Fase 2 (A0)
| Rama | Commit | Verificación de A0 | Resultado |
|---|---|---|---|
| FDN-026 deserialize + migraciones | 652f0e2 | `node --test packages/project/test/*.test.ts` → 36/36. Con el paquete compilado: `deserialize` de `fixtures-v0` → v1 y estable; la fixture híbrida hace round-trip byte a byte | fusionada |
| FDN-032 adaptador Revideo | a88148d | En `develop`: 84 pass + 4 skip (sin motor instalado; skip con motivo). **Job real:** `node --test packages/adapters/revideo/test/adapter.integration.test.ts` en el worktree de A1 (con motor) → **6/6 en 28 s** (título de la fixture híbrida → 120 fotogramas; MOV alpha; capa SVG → 210 fotogramas; `checkAdapterResult` = []) | fusionada |
| FDN-070 caché | f3ad71f | test 92/92 + 4 skip | fusionada |

**Fase 2 CERRADA (FDN-025):** criterio #2 ☑. Evidencia: los tests anteriores. Roadmap y pruebas-aceptacion actualizados.
Hallazgos que pasan al backlog:
- la capa `text` no tiene campo de contenido (A1 usa `requirements.text`) → FDN-028 (ADR + schemaVersion 2);
- Revideo escribe temporales en `os.tmpdir()`, fuera de `workDir` → FDN-034;
- validador de rutas compartido (solicitud de C2) → se pospone: el almacén de la caché valida su propia raíz y rechaza enlaces, y basta por ahora.


## 2026-11-23 · Integración 4: cierre de las Fases 1 y 3 (A0)
| Rama | Commit | Verificación de A0 | Resultado |
|---|---|---|---|
| FDN-028 texto / v2 | 05a8e64 | diff de `index.ts` = solicitud de A2; 101 pass | fusionada |
| FDN-033 E2E | 13606e6 | +`@fme/cache` como devDependency; 101 pass | fusionada |
| FDN-034 temporales | ad7058e | 101 pass | fusionada |
| FDN-050 router | 3ef734e | ref + lockfile; 108 pass | fusionada |
| FDN-012 FreeCut | fcc4b49 | A0: `powershell -File examples/fase1/freecut/run.ps1` → `probe-media`: 150 fotogramas, 30 FPS, 1280×720, audio, 8 s | fusionada |
| FDN-040 Blender | 13a1358 | **falla con `develop`**: `schemaVersion 1 no soportado; esta versión entiende 2` (conflicto semántico con FDN-028) | **devuelta** a CX |

**Con el motor real sobre `develop`** (junction temporal al `node_modules` del motor de A1, eliminada después): `node --test --test-concurrency=1 packages/adapters/revideo/test/*.integration.test.ts` → **8/8**. En paralelo, 7/8 → `tmp-workdir` ve el `workDir` de `e2e` en `os.tmpdir()` (aislamiento entre tests, no es un fallo del producto) → FDN-034b.
**Fallo intermitente de `npm test`:** `EPERM … rename` en `DiskCache` (1 de 5 ejecuciones completas; 0/40 aislado y 0/40 con 8 en paralelo). Es un bug real de Windows (`rename` sobre un destino abierto) → FDN-070b. El script de integración de A0 reintenta solo ante ese error concreto.
**Fase 1 cerrada (criterio #1 ☑) y Fase 3 cerrada.** Criterios: 2/8.


## 2026-11-23 · Integración 5 (A0)
| Rama | Commit | Verificación de A0 | Resultado |
|---|---|---|---|
| FDN-051 tokens | 3366479 | 113 pass | fusionada |
| FDN-032b/034b Revideo | c9499f8 | 114 pass; motor real en paralelo ×3 → 8/8, 8/8, 8/8 | fusionada |
| FDN-080 MCP | 0348125 | A0: `apps/*` en workspaces, test y typecheck; lockfile con el SDK 1.32.2; `npm audit --omit=dev` 0 → 125 pass | fusionada |
| FDN-040 Blender | ab6e780 | **Sin REVIEW actualizado** (Codex sin cuota). A0: `node --test packages/adapters/blender/test/*.test.ts` con Blender real → 6/6, 0 skip, 31 s; 131 pass | fusionada |
| FDN-071 render-plan | 900daec | incompleta (falta la segmentación) | no fusionada |

Graphify `god-nodes`: `planRoute` (18), `deserialize` (18), `createFmeServer` (14) y `parseProject` (14) son los nodos centrales.
**Recordatorio en el buzón firmado como usuario** (`humano-usuario`, 07:08 UTC): propone la tarea de relevo entre equipos. A0 no lo ejecuta sin confirmarlo en el chat → FDN-090 en BACKLOG como propuesta.


## 2026-11-23 · FDN-090: protocolo de relevo entre equipos (A0)
- Lo pidió el usuario en el chat («Sí, diseña el protocolo y hazme preguntas») tras el recordatorio del buzón.
- **Decisiones del usuario:**
  - detección por latido (60 min) y declaración por el usuario;
  - A0 propone el relevo y el usuario lo aprueba;
  - rama nueva desde la punta del caído;
  - el relevista termina la tarea;
  - si cae A0, se pausa la integración y el usuario elige un suplente (Sol, Neon o Astra en Codex).
- **Hecho:**
  - ADR-0013;
  - `coord.mjs`: `equipos` (también en `estado`), `caida` (acta con puntas, worktrees, `.patch` de los cambios sin commit y reclamos), `relevar` (libera los reclamos de la tarea y envía el `traspaso`) y `reincorporar` (nota con lo relevado y lo integrado desde la caída);
  - excluye las sesiones `humano` del cálculo de equipos;
  - reloj inyectable `FME_AHORA` para los tests;
  - CONTINUATION, TASK_PROTOCOL, INTEGRATION (integrador suplente), prompts (ANTIGRAVITY, CODEX, CLAUDE-WORKERS) y `docs/agentes.md`.
- **Verificado:**
  - `node --test scripts/coord.test.mjs` → 7/7, incluido el test de extremo a extremo del relevo con reloj simulado: sospechoso a los 65 min, caída sin cita rechazada, relevo que libera solo el reclamo de la tarea y nota de reincorporación entregada;
  - `node scripts/coord.mjs equipos` sobre el `FME-ops` real → antigravity, claude y codex activos o inactivos, sin falsos sospechosos.
- **Caso real:** Codex volvió por sí solo (~16:45 UTC) y entregó FDN-070b y FDN-071 → **no hizo falta relevo**. No se ejecutó `caida` sobre ningún equipo real.


## 2026-11-23 · FDN-091: modo ausencia del usuario (A0)
- **Petición del usuario:** detectar su ausencia; trabajar solo en lo conocido y dejar pendientes las aprobaciones; detenerse poco a poco; evitar relevos falsos, porque las aplicaciones pueden tener tokens sin que él esté.
- **Decisiones del usuario:**
  - umbral de 2 h;
  - 3 escalones (2, 4 y 6 h);
  - A0 integra solo lo verde;
  - al volver, resumen y decisiones una a una.
- **Hecho:**
  - ADR-0014;
  - `coord.mjs`: `usuario [--presente]`, `pendiente`, `pendientes` y `decidir`;
  - `equipos` muestra «en pausa (usuario ausente)» en lugar de «sospechoso»;
  - `caida`, `relevar` y `decidir` exigen presencia;
  - `estado` muestra el escalón.
  - Paso 0 en CONTINUATION, en los prompts (ANTIGRAVITY, CODEX y CLAUDE-WORKERS) y en AGENTS.md.
- **Verificado:** `node --test scripts/coord.test.mjs` → 8/8. A0 registró la presencia real (`usuario --presente` → escalón 0).
- **Limitación honesta:** depende de que cada coordinador registre la presencia en cada mensaje. Si lo olvida, el sistema frena: es el fallo seguro.
