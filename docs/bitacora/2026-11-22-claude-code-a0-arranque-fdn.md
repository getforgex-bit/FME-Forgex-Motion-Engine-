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


## 2026-11-23 · Integración 6 (A0)
| Rama | Commit | Verificación de A0 | Resultado |
|---|---|---|---|
| FDN-070b caché Windows | 25f6b9c | `npm test` 6 veces seguidas: 148/148 en todas (antes fallaba ~1 de cada 5) | fusionada |
| FDN-071 render-plan | f6a8abb | ref + lockfile; 148 pass | fusionada |
| FDN-072 recovery | 021582e | ref + lockfile; 156 pass | fusionada |
| FDN-041 adaptador FreeCut | 7bdca83 | ref + lockfile; `node --test packages/adapters/freecut/test/*.test.ts` con FreeCut real → 7/7, 0 skip, 24 s; `contentSha256` `93cb5c72…` = el de AG | fusionada |
| FDN-081 CLI | f87d164 | ref + lockfile; 171 pass | fusionada |
| FDN-061 gradientes | ed40273 | cambios fuera de ficha aditivos (dependencia y re-exportación) aceptados; lockfile; 178 pass | fusionada |

Con el motor Revideo real sobre `develop` (junction temporal, eliminada después): integración del adaptador **9/9 en paralelo** (incluidos los gradientes) y CLI **9/9** (`job run` real). **Criterio #6 ☑** (Revideo). La F6 sigue abierta hasta tener Blender (FDN-061b) y FDN-062.
Tanda 7 abierta: Fase 4, con 042a (AG), 042b (A2) y 061b (CX). 042c (A1) queda para después.


## 2026-11-23 · Integración 7 (A0)
| Rama | Commit | Verificación de A0 | Resultado |
|---|---|---|---|
| FDN-042b artefactos / v3 | 8aaa304 | diff de `index.ts` = solicitud de A2; ediciones fuera de ficha aceptadas (`apps/mcp` usa `SCHEMA_VERSION`); 184 pass | fusionada |
| FDN-061b gradientes en Blender | 81bad19 | fusionada sobre la v3 sin conflictos; lockfile; 185 pass; `node --test packages/adapters/blender/test/*.test.ts` con Blender real → 7/7, 31 s | fusionada |
| FDN-042a compose en FreeCut | 58c752b | 192 pass; `node --test packages/adapters/freecut/test/*.test.ts` con FreeCut real → 14/14, 18 s | fusionada |

Criterio #6 completado con evidencia en los dos motores. Tanda 8 abierta: 042c (A1, criterio #3), 080b (A2), 074a (AG) y 073a (CX).


## 2026-11-23 · Integración 8: cierre de la Fase 4 (A0)
| Rama | Commit | Verificación de A0 | Resultado |
|---|---|---|---|
| FDN-042c pipeline | cb2d404 | ref + lockfile; 192 pass. **Con los 3 motores reales:** `node --test packages/pipeline/test/*.test.ts` → 1/1 en 87 s. Inspección propia del `hybrid.mp4` con `probe-media`: 300 fotogramas, 30 FPS, 1280×720, con audio. Proyecto v3 con 5 artefactos y `renderArtifactId` resueltos (2D, 3D y título). Mosaico de los fotogramas 15/120/200/290: cada capa en su rango | fusionada |
| FDN-074a audio | ea2df61 | 198 pass | fusionada |
| FDN-080b preview y ops | 991f1f5 | 206 pass (un reintento por EPERM) | fusionada |
| FDN-073a seguridad y regresión | b5bfe85 | globs `tests/**` en npm test y typecheck → 215 pass + 12 skip + 3 TODO | fusionada |

