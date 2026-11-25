# Backlog maestro FDN

> **Dueño único: A0.** Los demás equipos **no** editan este archivo: envían un `evento` o una `solicitud` a `claude-code-a0` ([TASK_PROTOCOL.md](TASK_PROTOCOL.md)).
> Estados: `BACKLOG` · `READY` (sin dependencias pendientes) · `IN_PROGRESS` · `BLOCKED` · `REVIEW` · `DONE` (integrada en `develop` con evidencia) · `CANCELLED`.
> Equipos: **CL** (Claude: A0 Opus, A1/A2 Sonnet, A3 Haiku), **AG** (Antigravity: B0 Neon, B1/B2 Hydrogen), **CX** (Codex: C0, C1 y C2, Sol).
> _Última consolidación: 2026-11-25 (integración 11; `PROGRESO.md` v0.1 en el 82 %)._

## Resumen

| ID | Tarea | Equipo | Depende de | Estado |
|---|---|---|---|---|
| FDN-001 | Documentos FDN, CONTINUATION y prompts | CL-A0 | — | DONE (arranque) |
| FDN-002 | Carpeta operativa `FME-ops` + `coord.mjs` (eventos, solicitudes, raíz) | CL-A0 | — | DONE (arranque) |
| FDN-003 | Infraestructura de tests de paquetes + typecheck en verde | CL-A0 | — | DONE (arranque) |
| FDN-004 | Benchmarks verificados por modelo | CL-A3 | — | DONE (7cdfd04, VERIFICADO PARCIAL) |
| FDN-005 | Aprobación formal de la spec v0.1 | **Usuario** | — | BLOCKED (humano) |
| FDN-006 | `develop`, worktrees, política de índices | CL-A0 | 001–003 | DONE (arranque) |
| FDN-010 | Verificar Revideo | CL-A1 | 003 | DONE (6ee5826) |
| FDN-011 | Verificar Blender 5.2 headless | CX | — | DONE (b0a7db7; A0 reprodujo el SHA-256 de píxeles) |
| FDN-012 | Verificar FreeCut | AG | — | DONE (fcc4b49; A0 lo reprodujo) |
| FDN-013 | Sonda de medios `scripts/probe-media.mjs` | CL-A3 | 003 | DONE (f271d29) |
| FDN-014 | Cierre de la Fase 1 (criterio #1) | CL-A0 | 010, 011, 012 | DONE (criterio #1 ☑) |
| FDN-026 | `deserialize` aplica las migraciones (`migrateToCurrent`) | CL-A2 | 021, 024 | DONE (652f0e2) |
| FDN-070b | `DiskCache`: reintentar `rename` ante EPERM/EBUSY/EACCES en Windows (bug real; 1 de 5 en `npm test`) | CX | 070 | DONE (25f6b9c; A0: 6/6 `npm test` seguidos) |
| FDN-032b | Adaptador Revideo: usar `layer.text` (ADR-0012) en lugar de `requirements.text` | CL-A1 | 028, 032 | DONE (c9499f8) |
| FDN-034b | Tests de integración de Revideo seguros en paralelo (tmp-workdir frente a e2e) | CL-A1 | 033, 034 | DONE (c9499f8; A0 8/8 en paralelo ×3) |
| FDN-028 | Contenido de las capas `text` en el modelo universal (ADR-0012 + `schemaVersion` 2 + migración v1→v2) | CL-A2 | 021, 024, 026 | DONE (05a8e64) |
| FDN-034 | Revideo: temporales dentro de `ctx.workDir` (no en `os.tmpdir()`) | CL-A1 | 032 | DONE (ad7058e) |
| FDN-027 | ADR-0011: interfaz común de adaptadores y procedencia | CL-A0 | 030, 031 | DONE (b290224) |
| FDN-020 | ADR-0008: validación con Zod 4 | CL-A0 | — | DONE (propuesta escrita) |
| FDN-015 | `run.ps1` de Blender compatible con Windows PowerShell 5.1 | CX | 011 | DONE (d216597; A0 lo verificó en PS 5.1) |
| FDN-016 | Revideo: FFmpeg del sistema en lugar del binario GPLv3 de 2018 + `npm audit` (vite) + ADR-0010 | CL-A1 | 010 | DONE (c8ba756) |
| FDN-021 | Esquema Zod + validación + serialización de `Project` | CL-A2 | 003, 020 | DONE (b0325f9) |
| FDN-022 | Tiempo racional y timecode sin deriva | CX | 003 | DONE (026af28) |
| FDN-023 | Fixtures (incluida la híbrida de 10 s) + round-trip | CL-A2 | 021, 022 | DONE (1a35a36) |
| FDN-024 | Marco de migraciones + migración de ejemplo | CX | 021 | DONE (8cbdde3) |
| FDN-025 | Cierre de la Fase 2 (criterio #2) | CL-A0 | 023, 024, 026 | DONE (78d6f76, criterio #2 ☑) |
| FDN-030 | Registro dinámico de conectores + ADR-0009 | AG | 003 | DONE (4ee6910) |
| FDN-031 | Ejecución aislada de procesos (`runtime/workers`) | CX | 003 | DONE (e73f706) |
| FDN-032 | Adaptador Revideo real (JobRequest→JobResult con procedencia) | CL-A1 | 010, 021, 030, 031 | DONE (a88148d; job real 6/6 verificado por A0) |
| FDN-033 | Cierre de la Fase 3: descubrimiento → job real → procedencia, de extremo a extremo | CL-A1 (A0 valida) | 030, 032 | DONE (13606e6; Fase 3 cerrada) |
| FDN-040 | Adaptador Blender (nivel A) | CX | 011, 030, 031 | DONE (ab6e780; A0 verificó con Blender real 6/6) |
| FDN-041 | Adaptador FreeCut (nivel A, recomendado por FDN-012) | AG | 012, 030, 031 | DONE (7bdca83; A0: FreeCut real 7/7) |
| FDN-042 | Rutas A/B/C + `ExternalProjectRef`/`RenderArtifact` enlazados | a decidir | 021, 032, 040, 041 | DONE (042a/b/c) |
| FDN-043 | Cierre de la Fase 4 (criterio #3) | CL-A0 | 042 | DONE (criterio #3 ☑) |
| FDN-050 | Núcleo del router (8 pasos, modos, restricciones duras) con tarjetas simuladas | AG | 030 | DONE (3ef734e) |
| FDN-051 | Medición de tokens: tarjeta simple frente a avanzada | CL-A3 | 050 | DONE (3366479) |
| FDN-052 | Fallbacks con adaptadores reales | AG | 050, 043 | DONE (fba05eb) |
| FDN-053 | Cierre de la Fase 5 (criterios #4 y #5) | CL-A0 | 051, 052 | DONE (criterios #4 y #5 ☑) |
| FDN-060 | Dirección artística: perfiles de estilo y reglas | libre (el primero que quede libre) | 021 | DONE (b78af00, AG) |
| FDN-061 | Gradientes y técnicas → operaciones por backend | CL-A1 | 060, 032, 040 | DONE (ed40273; Revideo, A0: 9/9 con motor) |
| FDN-062 | Cierre de la Fase 6 (criterio #6) | CL-A0 | 061 | DONE (cierre de la F6) |
| FDN-070 | Caché con invalidación por dependencias | CX | 021, 031 | DONE (f3ad71f) |
| FDN-071 | Render por segmentos + preview adaptativa | CX | 070 | DONE (f6a8abb) |
| FDN-072 | Errores: falta de VRAM, reintento seguro, backend alternativo | libre | 070 | DONE (021582e) |
| FDN-073 | Suite técnica (temporal, estética, editabilidad, enrutamiento, recursos, seguridad, regresión) | a decidir | 043, 062, 071, 072 | BACKLOG |
| FDN-074 | Exportación final con audio y sincronía (criterio #7) | AG | 043, 071 | DONE (4cb1b60; criterio #7 ☑) |
| FDN-075 | Prueba híbrida de 10 s: informe único con los 8 criterios | CL-A2 (A0 valida) | 073, 074 | DONE (a05d809; A0: 8/8) |
| FDN-080 | Servidor MCP mínimo (`apps/mcp`) | CL-A2 | 021, 030, 050 | DONE (0348125) |
| FDN-081 | CLI (`apps/cli`) | CL-A2 | 080 | DONE (f87d164; A0: `job run` real 9/9) |
| FDN-090 | Protocolo de relevo entre equipos (equipo sin cuota → otro lo releva; reincorporación con nota de lo avanzado) + ADR-0013 | CL-A0 | — | DONE (ADR-0013 aceptada; `coord.mjs equipos/caida/relevar/reincorporar`) |
| FDN-042a | FreeCut: componer pistas y overlays (vídeo de fondo + MOV ProRes alpha + secuencia PNG RGBA) y exportar | AG | 041 | DONE (58c752b; A0: FreeCut real 14/14) |
| FDN-042b | `Project` guarda los `RenderArtifact` y los enlaza (ADR-0015 + `schemaVersion` 3 + migración) | CL-A2 | 028 | DONE (8aaa304; schemaVersion 3) |
| FDN-042c | Pipeline de la ruta híbrida: router → Revideo + Blender → FreeCut → vídeo final con fuentes enlazadas | CL-A1 | 042a, 042b | DONE (cb2d404; A0 lo reprodujo con 3 motores) |
| FDN-061b | Gradientes en Blender (mapeo propuesto en `art-direction/backends/blender.ts`) con métrica de píxeles | CX | 040, 061 | DONE (81bad19; A0: Blender real 7/7) |
| FDN-063 | Técnicas pendientes en los backends: `2.5d`, `3d-with-2d` y `guide3DLayerId` (2D guiado por cámara 3D) | CL-A1 | 061, 061b | DONE (ab8b76e; 3d-with-2d parcial → 063b/063c) |
| FDN-073a | Pruebas técnicas independientes de la ruta: seguridad (rutas, comandos, permisos) y regresión de salidas por hash de contenido | CX | 040, 041, 032 | DONE (b5bfe85; 3 TODO → 073b) |
| FDN-074a | Audio en `edit.compose`: pista de audio, sample rate explícito y sincronía A/V medida | AG | 042a | DONE (ea2df61) |
| FDN-080b | MCP y CLI: `preview.render` y `project.export` reales (render-plan + adaptadores), sin simular | CL-A2 | 071, 080, 081 | DONE (991f1f5) |
| FDN-074b | FreeCut: tratar `ATOMIC_REPLACE_UNAVAILABLE` (EPERM en `.freecut-headless/atomic-test`, ~1 de cada 6) como transitorio y reintentar el job | AG | 074a | DONE |
| FDN-073b | Endurecimiento: `--root` en la CLI, raíces de anfitrión en las llamadas directas a Revideo y FreeCut, y raíces permitidas en `edit.compose` (los 3 TODO de 073a) | CX | 073a | DONE (d7c625e; 0 TODO) |
| FDN-075a | Criterio #8: reabrir el proyecto, cambiar una capa y re-renderizar **solo** lo afectado (caché + render-plan en el pipeline) | CL-A1 | 042c, 070, 071 | DONE (d68149e; A0: criterio #8 reproducido) |
| FDN-080c | `project.export` real en MCP y CLI con `@fme/pipeline` | CL-A2 | 042c, 080b | DONE (7a873f1) |
| FDN-070c | `DiskCache`: el test «escrituras concurrentes» sigue fallando con la suite completa en carga (~1 de cada 5); revisar el presupuesto de reintentos o el diseño del test | CX | 070b | IN_PROGRESS (a73aeed integrada: concurrencia resuelta; queda el intermitente «rechaza un enlace de directorio» → relevo AG) |
| FDN-073c | Regresión: actualizar `tests/regresion/expected/revideo.json` (la referencia se fijó con el SVG vacío, antes de la corrección de cb2d404) según el procedimiento de 073a | CX | 073a, 042c | DONE (f2e4e19 relevo + 1cbb1a0 Codex; regresión real 3/3) |
| FDN-092 | Trazabilidad por hitos (propuesta v2 del asistente a0s): ADR-0017, § Hitos en BACKLOG, `scripts/progreso.mjs` + `PROGRESO.md` | A0 + A3 | 075 | DONE (df7077e; A0 escribió la sección Hitos y ADR-0019) |
| FDN-063b | Blender exporta `camera.json` nativo (posición del modelo en pantalla por fotograma) para `guide3DLayerId` | CX | 063 | RELEVADA → AG-relevo (Codex caído, 2026-11-25; .patch con 9 archivos sin commit en el acta) |
| FDN-063c | `3d-with-2d` integrado en `runHybrid` (overlay 2D sobre el render 3D en la composición) | CL-A1 | 063 | READY |
| FDN-091 | Modo ausencia del usuario (ADR-0014) | CL-A0 | 090 | DONE |
| FDN-082 | Auditoría de licencias de las versiones fijadas | CL-A0 (continua) | — | IN_PROGRESS |

---

## Hitos

> Trazabilidad por hitos (ADR-0019). **Solo A0** la edita; los hitos menores de B0 y C0 viven en `FME-ops/hitos/<equipo>.md` y A0 los consolida aquí. Un hito es algo que debe ser cierto en `develop`, con evidencia. Las tareas «aportan» a uno o varios hitos.
> `PROGRESO.md` lo genera `node scripts/progreso.mjs`; `--check` bloquea la integración de A0 si hay incoherencias. Largo plazo: catálogo condicionado, fuera del %.

| id | plazo | parte | fase | clase | estado | evidencia | aportan |
|---|---|---|---|---|---|---|---|
| H-spec-v01-aprobada | 1 | 1.A | 0 | critico | [ ] | — | 005 |
| H-red-fdn-operativa | 1 | 1.A | 0 | normal | [x] | bitácora A0 2026-11-22..25; ADR-0007, 0013, 0014, 0016, 0017, 0018 y 0019 | 001, 002, 003, 004, 006, 090, 091, 092 |
| H-criterio-1 | 1 | 1.B | 1 | critico | [x] | pruebas-aceptacion #1 | 010, 011, 012, 013, 014, 015, 016 |
| H-criterio-2 | 1 | 1.B | 2 | critico | [x] | pruebas-aceptacion #2 | 020, 021, 022, 023, 024, 025, 026, 028 |
| H-cierre-f3-job-e2e | 1 | 1.C | 3 | critico | [x] | roadmap F3 (FDN-033 E2E) | 027, 030, 031, 032, 032b, 033, 034, 034b |
| H-adaptadores-reales | 2 | 2.A | 4 | normal | [x] | FDN-040/041 con motores reales (bitácora A0) | 040, 041 |
| H-artefactos-enlazados | 2 | 2.A | 4 | normal | [x] | schemaVersion 3, ADR-0015 | 042b |
| H-composicion-alpha | 2 | 2.A | 4 | normal | [x] | FreeCut real 14/14 (bitácora A0) | 042a |
| H-criterio-3 | 2 | 2.A | 4 | critico | [x] | pruebas-aceptacion #3 | 042, 042c, 043 |
| H-router-nucleo | 2 | 2.B | 5 | normal | [x] | FDN-050 | 050 |
| H-medicion-tokens | 2 | 2.B | 5 | normal | [x] | FDN-051 (222 frente a 503 tok) | 051 |
| H-fallbacks-reales | 2 | 2.B | 5 | normal | [x] | real-fallbacks 3/3 (A0) | 052, 074b |
| H-criterio-4 | 2 | 2.B | 5 | critico | [x] | pruebas-aceptacion #4 | 052, 053 |
| H-criterio-5 | 2 | 2.B | 5 | critico | [x] | pruebas-aceptacion #5 | 052, 053 |
| H-perfiles-estilo | 2 | 2.B | 6 | normal | [x] | FDN-060 | 060 |
| H-criterio-6 | 2 | 2.B | 6 | critico | [x] | pruebas-aceptacion #6 | 061, 061b |
| H-tecnicas-compuestas | 2 | 2.B | 6 | normal | [x] | FDN-063: parallax 0,50/0,25; seguimiento < 1 px | 063 |
| H-guia-3d-nativa | 2 | 2.B | 6 | normal | [ ] | — | 063b |
| H-3d-con-2d-en-pipeline | 2 | 2.B | 6 | normal | [ ] | — | 063c |
| H-cierre-f6 | 2 | 2.B | 6 | critico | [x] | roadmap F6 cerrada 2026-11-25 | 062 |
| H-cache-segmentos-preview | 2 | 2.C | 7 | normal | [x] | FDN-070/070b/071 | 070, 070b, 071 |
| H-cache-robusta-windows | 2 | 2.C | 7 | normal | [ ] | — | 070c |
| H-recuperacion-errores | 2 | 2.C | 7 | normal | [x] | FDN-072 | 072 |
| H-audio-sync-compose | 2 | 2.C | 7 | normal | [x] | FDN-074a: desfase 0 ms | 074a |
| H-seguridad-regresion | 2 | 2.C | 7 | normal | [x] | tests/seguridad 10/10, 0 TODO | 073a, 073b |
| H-regresion-actualizada | 2 | 2.C | 7 | normal | [x] | tests/regresion 3/3 con motores reales (A0) | 073c |
| H-criterio-7 | 2 | 2.C | 7 | critico | [x] | pruebas-aceptacion #7 | 074, 080c |
| H-criterio-8 | 2 | 2.C | 7 | critico | [x] | pruebas-aceptacion #8 | 075a |
| H-prueba-hibrida-10s | 2 | 2.C | 7 | critico | [x] | INFORME.md 8/8 (A0, 2026-11-25) | 075 |
| H-mcp-minimo | 2 | 2.C | T | normal | [x] | FDN-080 | 080 |
| H-cli | 2 | 2.C | T | normal | [x] | FDN-081 | 081 |
| H-mcp-preview-real | 2 | 2.C | T | normal | [x] | FDN-080b | 080b |
| H-export-real | 2 | 2.C | T | normal | [x] | FDN-080c | 080c |
| H-licencias-v01 | 2 | 2.C | T | normal | [ ] | — | 082 |
| H-largo-acabado-artesanal | 3 | 3.A | 8 | normal | [ ] | — | — |
| H-largo-edicion-vfx | 3 | 3.A | 8 | normal | [ ] | — | — |
| H-largo-color | 3 | 3.A | 8 | normal | [ ] | — | — |
| H-largo-interoperabilidad | 3 | 3.B | 8 | normal | [ ] | — | — |
| H-largo-audio | 3 | 3.B | 8 | normal | [ ] | — | — |
| H-largo-rendimiento | 3 | 3.B | 8 | normal | [ ] | — | — |
| H-largo-forks | 3 | 3.B | 8 | normal | [ ] | — | — |
| H-largo-interfaz | 3 | 3.C | 8 | normal | [ ] | — | — |
| H-largo-escala | 3 | 3.C | 8 | normal | [ ] | — | — |
| H-largo-comercializacion | 3 | 3.C | 8 | normal | [ ] | — | — |
| H-largo-productizacion | 3 | 3.C | 8 | normal | [ ] | — | — |

## Fichas de las tareas READY

Cada ficha es el contrato de la tarea: si algo no está aquí, pregúntalo antes de hacerlo. **Rutas autorizadas** = las únicas que puedes crear o modificar (más tu propia bitácora `docs/bitacora/AAAA-MM-DD-<id>-<tema>.md`).

### FDN-004 · Benchmarks verificados (CL-A3, Haiku 5.5)
- **Objetivo:** sustituir los datos POR VALIDAR de [BENCHMARKS.md](BENCHMARKS.md) por datos con fuente.
- **Rutas:** `coordinacion/BENCHMARKS.md` **solo en tu rama** (`fdn/FDN-004-benchmarks`). A0 lo revisa y lo fusiona.
- **Método:** lee las fuentes oficiales de los prompts (model cards de Anthropic, Google DeepMind y OpenAI). Para cada benchmark (Terminal-Bench 4.0 y 4.1, FrontierCode, CursorBench, SWE-bench, OSWorld, AutomationBench, Agents' Last Exam, Humanity's Last Exam) documenta las 9 dimensiones de la plantilla.
- **Aceptación:** cada número tiene URL y fecha de consulta. Lo que no encuentres queda «no publicado». No comparas TB 4.0 con 4.1. No inventas cifras.

### FDN-010 · Verificar Revideo (CL-A1, Sonnet 5.5)
- **Objetivo:** demostrar que Revideo renderiza en la PC de referencia (criterio #1, parte Revideo).
- **Rutas:** `examples/fase1/revideo/**`. Es un proyecto npm **aislado**, con su propio `package.json` y lockfile, que **no** se añade a los `workspaces` de la raíz.
- **Pasos:** revisar la actividad upstream (releases e issues de https://github.com/midrender/revideo) → fijar la versión exacta → escena TS de 3 s a 30 FPS (90 fotogramas) con un rótulo y un vector animado → render a MP4 → si es posible, secuencia PNG con alpha → script repetible `run.ps1` o `npm run verify` → medir tiempo, RAM y VRAM (`nvidia-smi`).
- **Entregables:** `RESULTADOS.md` (comando, versión, salida, tiempo, recursos, limitaciones de alpha/FPS/timebase y licencia verificada), `card.simple.json` y `card.advanced.json` con `yes`/`no`/`unknown` **reales**. La salida va a `examples/fase1/revideo/out/` (ignorada por git) con el hash SHA-256 anotado.
- **Aceptación:** otra sesión ejecuta el script desde cero y obtiene el MP4. `ffprobe` confirma 90 fotogramas a 30 FPS.

### FDN-011 · Verificar Blender 5.2 headless (CX)
- **Objetivo:** criterio #1, parte Blender.
- **Rutas:** `examples/fase1/blender/**`.
- **Entorno:** `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe` (no está en el PATH). Anota la versión con `blender --version`.
- **Pasos:** script `bpy` que construye la escena desde código (un objeto, luz y cámara con animación de 90 fotogramas a 30 FPS) → render `blender -b -P` a secuencia PNG **RGBA** con fondo transparente, a una resolución prudente para 4 GB de VRAM (p. ej. 960×540; documenta motor y muestras) → script repetible `run.ps1` → medir tiempo/fotograma, VRAM y RAM.
- **Entregables:** `RESULTADOS.md`, `card.simple.json` y `card.advanced.json`. Salida en `examples/fase1/blender/out/` (ignorada), con hash.
- **Aceptación:** ejecución repetible desde cero. `ffprobe` o PIL confirman el canal alpha en los PNG. El script no ejecuta código que no esté en el repo.

### FDN-012 · Verificar FreeCut (AG)
- **Objetivo:** criterio #1, parte FreeCut, y responder al riesgo n.º 1 (¿existe una API o automatización estable?).
- **Rutas:** `examples/fase1/freecut/**`. El clon de FreeCut va **fuera del repo**, en `C:\Users\bogex\Documents\Forgex\FME-ext\freecut\`.
- **Pasos:** revisar la actividad upstream (https://github.com/walterlow/freecut) → fijar el commit o tag → ejecutar en local → importar un clip de prueba (generado con FFmpeg, p. ej. `testsrc2` de 5 s) → exportar un MP4 → **documentar con precisión qué automatización existe**: API pública, formato de proyecto en disco, importación/exportación por archivo, o solo la UI (automatizable con el navegador).
- **Entregables:** `RESULTADOS.md` (incluye la recomendación de nivel A o B para el adaptador FDN-041), `card.simple.json` y `card.advanced.json`, y el script repetible de lo que sea automatizable.
- **Aceptación:** MP4 exportado y verificado con `ffprobe`. El formato de proyecto queda descrito con un ejemplo real. Lo que solo funciona a mano se dice explícitamente.

### FDN-021 · Esquema, validación y serialización de `Project` (CL-A2, Sonnet 5.5)
- **Objetivo:** que `Project` se valide y se guarde/abra sin pérdida (base del criterio #2).
- **Rutas:** `packages/project/src/schema.ts`, `packages/project/src/serialize.ts`, `packages/project/test/schema.test.ts`, `packages/project/test/serialize.test.ts`, `packages/project/package.json` (dependencia `zod` con `--save-exact`) y `package-lock.json`. **No** toques `packages/project/src/index.ts`: A0 añade las re-exportaciones al integrar.
- **Decisión de referencia:** [ADR-0008](../docs/decisiones/0008-validacion-runtime-con-zod.md).
- **Aceptación:**
  - los tipos derivados de Zod son asignables a los de `index.ts` y viceversa (test de tipos con `tsc`);
  - `parseProject(json)` devuelve `{ ok, value }` o errores con ruta y mensaje;
  - un `schemaVersion` desconocido da un error estructurado;
  - `serialize`/`deserialize` hacen round-trip estable (orden de claves determinista);
  - fotogramas enteros ≥ 0 y `fps.num`/`fps.den` enteros positivos;
  - `npm run typecheck` y `npm test` en verde;
  - fila de Zod en `docs/licencias-seguridad.md`, comunicada a A0 por evento (no edites el archivo).

### FDN-022 · Tiempo racional (CX)
- **Objetivo:** conversiones de tiempo sin deriva.
- **Rutas:** `packages/project/src/time.ts` y `packages/project/test/time.test.ts`. Sin dependencias nuevas. **No** toques `index.ts`.
- **Contenido:** `framesToSeconds`, `secondsToFrames` (con política de redondeo explícita), `framesToTimecode`/`timecodeToFrames` (incluido el drop-frame para 30000/1001), `rescaleFrames(frames, fpsA, fpsB)` con aritmética entera o `BigInt` y validación de `Fps`. Usa el tipo `Fps` de `index.ts`.
- **Aceptación:** tests de propiedad sencillos (ida y vuelta para 24, 25, 30, 60 y 30000/1001 en 1 h de fotogramas sin error acumulado) y `npm run typecheck` + `npm test` en verde.

### FDN-030 · Registro de conectores (AG)
- **Objetivo:** registro dinámico del contrato v0.1 (Fase 3, sin adaptadores reales).
- **Rutas:** `packages/connectors/src/registry.ts`, `packages/connectors/test/registry.test.ts` y `docs/decisiones/0009-api-registro-conectores.md` (ADR nuevo con estado `propuesta`). **No** toques `index.ts` ni cambies los tipos existentes. Si necesitas un tipo nuevo, decláralo en `registry.ts` y justifícalo en el ADR.
- **Contenido:** `register(simple, advanced?)`, `unregister(id)`, `listSimple(filter?)` por capacidad, `accepts` y `produces`, y `inspect(id, sections[])`, que devuelve **solo** las secciones pedidas de la tarjeta avanzada. Semántica `yes`/`no`/`unknown`: un filtro por un requisito técnico **nunca** trata `unknown` como `yes`; lo marca como «requiere inspección». Rechaza un `contractVersion` incompatible.
- **Aceptación:** tests de alta y baja, duplicados, filtros, `unknown` y secciones; `npm run typecheck` + `npm test` en verde.

---

## Fichas de la Tanda 10 (READY desde el 2026-11-23, integración 9): último criterio y prueba final

### FDN-074 · Exportación híbrida con audio y sincronía medida (AG) → criterio #7
- **Rutas:** `packages/pipeline/test/av-sync.integration.test.ts` y, si hace falta, `packages/adapters/freecut/**`. Coordina con A1 cualquier cambio en `packages/pipeline/src` mediante una `solicitud` a A0.
- **Hacer:** variante de la fixture híbrida con un fondo que tenga **destellos de vídeo y pulsos de audio** sincronizados (p. ej. a los fotogramas 30, 150 y 270). Exportar con `project.export` (`@fme/pipeline`) y medir con `measureAvSync` (FDN-074a) en el MP4 final: arranque de los streams, desfase por pulso y deriva entre el primero y el último.
- **Aceptación (criterio #7):**
  - 300 fotogramas con audio a 48 kHz;
  - desfase ≤ 1 fotograma (33 ms) en los 3 pulsos;
  - deriva < 1 fotograma a lo largo de los 10 s;
  - con los motores reales; skip con motivo sin ellos.

### FDN-075 · Prueba híbrida final con los 8 criterios (CL-A2; A0 valida)
- **Rutas:** `scripts/prueba-hibrida.mjs` y `examples/prueba-hibrida-10s/INFORME.md` (generado).
- **Hacer:** un único comando que ejecuta, con los motores reales, la cadena que respalda cada criterio:
  - #1: las tres pruebas de la F1;
  - #2: round-trip;
  - #3: el pipeline;
  - #4 y #5: el router sobre las tarjetas reales;
  - #6: los gradientes;
  - #7: la sincronía, cuando entre FDN-074;
  - #8: el re-render incremental.
  - Genera un informe con el comando, el resultado, el tiempo y el hash de cada paso, y las versiones de los motores. Sin motor, el criterio sale «no ejecutado», nunca «superado».
- **Aceptación:** el informe es reproducible. A0 lo ejecuta y obtiene 8/8 (o 7/8 con #7 pendiente de FDN-074).

### FDN-063 · Técnicas compuestas (CL-A1) → cierre de la Fase 6
- **Rutas:** `packages/art-direction/src/backends/**`, `packages/adapters/revideo/**` y `runtime/engines/revideo/**`. Lo de Blender, mediante una `solicitud`.
- **Hacer:** `2.5d` (planos con parallax por profundidad), `3d-with-2d` (overlay 2D sobre un render 3D) y `guide3DLayerId` (la animación 2D sigue la cámara o un objeto de la capa 3D guía, con datos de cámara exportados desde Blender como JSON). Cada técnica, con una métrica de píxeles o de posición verificable.
- **Aceptación:** test real por técnica con métrica, y skip con motivo sin motor.

### FDN-070c · Caché: test de concurrencia en carga (CX)
- **Evidencia (A0 y A2):** con `npm test` completo, «publica una entrada completa con escrituras concurrentes» falla ~1 de cada 5 (4,3 s); aislado pasa. Probablemente el presupuesto de reintentos (~1 s) se agota con la máquina cargada por los tests de motor.
- **Hacer:** diagnosticar y corregir, en el código (presupuesto adaptativo o espera hasta que se libere el destino) o en el test (aislarlo de la carga, sin debilitar lo que comprueba).
- **Aceptación:** `npm test` 8 veces seguidas sin ese fallo.

### FDN-073c · Actualizar la referencia de regresión de Revideo (CX)
- Seguir el procedimiento de FDN-073a para actualizar `tests/regresion/expected/revideo.json`. La referencia antigua se fijó con el SVG vacío; la corrección de A1 (cb2d404) ya lo dibuja. Adjunta el fotograma de antes y después en la bitácora para que A0 lo valide.

## Fichas de la Tanda 9 (READY desde el 2026-11-23, integración 8): hacia la prueba híbrida completa

Quedan los criterios **#4 y #5** (router), **#7** (exportación con audio y sincronía) y **#8** (cambiar una parte sin rehacerlo todo).

### FDN-075a · Cambio parcial sin rehacer todo (CL-A1) → criterio #8
- **Rutas:** `packages/pipeline/**` (y `packages/render-plan` o `packages/cache` solo mediante una `solicitud`).
- **Hacer:**
  - `runHybrid` usa `DiskCache` + `dependencyHash` por capa o segmento (de `@fme/render-plan`): la segunda ejecución sin cambios no re-renderiza nada;
  - al cambiar el texto o un canal de una capa, solo se re-renderizan esa capa y la composición final;
  - los artefactos no afectados conservan su `dependencyHash` y su archivo;
  - «reabrir la fuente externa»: el `ExternalProjectRef` de la capa permite volver a su documento nativo (escena de Revideo o script/parámetros de Blender) y cambiarlo.
- **Aceptación (criterio #8):** con los motores reales, la ejecución 1 es completa; la 2 sin cambios ejecuta 0 jobs de motor; la 3, tras cambiar el texto del título, ejecuta 1 job de Revideo + la composición, y el resto viene de la caché (contado en la procedencia). Además, el vídeo final cambia **solo** en el rango del título (diferencia de píxeles fuera de 180–299 = 0 o despreciable, con el umbral declarado).

### FDN-080c · `project.export` real (CL-A2)
- **Rutas:** `apps/mcp/**` y `apps/cli/**`.
- **Hacer:** `project.export` (MCP) y `fme project export` (CLI) llaman a `runHybrid` de `@fme/pipeline`, con validación de rutas en la raíz, `ENGINE_UNAVAILABLE` sin motor y progreso por pasos en la salida JSON.
- **Aceptación:** con los motores reales, la exportación de la fixture híbrida produce el MP4 de 300 fotogramas y el proyecto enlazado; sin motor, skip con motivo.

### FDN-052 · Fallbacks con adaptadores reales (AG) → base de los criterios #4 y #5
- **Rutas:** `packages/router/**` y `packages/recovery/**`.
- **Hacer:** con el registro de los **tres adaptadores reales** (tarjetas de `packages/adapters/*/src/cards.ts`), demostrar:
  - (#4) que el router elige una ruta compatible leyendo primero solo las tarjetas simples;
  - (#5) que solo inspecciona secciones avanzadas cuando una restricción crítica lo exige (p. ej. alpha);
  - y el fallback real: si un adaptador falla (`probe` no disponible o error del motor), `@fme/recovery` usa la alternativa compatible o escala al usuario si no la hay.
- **Aceptación:** tests con las métricas del router (`simpleCardsRead`, `advancedSectionsRequested`) sobre las tarjetas reales, y un test con motor real que fuerza un fallo y comprueba el fallback, con skip con motivo sin motor.

### FDN-074b · FreeCut: `ATOMIC_REPLACE_UNAVAILABLE` transitorio (AG)
- **Evidencia (A0):** `npm test` 1 de cada 6 falla en `audio-sync.integration.test.ts:214` con `ATOMIC_REPLACE_UNAVAILABLE … EPERM … rename '….freecut-headless\.atomic-test.<pid>.<uuid>.tmp' -> '…atomic-test'`. Es la comprobación de arranque del headless de FreeCut (upstream); en Windows otro proceso bloquea el archivo un instante.
- **Hacer (sin forkear FreeCut):** el adaptador clasifica ese código como transitorio y reintenta el job completo con un `workDir` nuevo (hasta 3 veces, con backoff); el diagnóstico conserva los intentos.
- **Aceptación:** `npm test` 6 veces seguidas sin ese fallo, con el comando citado.

### FDN-073b · Endurecimiento de rutas (CX)
- **Rutas:** `apps/cli/src/**`, `packages/adapters/{revideo,freecut}/src/**` (solo validación de rutas; avisa a sus dueños, A1 y AG, por mensaje) y `tests/seguridad/**`.
- **Hacer:** los 3 TODO de FDN-073a:
  - `--root` en la CLI, validado como en MCP;
  - opción `allowedRoots` en los adaptadores Revideo y FreeCut cuando se llaman directamente;
  - raíces permitidas para las entradas de `edit.compose`.
- **Aceptación:** los 3 TODO pasan a tests en verde y el resto de la suite sigue en verde.

## Fichas de la Tanda 8 (READY desde el 2026-11-23, integración 7)

### FDN-042c · Pipeline de la prueba híbrida (CL-A1) → criterio #3
- **Rutas:** `packages/pipeline/**` (workspace `@fme/pipeline`; A0 añade la referencia y el lockfile).
- **Hacer:** `runHybrid(projectPath, outDir)`:
  1. abre el proyecto con `deserialize` (v3);
  2. planifica cada capa con `planWorkflow` de `@fme/router` sobre un registro con los **tres adaptadores reales**;
  3. ejecuta: título y 2D → Revideo (MOV ProRes alpha); capa 3D → Blender (PNG RGBA); como FreeCut no acepta `image/png-sequence` (hallazgo de FDN-042a), la secuencia se **precodifica a ProRes 4444** con FFmpeg mediante `runIsolated`, y queda registrado como paso propio con su procedencia; fondo y composición final → FreeCut `edit.compose`;
  4. registra todo en `project.artifacts` (v3) y enlaza `renderArtifactId` en cada capa;
  5. guarda el `project.fme.json` resultante junto al MP4.
  - Los assets de la fixture son URIs de ejemplo: el test genera un fondo real con FFmpeg (`testsrc2` + audio `sine`) y usa el primitivo de sustitución de Blender si falta el modelo, avisando en los diagnósticos.
- **Aceptación (criterio #3):**
  - MP4 final de 300 fotogramas a 30 FPS (`probe-media`);
  - una métrica de píxeles confirma cada capa **en su rango** (título 180–299, 3D 105–254, 2D 30–239);
  - el proyecto resultante pasa `parseProject` y cada `renderArtifactId` resuelve;
  - los tres adaptadores aparecen en la procedencia;
  - skip con motivo si falta algún motor;
  - A0 lo reproduce.

### FDN-073a · Pruebas de seguridad y regresión (CX)
- **Rutas:** `tests/seguridad/**` y `tests/regresion/**` (nuevas carpetas en la raíz; añade el glob al script de test en el REVIEW como «pendiente de A0», sin editar `package.json`).
- **Hacer:**
  - **Seguridad:** cada adaptador y `runIsolated` rechazan rutas fuera de `workDir` o de la raíz, `..`, junctions y argumentos con metacaracteres de shell; MCP y CLI rechazan proyectos fuera de la raíz configurada; ningún adaptador ejecuta código recibido en el `JobRequest`.
  - **Regresión:** `contentSha256` de referencia por adaptador para un job fijo (`expected/*.json`), con un procedimiento documentado para actualizarlo solo tras una revisión de A0.
- **Aceptación:** tests en verde y skips con motivo sin motor; un cambio deliberado de un parámetro rompe la regresión (demostrado en el informe).

### FDN-074a · Audio en la composición (AG)
- **Rutas:** `packages/adapters/freecut/**` y `runtime/engines/freecut/**`.
- **Hacer:** `edit.compose` admite pistas de audio (del vídeo de fondo y archivos WAV), con sample rate explícito (48 kHz), y mide la sincronía A/V en el MP4 resultante (inicio de audio frente a vídeo, con `ffprobe`, y un pulso sincronizado con un destello de vídeo).
- **Aceptación:** desfase A/V ≤ 1 fotograma (33 ms a 30 FPS) medido y documentado; skip con motivo sin FreeCut.

### FDN-080b · `preview.render` y `project.export` reales (CL-A2)
- **Rutas:** `apps/mcp/**` y `apps/cli/**`.
- **Hacer:** sustituir los «no implementado»:
  - `preview.render`: `@fme/render-plan` (perfil de preview para 4 GB) + adaptadores, para un rango de fotogramas o una capa;
  - `project.export`: si existe `@fme/pipeline` (FDN-042c), lo usa; si no, sigue devolviendo «no implementado».
  - Reutiliza la lógica entre MCP y CLI (resuelve la duplicación que señalaste en FDN-081).
- **Aceptación:** `preview.render` de la capa de título produce un MP4 a resolución de preview (verificado con `probe-media`, real con el motor) y tests sin motor con skip.

## Fichas de la Tanda 7 (READY desde el 2026-11-23, integración 6): Fase 4, integración real

Objetivo de la fase: **criterio #3**, «los tres adaptadores ejecutan trabajos reales», y un vídeo final con las fuentes enlazadas. Los tres adaptadores ya existen y están verificados con motores reales. Falta **componer** sus salidas.

### FDN-042a · FreeCut compone pistas y overlays (AG)
- **Rutas:** `packages/adapters/freecut/**` y `runtime/engines/freecut/**`.
- **Hacer:** operación `edit.compose`. Recibe un proyecto FME con varias capas de una escena (vídeo de fondo, overlay con alpha en MOV ProRes de Revideo y secuencia PNG RGBA de Blender) y los artefactos de entrada en `inputs[]`. Construye el proyecto FreeCut con una pista por capa (orden por `zIndex`, `startFrame` y duración) y exporta el MP4. Si FreeCut **no admite** alpha en alguna entrada, dilo con un diagnóstico `unsupported-alpha` y propón la alternativa (premultiplicar o componer antes con FFmpeg), **sin simular**.
- **Aceptación:**
  - con fixtures generadas (FFmpeg: fondo `testsrc2` + overlay `color` con alpha), el MP4 final tiene la duración y los fotogramas esperados;
  - una métrica de píxeles demuestra que el overlay aparece **solo** en su rango;
  - `checkAdapterResult` = [];
  - skip con motivo sin FreeCut.

### FDN-042b · Artefactos enlazados en el proyecto (CL-A2; contrato)
- **Rutas:** `docs/decisiones/0015-artefactos-en-el-proyecto.md` (propuesta), `packages/project/src/{schema,migrate}.ts`, `packages/project/test/**` y las fixtures. El diff de `index.ts` se pide a A0 con una `solicitud`, como en FDN-028.
- **Hacer:** `Project.artifacts?: RenderArtifact[]` (el tipo ya existe en `index.ts`) y validación referencial: cada `layer.externalProject.renderArtifactId` debe existir en `artifacts`. `schemaVersion` 3 con migración v2→v3 (conservando v0→v1→v2). Fuente del caso: FDN-033 dejó `workDir/artifacts.json` por esta carencia.
- **Aceptación:**
  - las fixtures v0, v1 y v2 migran a v3;
  - un `renderArtifactId` colgante da un error con ruta;
  - el round-trip es byte a byte;
  - `codegraph impact parseProject` revisado con todos los consumidores (adapters, mcp, cli, art-direction, cache, render-plan y recovery) en verde.

### FDN-061b · Gradientes en Blender (CX)
- **Rutas:** `packages/adapters/blender/**`, `runtime/engines/blender/**` y, si hace falta, `packages/art-direction/src/backends/blender.ts` (avisa a A1 por mensaje si cambias el mapeo).
- **Hacer:** aplicar `expression` e `integration` según el vocabulario propuesto por A1 (mezcla de material e intensidad de outline/Freestyle o equivalente) y medirlo en el render.
- **Aceptación:** una métrica de píxeles monótona con la curva en 3 o más fotogramas, con Blender real; skip con motivo sin Blender.

## Fichas de la Tanda 6 (READY desde el 2026-11-23, integración 5)

### FDN-061 · Gradientes y técnicas → operaciones por backend (CL-A1)
- **Rutas:** `packages/art-direction/src/backends/**` y `packages/art-direction/test/backends.test.ts` (nuevos; no cambies la API existente de `@fme/art-direction` sin una `solicitud`), y `packages/adapters/revideo/src/mapping.ts` + `packages/adapters/blender/src/**` **solo** si hace falta consumir los canales `expression` e `integration` (en Blender, coordina el diff con una `solicitud` a A0: el código es de Codex).
- **Hacer:** traducir los dos gradientes (`expression`, `integration`; spec §4) y las técnicas a operaciones concretas y **observables** por backend. Ejemplos: Revideo → amplitud del trazo, jitter u opacidad del contorno; Blender → mezcla de material o intensidad de outline/Freestyle. Documenta la tabla de mapeo en `packages/art-direction/README.md`.
- **Aceptación (base del criterio #6):** un render real en el que el gradiente cambia una propiedad visual medible a lo largo del tiempo. Por ejemplo, una métrica de píxeles (luminancia media o anchura de borde) en los fotogramas 0, 60 y 120 debe variar de forma monótona con la curva. Test con el motor real y skip con motivo sin él.

### FDN-081 · CLI de consola (CL-A2)
- **Rutas:** `apps/cli/**` (`@fme/cli`; `apps/*` ya está en los workspaces; A0 añade la referencia y el lockfile).
- **Hacer:** CLI sobre la **misma** API que `apps/mcp` (sin duplicar la lógica: reutiliza lo que exporte `@fme/mcp` o los paquetes del núcleo). Comandos: `project validate <archivo>`, `project migrate <archivo>`, `connectors list`, `route plan <archivo> --layer <id>` y `job run <archivo> --layer <id> --out <dir>`. Salida JSON con `--json` y códigos de salida distintos de 0 en caso de error. Sin dependencias nuevas (`node:util` `parseArgs`).
- **Aceptación:** tests que ejecutan la CLI como proceso sobre la fixture híbrida; `job run` hace skip con motivo si no hay motor.

## Fichas de la Tanda 5 (READY desde el 2026-11-23, integración 4)

Base: `develop` ≥ el commit de la integración 4 (`schemaVersion` **2**). **Regla nueva para los adaptadores y el router:** para leer un proyecto se usa `deserialize` (o `migrateToCurrent` sobre el JSON ya parseado), nunca `parseProject` directamente, porque así se aceptan versiones anteriores migrables.

### FDN-040 (devuelta) · Adaptador Blender con `schemaVersion` 2 (CX)
- **Motivo:** al fusionar con `develop` (v2), `adapter.test.ts` falla con `BLENDER_INVALID_JOB … schemaVersion 1 no soportado; esta versión entiende 2`.
- **Hacer:** `git merge develop` en `fdn/FDN-040-adapter-blender` (sin rebase); leer el proyecto con `deserialize`/`migrateToCurrent`; mantener el test de la fixture v1 (ahora como migración) y añadir la v2.
- **Aceptación:** la rama se fusiona con `develop` limpia, `npm test` está en verde y los 5 tests con Blender real siguen pasando.

### FDN-070b · `DiskCache` en Windows (CX)
- **Evidencia (A0):** `npm test` 1 de 5 → `EPERM: operation not permitted, rename '…\.cache-<uuid>.tmp' -> '…\<sha>.bin'` en «publica una entrada completa con escrituras concurrentes». Windows rechaza el `rename` sobre un destino abierto por otra operación.
- **Rutas:** `packages/cache/src/store.ts` y `packages/cache/test/**`.
- **Hacer:** reintentar `rename` (y `unlink` del temporal) ante `EPERM`/`EBUSY`/`EACCES` con backoff acotado (p. ej. hasta ~1 s en total) y error estructurado si se agota. Test de estrés: N escrituras y lecturas concurrentes, repetido.
- **Aceptación:** 50 ejecuciones seguidas del test de concurrencia sin fallos, más `npm test` 5 veces seguidas en verde (cita el comando).

### FDN-041 · Adaptador FreeCut, nivel A (AG)
- **Rutas:** `packages/adapters/freecut/**` (`@fme/adapter-freecut`) y `runtime/engines/freecut/**` (el wrapper Node sobre `headless/lib/*` de `FME-ext/freecut` que recomendó FDN-012; sin forkear upstream).
- **Hacer:** `ConnectorAdapter` (ADR-0011). Operación `edit.export`: proyecto FME (`deserialize`) + `requirements.sceneId` → proyecto FreeCut → MP4 exportado por su headless. Ejecución con `runIsolated` y navegador configurable (`FME_FREECUT_BROWSER`), ruta del clon con `FME_FREECUT_DIR`. Como el contenedor no es determinista, usa `contentSha256` sobre los fotogramas decodificados (`ffmpeg -f hash` de rawvideo) además del `sha256` del archivo.
- **Aceptación:** con la capa de fondo (vídeo) de la fixture híbrida o un clip generado → MP4 verificado con `scripts/probe-media.mjs`; `checkAdapterResult` = []; dos jobs dan el mismo `contentSha256`; skip con motivo si no hay clon o navegador.

### FDN-051 · Medición de tokens del router (CL-A3)
- **Rutas:** `packages/router/test/tokens.test.ts` y `docs/bitacora/` (informe). Sin cambios en `packages/router/src` salvo que pidas un *hook* con una `solicitud`.
- **Hacer:** para las solicitudes de prueba del router, medir los bytes y una estimación de tokens (caracteres/4, declarando el método) de lo que se lee: tarjetas simples frente a secciones avanzadas pedidas, comparado con leer todas las tarjetas avanzadas completas.
- **Aceptación:** tabla con los números reales en el informe; el test falla si el router lee una sección avanzada que no era necesaria (base de los criterios #4 y #5).

### FDN-080 · Servidor MCP mínimo (CL-A2)
- **Rutas:** `apps/mcp/**` (workspace nuevo `@fme/mcp`; A0 añade `apps/*` a los workspaces, la referencia y el lockfile al integrar; no toques los archivos de la raíz).
- **Hacer:** adaptador **de la API**, no un segundo sistema (spec §10). Herramientas de `docs/contratos.md` §3 que ya tienen implementación: `project.create`/`project.open` (deserialize), `connectors.list`/`connectors.inspect` (registro), `route.plan` (router) y `job.run` (adaptadores registrados). Las que aún no existen (`preview.*`, `project.export`) se declaran como «no implementadas» con un error estructurado, sin simular. Transporte stdio. Rutas de proyecto validadas dentro de una raíz configurada; nada de ejecución arbitraria.
- **Dependencia:** SDK oficial MCP TypeScript (`@modelcontextprotocol/sdk`, MIT). **Pide confirmación al usuario** antes de instalarlo (versión exacta, origen y tamaño) e informa la licencia en el REVIEW.
- **Aceptación:** test que arranca el servidor por stdio con un cliente del SDK, lista las herramientas y ejecuta `project.open` + `connectors.list` + `route.plan` sobre la fixture híbrida.

### FDN-032b · Revideo usa `layer.text` (CL-A1)
- **Rutas:** `packages/adapters/revideo/**`.
- **Hacer:** el contenido del título sale de `layer.text.content` (más `fontFamily`, `fontSize` y `color`, si existen). `requirements.text` queda solo como sobrescritura explícita (documentada) o se elimina.
- **Aceptación:** el título de la fixture híbrida v2 se renderiza con su texto real; tests unitarios del mapeo.

### FDN-034b · Tests de integración de Revideo seguros en paralelo (CL-A1)
- **Evidencia (A0):** con el motor, `node --test packages/adapters/revideo/test/*.integration.test.ts` da 7/8 en paralelo (`entradas nuevas en …\Temp: fme-e2e-*`, porque el E2E crea su `workDir` en `os.tmpdir()` mientras `tmp-workdir` vigila esa carpeta) y 8/8 con `--test-concurrency=1`.
- **Hacer:** que los tests de integración creen sus `workDir` bajo una raíz propia (no en `os.tmpdir()`), o que `tmp-workdir` ejecute el job con `TEMP`/`TMP` apuntando a una carpeta vigilada exclusiva. Mueve también los logs de `probe()` fuera del temporal del sistema si es viable.
- **Aceptación:** 8/8 en paralelo, 3 veces seguidas, con el motor.

## Fichas de la Tanda 4 (READY desde el 2026-11-23, integración 3)

### FDN-033 · Cierre de la Fase 3, de extremo a extremo (CL-A1; A0 valida y cierra)
- **Rutas:** `packages/adapters/revideo/test/e2e.integration.test.ts` (y lo que necesites en `packages/adapters/revideo/src/**`).
- **Hacer:** un test que recorre el flujo completo:
  1. crea un `ConnectorRegistry` y registra las tarjetas del adaptador;
  2. lo descubre con `listSimple({ capability: 'render.video', accepts: 'fme/project+json' })`;
  3. si hace falta alpha, `inspect(id, ['technical'])` (solo esa sección);
  4. ejecuta el job con la fixture híbrida (capa de título);
  5. comprueba `checkAdapterResult`;
  6. convierte la procedencia en un `RenderArtifact` de `@fme/project`, con `dependencyHash` calculado con `dependencyHash` de `@fme/cache`;
  7. enlaza su id en `layer.externalProject.renderArtifactId` y verifica que el proyecto resultante pasa `parseProject`.
  - Si `Project` no tiene dónde guardar los `RenderArtifact`, **no lo inventes**: guárdalo junto al proyecto en `workDir/artifacts.json` y anótalo para FDN-042.
- **Aceptación:** test en verde con el motor real y skip con motivo sin él. Informe REVIEW con el comando y el tiempo.

### FDN-034 · Temporales de Revideo dentro de `workDir` (CL-A1)
- **Rutas:** `packages/adapters/revideo/src/**` y `runtime/engines/revideo/**`.
- **Hacer:** que Revideo, Vite y Puppeteer escriban sus temporales en `ctx.workDir` (variables `TMP`/`TEMP`/`TMPDIR` del entorno explícito, `outDir` o la opción equivalente). Comprobar con un test que `os.tmpdir()` no gana entradas nuevas durante un job.
- **Aceptación:** test en verde con el motor real; ADR-0011 punto 3 cumplido.

### FDN-028 · Contenido de las capas de texto (CL-A2; contrato)
- **Contexto:** la prueba híbrida exige tipografía cinética (6–10 s), pero `Layer` no tiene dónde guardar el texto. FDN-032 usó `requirements.text` como apaño.
- **Rutas:** `docs/decisiones/0012-contenido-de-capas-de-texto.md` (propuesta), `packages/project/src/schema.ts`, `packages/project/src/migrate.ts` (migración v1→v2; conserva la v0→v1), `packages/project/test/**` (incluye actualizar las fixtures a v2 con su versión v1 conservada como fixture de migración) y `examples/prueba-hibrida-10s/project.fme.json`. **Pide a A0** el cambio en `index.ts` (tipo `Layer` y `SCHEMA_VERSION`) con una `solicitud` que incluya el diff exacto: `index.ts` es de A0.
- **Propuesta de partida** (el ADR puede mejorarla): `text?: { content: string; fontFamily?: string; fontSize?: number; color?: string }`, solo válido si `kind === 'text'`.
- **Aceptación:**
  - las fixtures v0 y v1 se migran a v2 y validan;
  - una capa no `text` con `text` se rechaza;
  - el round-trip sigue siendo byte a byte;
  - `docs/contratos.md` se actualiza vía A0.
  - Después de integrarla, FDN-032b hará que el adaptador use `layer.text` (A1).

### FDN-071 · Render por segmentos + preview adaptativa (CX)
- **Rutas:** `packages/render-plan/**` (workspace `@fme/render-plan`; A0 añade la referencia y regenera el lockfile).
- **Hacer:**
  - dividir una escena del `Project` en segmentos por capa y rango de fotogramas;
  - calcular la clave de cada segmento con `dependencyHash` de `@fme/cache`;
  - decidir qué segmentos hay que re-renderizar tras un cambio, usando `DependencyGraph`;
  - perfiles de preview: resolución y muestras reducidas según un presupuesto de VRAM declarado (referencia: 4 GB).
  - Sin ejecutar motores: devuelve un plan.
- **Aceptación:**
  - con la fixture híbrida, cambiar la capa de título invalida solo sus segmentos;
  - el perfil de preview respeta el presupuesto;
  - el plan es determinista.

## Fichas de la Tanda 3 (READY desde el 2026-11-23, integración 2)

Base común: `develop` ≥ `b290224`. Interfaz de adaptadores en [ADR-0011](../docs/decisiones/0011-interfaz-de-adaptadores.md) (`ConnectorAdapter`, `AdapterJobResult`, `checkAdapterResult`, exportados desde `@fme/connectors`). Ejecución con `runIsolated` de `@fme/runtime-workers`. La raíz ya admite workspaces en `packages/adapters/*`, y `npm test` y el typecheck de tests los incluyen. **No edites** `package.json`, `tsconfig.json` ni `package-lock.json` de la raíz: A0 añade la referencia de tu paquete y regenera el lockfile al integrar. Para compilar tu paquete: `npx tsc -b <ruta del paquete>`.

### FDN-026 · `deserialize` con migraciones (CL-A2)
- **Rutas:** `packages/project/src/serialize.ts` y `packages/project/test/serialize.test.ts`.
- **Hacer:** si el JSON trae un `schemaVersion` anterior al actual, `deserialize` aplica `migrateToCurrent` antes de validar. Si trae una versión futura o desconocida, mantiene el error `unknown-schema-version`. `serialize` siempre escribe la versión actual.
- **Aceptación:** `deserialize` de `test/fixtures-v0/project.fme.json` devuelve un proyecto v1 válido; deserializar, serializar y volver a deserializar es estable; los tests existentes siguen en verde. Desbloquea FDN-025 (cierre de la F2).

### FDN-032 · Adaptador Revideo (CL-A1)
- **Rutas:** `packages/adapters/revideo/**` (workspace `@fme/adapter-revideo`, con dependencias `@fme/connectors`, `@fme/project` y `@fme/runtime-workers` en `0.0.0`) y `runtime/engines/revideo/**` (proyecto npm del motor **fuera de los workspaces**, con su propio lockfile, a partir de `examples/fase1/revideo`, incluido `ffmpeg-compat.mjs`; `node_modules/` y `out/` ignorados).
- **Hacer:** implementar `ConnectorAdapter`, con las tarjetas a partir de `examples/fase1/revideo/card.*.json` y ajustadas a lo que haga el adaptador.
  - Operación `render.video`: recibe un proyecto FME (`inputs[0]`, `fme/project+json`) y `requirements.layerId` (y `alpha` opcional). Renderiza una capa `text` o `svg` mapeando sus canales `x`, `y`, `opacity`, `scale` y `rotation` (con interpolación según `easing`) y su rango `startFrame`/`durationFrames`.
  - Salida: MP4, o MOV ProRes 4444 si `alpha: true`.
  - FFmpeg con ruta explícita (ADR-0010; variable `FME_FFMPEG_PATH` o el PATH) y diagnóstico `engine-missing` si falta.
  - `probe()` lee la versión real del motor.
- **Aceptación:**
  - test unitario del mapeo de canales a la escena (sin motor);
  - test de integración con la capa de título de `examples/prueba-hibrida-10s/project.fme.json` → 120 fotogramas a 30 FPS comprobados con `scripts/probe-media.mjs`, y `checkAdapterResult` sin incumplimientos;
  - si el motor no está instalado, el test de integración se marca **skip** con el motivo explícito (CI no lo tiene), nunca en verde falso.
- **Descargas:** instalar el motor en `runtime/engines/revideo` necesita confirmación del usuario. Usa la caché de npm (`--prefer-offline`) e indica el tamaño.

### FDN-040 · Adaptador Blender (CX)
- **Rutas:** `packages/adapters/blender/**` (workspace `@fme/adapter-blender`) y `runtime/engines/blender/**` (scripts `bpy` versionados, a partir de `examples/fase1/blender/render_scene.py`).
- **Hacer:** implementar `ConnectorAdapter`. Operación `render.image-sequence`: proyecto FME + `requirements.layerId` (capa `model3d`) + `resolution` opcional.
  - La escena se construye desde parámetros JSON pasados al script, nunca desde código Python recibido del agente. Si el asset no existe, se usa un primitivo de sustitución y se avisa en `diagnostics` (tipo `warning`).
  - Mapeo explícito de fotogramas: FME es 0-based y relativo a la capa; Blender, 1-based.
  - Cámara animada según los canales.
  - Ruta del motor: `FME_BLENDER_PATH` o la ruta por defecto. `probe()` ejecuta `blender --version`.
  - `contentSha256` = SHA-256 del RGBA decodificado (hallazgo de FDN-011).
- **Aceptación:**
  - la capa 3D de la fixture híbrida produce 150 PNG RGBA (`durationFrames`) a resolución de preview;
  - `checkAdapterResult` sin incumplimientos;
  - dos jobs iguales dan el mismo `contentSha256`;
  - el timeout mata Blender;
  - skip explícito si no hay Blender.

### FDN-050 · Núcleo del router (AG)
- **Rutas:** `packages/router/**` (workspace `@fme/router`; ya entra en `packages/*`; A0 añade la referencia en `tsconfig.json`).
- **Hacer:**
  - la secuencia de 8 pasos de `docs/arquitectura.md` §3 sobre un `ConnectorRegistry`;
  - modos automático, manual e híbrido;
  - restricciones duras (compatibilidad y permisos) que ninguna puntuación compensa;
  - un `unknown` provoca `inspect` **solo** de las secciones necesarias y nunca se trata como compatible;
  - justificación registrada (candidatos, descartes con motivo, secciones inspeccionadas y elección);
  - de momento, sin ejecutar jobs: devuelve un plan.
  - Fixtures: las tarjetas **reales** verificadas de `examples/fase1/revideo` y `examples/fase1/blender` más una simulada de editor.
- **Aceptación:**
  - «título SVG animado» → Revideo;
  - «cámara 3D con alpha» → Blender;
  - el modo manual con una herramienta incompatible da un error con motivo;
  - con alpha `unknown` se inspecciona solo `technical` (criterio #5).
  - Los tests cuentan las tarjetas simples leídas frente a las secciones avanzadas pedidas (base de FDN-051).

### FDN-070 · Caché con invalidación por dependencias (CX)
- **Rutas:** `packages/cache/**` (workspace `@fme/cache`; ya entra en `packages/*`; A0 añade la referencia).
- **Hacer:**
  - `dependencyHash({ projectId, segment, assets[], adapters[] })`: SHA-256 de un JSON canónico con claves ordenadas (spec §13.4);
  - un grafo de dependencias donde `invalidate(nodeId)` devuelve **solo** los nodos dependientes;
  - un almacén en disco bajo una raíz permitida, con rutas validadas (reutiliza la validación de `@fme/runtime-workers` si está exportada; si no, pídela con una `solicitud`) y escritura atómica;
  - sin dependencias nuevas.
- **Aceptación:**
  - el hash es estable ante el orden de las claves y cambia al cambiar la versión de un adaptador;
  - al invalidar una capa, solo se invalidan sus derivados;
  - se rechaza una ruta fuera de la raíz.

## Fichas de la Tanda 2 (READY desde el 2026-11-23)

### FDN-015 · `run.ps1` compatible con PowerShell 5.1 (CX)
- **Hallazgo de A0:** `powershell -File examples/fase1/blender/run.ps1` (Windows PowerShell 5.1, el que trae Windows) falla con `IncompleteHashLiteral` en la línea 151. La causa es `clave = if (...) { ... }` dentro de un hashtable. Se arregla con `clave = $(if (...) { ... })`. El render en sí está verificado: A0 obtuvo el mismo SHA-256 de píxeles, `c9706f10…450b`.
- **Rutas:** `examples/fase1/blender/run.ps1` y la sección de comandos de `RESULTADOS.md`.
- **Aceptación:** `powershell -NoProfile -ExecutionPolicy Bypass -File run.ps1 -RunName x` termina en verde en PS 5.1. Si dispones de PowerShell 7, también en `pwsh`.

### FDN-016 · Revideo sin el binario GPLv3 de 2018 (CL-A1)
- **Contexto:** FDN-010 detectó que `@ffmpeg-installer/win32-x64` 4.1.0 trae FFmpeg N-92722 (2018, GPLv3), que `fluent-ffmpeg` está deprecado y que `npm audit` da un aviso *high* en vite. El sistema ya tiene FFmpeg 9.0.2 (winget, en el PATH).
- **Rutas:** `examples/fase1/revideo/**` y `docs/decisiones/0010-ffmpeg-del-sistema-para-revideo.md` (ADR nuevo, en estado propuesta).
- **Hacer:** comprobar si Revideo admite una ruta de FFmpeg configurable (variable de entorno o `ffmpegPath`). Si la admite, repetir la aceptación de FDN-010 con el FFmpeg del sistema (MP4 de 90 fotogramas y MOV con alpha) y documentar la licencia efectiva de ese binario (`ffmpeg -version`, `--enable-gpl`…). Evaluar si `vite >= 8.3.8` resuelve el aviso sin romper el render (**pide confirmación al usuario antes de la descarga**).
- **Aceptación:** el ADR-0010 recoge la opción elegida con evidencia; `npm run verify` sigue en verde.

### FDN-023 · Fixtures y round-trip (CL-A2)
- **Rutas:** `examples/prueba-hibrida-10s/project.fme.json`, `packages/project/test/fixtures/**` y `packages/project/test/fixtures.test.ts`.
- **Contenido:** la fixture híbrida de 300 fotogramas (rangos de `examples/prueba-hibrida-10s/README.md`, con fondo, 2D, 3D y título como capas, `ExternalProjectRef` en las capas de Revideo y Blender, y los canales `expression`/`integration` animados), una mínima y una a 30000/1001. Usa `parseProject`, `serialize`/`deserialize` y las funciones de `time.ts` (todas exportadas en `@fme/project`).
- **Aceptación:** el 100 % de las fixtures validan, el round-trip produce bytes idénticos y la duración en segundos de la fixture de 29,97 es exacta (calculada con `framesToSeconds`).

### FDN-024 · Migraciones (CX)
- **Rutas:** `packages/project/src/migrate.ts`, `packages/project/test/migrate.test.ts` y `packages/project/test/fixtures-v0/**` (fixture sintética v0). **No** toques `index.ts`, `schema.ts` ni `serialize.ts`. Si necesitas un *hook* en `deserialize`, pídelo con una `solicitud`.
- **Contenido:** registro ordenado de migraciones `vN → vN+1` y `migrateToCurrent(raw)`, que devuelve el proyecto migrado o un error estructurado. Una migración de ejemplo v0 → v1 (p. ej. `fps` como número → `{num, den}`).
- **Aceptación:** la fixture v0 migrada pasa `parseProject`; una versión futura o desconocida da error; sin pérdida de campos.

### FDN-031 · Ejecución aislada de procesos (CX)
- **Rutas:** `runtime/workers/package.json` (nuevo workspace `@fme/runtime-workers`; añádelo a `workspaces` y a las referencias de `tsconfig.json` de la raíz; es el único cambio permitido en archivos de la raíz), `runtime/workers/src/**` y `runtime/workers/test/**`.
- **Contenido:** `runIsolated({ cmd, args, workDir, allowedPaths, timeoutMs, env })`, que devuelve `{ exitCode, stdoutPath, stderrPath, durationMs, killed }`. Sin shell (`spawn` con `shell: false`). Directorio de trabajo propio por job, dentro de una raíz permitida. Rechaza rutas con `..` o fuera de `allowedPaths` tras `realpath`. Al vencer el timeout, mata el árbol de procesos en Windows (`taskkill /T /F`). Entorno mínimo explícito (no hereda todo `process.env`).
- **Aceptación:** tests de timeout que matan un proceso hijo con nietos, de ruta rechazada, de código de salida y de que no hay shell (un argumento con `&` no se interpreta).

### FDN-013 · Sonda de medios (CL-A3)
- **Rutas:** `scripts/probe-media.mjs` y `scripts/probe-media.test.mjs`.
- **Contenido y aceptación:** los de la ficha resumida de abajo. Los tests generan sus medios con `ffmpeg -f lavfi testsrc2` en un directorio temporal y comprueban fps, fotogramas y `hasAlpha` (con un MOV ProRes 4444 con alpha y un MP4 sin alpha).

### FDN-060 · Dirección artística: perfiles y reglas (libre)
- **Rutas:** `packages/art-direction/**` (nuevo workspace `@fme/art-direction`; añádelo a `workspaces` y a las referencias de `tsconfig.json`).
- **Contenido:** tipos y validación (Zod) de `StyleProfile` y de las reglas de animación como procedimientos deterministas (no IA para microdecisiones): un plan estético por secuencia, plano y capa que produce curvas para `expression` e `integration` sobre un `Project`. Toma la spec §5–§6.1 y `docs/arquitectura.md` §1 como fuente; no amplíes el alcance.
- **Aceptación:** aplicar un perfil a la fixture mínima produce cambios deterministas en los canales (mismo seed → misma salida) y `npm test` está en verde. ADR si se introduce algún tipo compartido con `@fme/project`.

## Fichas resumidas de la Tanda 2 (pasan a READY al integrar sus dependencias)

- **FDN-013** (`scripts/probe-media.mjs` + test): envuelve `ffprobe -print_format json` y devuelve `{fps, frames, durationS, width, height, pixFmt, hasAlpha, audio}`. Error estructurado si falta ffprobe.
- **FDN-023:** `examples/prueba-hibrida-10s/project.fme.json`, fixtures mínimas (incluida una de 29,97) y test de round-trip del 100 % de las fixtures.
- **FDN-024:** `packages/project/src/migrate.ts`: registro de migraciones `vN→vN+1`, migración de ejemplo probada con una fixture v0 sintética y ADR si cambia el formato.
- **FDN-031:** `runtime/workers/`: `runIsolated({cmd, args, workDir, allowedPaths, timeoutMs, env})` con un directorio de trabajo propio por job, kill del árbol de procesos al vencer el timeout (Windows), validación de rutas (sin `..` ni rutas fuera de lo permitido), log estructurado y sin shell.
- **FDN-050:** `packages/router/`: secuencia de 8 pasos sobre tarjetas **simuladas**; registra la justificación; `unknown` provoca `inspect`, nunca una compatibilidad supuesta.
