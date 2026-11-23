# Backlog maestro FDN

> **Dueño único: A0.** Los demás equipos **no** editan este archivo: envían un `evento` o una `solicitud` a `claude-code-a0` ([TASK_PROTOCOL.md](TASK_PROTOCOL.md)).
> Estados: `BACKLOG` · `READY` (sin dependencias pendientes) · `IN_PROGRESS` · `BLOCKED` · `REVIEW` · `DONE` (integrada en `develop` con evidencia) · `CANCELLED`.
> Equipos: **CL** (Claude: A0 Opus, A1/A2 Sonnet, A3 Haiku), **AG** (Antigravity: B0 Neon, B1/B2 Hydrogen), **CX** (Codex: C0, C1 y C2, Sol).
> _Última consolidación: 2026-11-22 (arranque)._

## Resumen

| ID | Tarea | Equipo | Depende de | Estado |
|---|---|---|---|---|
| FDN-001 | Documentos FDN, CONTINUATION y prompts | CL-A0 | — | DONE (arranque) |
| FDN-002 | Carpeta operativa `FME-ops` + `coord.mjs` (eventos, solicitudes, raíz) | CL-A0 | — | DONE (arranque) |
| FDN-003 | Infraestructura de tests de paquetes + typecheck en verde | CL-A0 | — | DONE (arranque) |
| FDN-004 | Benchmarks verificados por modelo | CL-A3 | — | READY |
| FDN-005 | Aprobación formal de la spec v0.1 | **Usuario** | — | BLOCKED (humano) |
| FDN-006 | `develop`, worktrees, política de índices | CL-A0 | 001–003 | DONE (arranque) |
| FDN-010 | Verificar Revideo | CL-A1 | 003 | READY |
| FDN-011 | Verificar Blender 5.2 headless | CX | — | READY |
| FDN-012 | Verificar FreeCut | AG | — | READY |
| FDN-013 | Sonda de medios `scripts/probe-media.mjs` | CL-A3 | 003 | BACKLOG (Tanda 2) |
| FDN-014 | Cierre de la Fase 1 (criterio #1) | CL-A0 | 010, 011, 012 | BACKLOG |
| FDN-020 | ADR-0008: validación con Zod 4 | CL-A0 | — | DONE (propuesta escrita) |
| FDN-021 | Esquema Zod + validación + serialización de `Project` | CL-A2 | 003, 020 | READY |
| FDN-022 | Tiempo racional y timecode sin deriva | CX | 003 | READY |
| FDN-023 | Fixtures (incluida la híbrida de 10 s) + round-trip | CL-A2 | 021, 022 | BACKLOG |
| FDN-024 | Marco de migraciones + migración de ejemplo | CX | 021 | BACKLOG |
| FDN-025 | Cierre de la Fase 2 (criterio #2) | CL-A0 | 023, 024 | BACKLOG |
| FDN-030 | Registro dinámico de conectores + ADR-0009 | AG | 003 | READY |
| FDN-031 | Ejecución aislada de procesos (`runtime/workers`) | CX | 003 | BACKLOG (Tanda 2) |
| FDN-032 | Adaptador Revideo real (JobRequest→JobResult con procedencia) | CL | 010, 021, 030, 031 | BACKLOG |
| FDN-033 | Cierre de la Fase 3 | CL-A0 | 032 | BACKLOG |
| FDN-040 | Adaptador Blender (nivel A) | CX | 011, 030, 031 | BACKLOG |
| FDN-041 | Adaptador FreeCut (nivel A o B según la F1) | AG | 012, 030, 031 | BACKLOG |
| FDN-042 | Rutas A/B/C + `ExternalProjectRef`/`RenderArtifact` enlazados | a decidir | 021, 032, 040, 041 | BACKLOG |
| FDN-043 | Cierre de la Fase 4 (criterio #3) | CL-A0 | 042 | BACKLOG |
| FDN-050 | Núcleo del router (8 pasos, modos, restricciones duras) con tarjetas simuladas | a decidir | 030 | BACKLOG |
| FDN-051 | Medición de tokens: tarjeta simple frente a avanzada | a decidir | 050 | BACKLOG |
| FDN-052 | Fallbacks con adaptadores reales | a decidir | 050, 043 | BACKLOG |
| FDN-053 | Cierre de la Fase 5 (criterios #4 y #5) | CL-A0 | 051, 052 | BACKLOG |
| FDN-060 | Dirección artística: perfiles de estilo y reglas | a decidir | 021 | BACKLOG |
| FDN-061 | Gradientes y técnicas → operaciones por backend | a decidir | 060, 032, 040 | BACKLOG |
| FDN-062 | Cierre de la Fase 6 (criterio #6) | CL-A0 | 061 | BACKLOG |
| FDN-070 | Caché con invalidación por dependencias | a decidir | 021, 031 | BACKLOG |
| FDN-071 | Render por segmentos + preview adaptativa | a decidir | 070 | BACKLOG |
| FDN-072 | Errores: falta de VRAM, reintento seguro, backend alternativo | a decidir | 070 | BACKLOG |
| FDN-073 | Suite técnica (temporal, estética, editabilidad, enrutamiento, recursos, seguridad, regresión) | a decidir | 043, 062, 071, 072 | BACKLOG |
| FDN-074 | Exportación final con audio y sincronía | a decidir | 043, 071 | BACKLOG |
| FDN-075 | Prueba híbrida de 10 s (criterios #7 y #8) | CL-A0 + todos | 073, 074 | BACKLOG |
| FDN-080 | Servidor MCP mínimo (`apps/mcp`) | a decidir | 021, 030, 050 | BACKLOG |
| FDN-081 | CLI (`apps/cli`) | a decidir | 080 | BACKLOG |
| FDN-082 | Auditoría de licencias de las versiones fijadas | CL-A0 (continua) | — | IN_PROGRESS |

---

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

## Fichas resumidas de la Tanda 2 (pasan a READY al integrar sus dependencias)

- **FDN-013** (`scripts/probe-media.mjs` + test): envuelve `ffprobe -print_format json` y devuelve `{fps, frames, durationS, width, height, pixFmt, hasAlpha, audio}`. Error estructurado si falta ffprobe.
- **FDN-023:** `examples/prueba-hibrida-10s/project.fme.json`, fixtures mínimas (incluida una de 29,97) y test de round-trip del 100 % de las fixtures.
- **FDN-024:** `packages/project/src/migrate.ts`: registro de migraciones `vN→vN+1`, migración de ejemplo probada con una fixture v0 sintética y ADR si cambia el formato.
- **FDN-031:** `runtime/workers/`: `runIsolated({cmd, args, workDir, allowedPaths, timeoutMs, env})` con un directorio de trabajo propio por job, kill del árbol de procesos al vencer el timeout (Windows), validación de rutas (sin `..` ni rutas fuera de lo permitido), log estructurado y sin shell.
- **FDN-050:** `packages/router/`: secuencia de 8 pasos sobre tarjetas **simuladas**; registra la justificación; `unknown` provoca `inspect`, nunca una compatibilidad supuesta.