**Criterio #3 ☑ y Fase 4 cerrada.**
**Nuevo fallo intermitente diagnosticado:** `ATOMIC_REPLACE_UNAVAILABLE` (EPERM en `.freecut-headless/atomic-test`, la comprobación de arranque del headless de FreeCut) en `audio-sync.integration.test.ts:214`, 1 de cada 6 ejecuciones → FDN-074b (reintento en el adaptador, sin forkear). El EPERM de `DiskCache` (070b) no ha vuelto a aparecer.


## 2026-11-23 · Integración 9: Fase 5 cerrada y criterio #8 (A0)
| Rama | Commit | Verificación de A0 | Resultado |
|---|---|---|---|
| FDN-075a incremental | d68149e | lockfile; 215 pass (segundo intento por el intermitente de la caché). **Con los 3 motores:** `node --test packages/pipeline/test/incremental.integration.test.ts` → 1/1, 135 s; diferencia fuera de 180–299 = 0 en 13 fotogramas | fusionada; **criterio #8 ☑** |
| FDN-080c export | 7a873f1 | lockfile; 217 pass | fusionada |
| FDN-052 fallbacks | fba05eb | 222 pass. `node --test packages/router/test/real-adapters.test.ts packages/recovery/test/real-fallbacks.integration.test.ts` con los motores → 5/5 | fusionada; **criterios #4 y #5 ☑** |
| FDN-074b reintento FreeCut | — | 226 pass | fusionada |

- **Mensajes del buzón firmados como el usuario** (`antigravity-plan`, `claude-code-a0s`): el usuario confirmó en el chat que eran suyos y que `a0s` es un suplente/asistente que solo crea archivos → ADR-0016.
- **Propuesta v2 de trazabilidad:** revisada. El usuario decidió en el chat de A0: PROGRESO.md versionado; `--check` bloquea solo la integración de A0; implementación **después** de la prueba híbrida → FDN-092 en BACKLOG.
- Las otras preguntas abiertas de la v2, decididas por A0 (se aplicarán en FDN-092):
  - el script lee la copia consolidada versionada; FME-ops, solo para la vista en vivo;
  - migración retroactiva con la tabla del §4, verificando que cada `[x]` enlace evidencia existente;
  - FDN-004 y las tareas de operación, con la etiqueta «operación» y fuera del %.
- **Intermitente:** el test de concurrencia de la caché vuelve a fallar con la suite completa en carga → FDN-070c. La referencia de regresión de Revideo quedó obsoleta tras la corrección del SVG → FDN-073c.


## 2026-11-25 · Turnos de coordinadores (ADR-0017) y vuelta del usuario (A0)
- **Vuelta del usuario tras 36,2 h** (escalón 3): no hubo eventos, REVIEW ni decisiones en cola; `develop` sigue en e64f992.
- **Defecto detectado:** AG y CX salían «sospechosos» al volver el usuario, porque sin él no pueden latir. Corregido: el plazo cuenta desde la vuelta y, mientras tanto, se muestra «esperando al usuario».
- **Petición del usuario:**
  - Antigravity añade una sesión **Carbon** (+2 Hydrogen) en turno con Neon, no paralela;
  - Codex usa **Astra** de forma temporal porque Sol se queda sin cuota semanal;
  - se tienen en cuenta sus tablas de benchmarks.
- **Hecho:**
  - `coordinacion/turnos.json` (perfiles por modelo a partir de las tablas del usuario);
  - `coord.mjs turno` (recomendar, tomar, ceder, sin-cuota, disponible), con desempate por coste y alternancia y nota de traspaso;
  - tomar o ceder renueva el latido;
  - las claves cortas solo cuentan como palabra completa;
  - ADR-0017, BENCHMARKS §6, MODEL_ROUTING, CONTINUATION y las variantes Carbon y Astra de los prompts.
- **Verificado:**
  - `node --test scripts/coord.test.mjs` → 9/9;
  - sobre el `FME-ops` real: FDN-074 → Neon, FDN-070c → Carbon y Codex → Astra (`codex-c0` marcado sin cuota por lo que dijo el usuario);
  - `equipos` muestra «esperando al usuario» en lugar de «sospechoso».


## 2026-11-25 · Integración 10: prueba híbrida 8/8 (A0)
| Rama | Commit | Verificación de A0 | Resultado |
|---|---|---|---|
| FDN-073b endurecimiento | d7c625e | 230 pass + 15 skip, **0 TODO** | fusionada |
| FDN-063 técnicas | ab8b76e | 234 pass, sin conflictos con 073b | fusionada (3d-with-2d parcial) |
| FDN-074 sincronía A/V | 4cb1b60 | 234 pass | fusionada |
| FDN-075 prueba final | a05d809 | 234 pass | fusionada |

- **Ejecución de A0:** `node scripts/prueba-hibrida.mjs --estricto` con Revideo (junction temporal al motor de A1, eliminada después), Blender y FreeCut reales sobre `d94d757` → **8/8 superados**, 0 fallidos, 0 no ejecutados, en 8 min 20 s. El informe queda versionado en `examples/prueba-hibrida-10s/INFORME.md`.
- **FDN-073c:** revisión visual de A0 (fotograma 0: antes vacío; después, figura naranja) → candidato aprobado.
- El «fallo» de recovery que vio A1 no se reproduce en `develop` (3/3): es de su entorno.
- **Fases 6 y 7 cerradas.** FDN-092 queda desbloqueada (el usuario la pidió para después de la prueba híbrida).


## 2026-11-25 · `develop` → `main`: hito v0.1 (A0)
- **Aprobación del usuario** en el chat: «Sí, fusiona a main».
- `git branch main origin/main` (Initial commit 6c86237, ancestro de develop) → `git switch main` → `git merge --no-ff develop` → **`6ff846f`**. El árbol es idéntico al de `develop` (`git diff --stat develop main` vacío).
- **Verificado en `main`:** `npm run typecheck` OK; `npm test` → 234 pass, 18 skip, 0 fail al tercer intento. Los dos primeros fallaron en «publica una entrada completa con escrituras concurrentes» (FDN-070c, intermitente de la caché, más frecuente) → prioridad para Codex.
- **Sin push:** `main` y `develop` solo existen en local; el remoto sigue en el Initial commit.


## 2026-11-25 · Relevo de Codex (ADR-0013), ejecutado desde una sesión bifurcada de A0
- Aviso entre sesiones de la bifurcación `local_62488f53…`. El usuario declaró caído a Codex y pidió trasladar sus tareas a una sesión de Antigravity aparte. Cita: «codex se quedó sin cuota, traslada sus tareas a Antigravity … como un relevo en antigravity en otra sesion separada a la del equipo de antigravity».
- **Verificado por A0 en `FME-ops`:**
  - `equipos` → codex `caido`;
  - acta `20261125T080133842Z-codex-caida.md`, con dos `.patch` de los 9 archivos sin commit de FDN-063b;
  - `relevos/codex.md` registra el paso de FDN-063b, 070c y 073c a `antigravity-relevo`, con 2 reclamos liberados;
  - el prompt para el usuario está en `FME-ops/relevos/PROMPT-antigravity-relevo.md`.
- A0 lo refleja en BACKLOG, CURRENT_SPRINT y TEAM_STATUS. Cuando Codex vuelva: `reincorporar --equipo codex` y `turno --disponible`.
- La «ausencia de archivos» que vio la bifurcación fue el instante en que el checkout estaba en `main` (Initial commit), antes de `git merge --no-ff develop`. El checkout vuelve a estar en `develop` y completo.


## 2026-11-25 · Push a `origin` (A0)
- **Aprobación del usuario** en el chat: «Sí, haz push».
- **Revisión previa:** sin secretos versionados (`git ls-files` filtrado; las dos coincidencias son los archivos de medición de tokens), sin archivos de más de 1 MB, y las dos ramas en fast-forward (`git merge-base --is-ancestor`).
- `git push origin main develop` → `6c86237..6ff846f main`, `cd92a71..e7bf194 develop`. Sin `--force`.
- **Antecedente:** `origin/develop` ya existía en cd92a71 por un push del 2026-11-23 16:49 UTC sin autorización del usuario (probablemente Codex al volver). Queda anotado.


## 2026-11-25 · Integración 11 y preparación de la ausencia del usuario (A0)
- **ADR-0018:** `usuario --ausente` (escalón 1 inmediato) y avisos de cuota; test 10/10. ADR-0014 no se tocó: un ADR aceptado no se edita (una enmienda inicial se revirtió).
- **FDN-070c (Codex, a73aeed):** el test de concurrencia ya no falla; `npm test` 5/6, con otro intermitente («rechaza un enlace de directorio…»). Se integra como mejora y 070c sigue abierta en el relevo.
- **FDN-092 (A3) + sección `## Hitos` (A0, 45 hitos) + ADR-0019:** `progreso.mjs --check` → conforme; **PROGRESO.md: v0.1 28/34 (82 %)**, criterios 8/8, bloqueo humano FDN-005.
- **FDN-073c:** integrada la rama del relevo (incluye el commit de Codex); `tests/regresion` con motores reales → 3/3.
- Codex entregó 070c y 073c **antes** de su caída (07:44 y 07:46 frente a 08:01): la bifurcación relevó tareas que ya estaban en REVIEW; no hubo pérdida.


## 2026-11-25 · Integración 12, en ausencia del usuario (escalón 1, ADR-0014/0018) (A0)
Arranque por el «Continúa» único de A1. Solo se integraron REVIEW en verde, sin cambios de contrato ni dependencias nuevas:

| Rama | Verificación de A0 | Resultado |
|---|---|---|
| FDN-063c (A1) | 249 pass; `overlay-order.integration` con motor real 2/2 | fusionada |
| FDN-070c, relevo (bitácora) | 249 pass | fusionada → 070c DONE (8 npm test seguidos sin el fallo de concurrencia, según el relevo) |
| FDN-082 (AG, borrador de licencias en la bitácora) | 249 pass | fusionada; falta que A0 consolide `licencias-seguridad.md` |
| FDN-063b, relevo (camera.json de Blender) | 252 pass (un reintento por EPERM); `node --test packages/adapters/blender/test/*.test.ts` con Blender real → 10/10 | fusionada |

Abiertas: FDN-070d (otro intermitente de la caché) y FDN-063d (marcar `3d-with-2d` como yes). Ninguna decisión del usuario encolada. Sin push.


## 2026-11-25 · Vuelta del usuario (12,6 h) e integración 13 (A0)
- Vuelta registrada (escalón 3 → 0); cola de decisiones vacía; se dio el resumen al usuario.
- **FDN-070d** (relevo AG, f9c479c): solo el test (reintentos en la preparación con `rename` y en la limpieza); no debilita lo que comprueba. `npm test` 5/5 seguidos en verde → H-cache-robusta-windows [x].
- **Codex reincorporado** (`reincorporar --equipo codex`; `turno --disponible` para c0 y c0a). El usuario dijo que tiene la cuota de 5 h llena pero solo un 4 % de la semanal → **en reserva**, sin tareas nuevas.
- **FDN-082** consolidado en `docs/licencias-seguridad.md` (tabla de AG + lista de control antes de distribuir) → H-licencias-v01 [x].
- **FDN-063d** asignada a A1.


## 2026-11-25 · Spec v0.1 aprobada; v0.1 completa (A0)
- El usuario, en el chat de A0, ante la pregunta «¿Apruebas formalmente la especificación v0.1 (FDN-005)?»: **«Sí, la apruebo»**.
- FDN-005 DONE; H-spec-v01-aprobada [x]; Fase 0 cerrada formalmente; `progreso.mjs --check` conforme → **v0.1 34/34 hitos (100 %)**, criterios 8/8, sin bloqueos humanos.
