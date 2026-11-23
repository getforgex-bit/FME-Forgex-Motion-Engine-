# Backlog maestro FDN

> **Dueño único: A0.** Los demás equipos **no** editan este archivo: envían un `evento` o una `solicitud` a `claude-code-a0` ([TASK_PROTOCOL.md](TASK_PROTOCOL.md)).
> Estados: `BACKLOG` · `READY` (sin dependencias pendientes) · `IN_PROGRESS` · `BLOCKED` · `REVIEW` · `DONE` (integrada en `develop` con evidencia) · `CANCELLED`.
> Equipos: **CL** (Claude: A0 Opus, A1/A2 Sonnet, A3 Haiku), **AG** (Antigravity: B0 Neon, B1/B2 Hydrogen), **CX** (Codex: C0, C1 y C2, Sol).
> _Última consolidación: 2026-11-23 (integración 2, `develop`; apertura de la Tanda 3)._

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
| FDN-012 | Verificar FreeCut | AG | — | BLOCKED (confirmación del usuario para clonar FreeCut, ~380–700 MB) |
| FDN-013 | Sonda de medios `scripts/probe-media.mjs` | CL-A3 | 003 | DONE (f271d29) |
| FDN-014 | Cierre de la Fase 1 (criterio #1) | CL-A0 | 010, 011, 012 | BACKLOG |
| FDN-026 | `deserialize` aplica las migraciones (`migrateToCurrent`) | CL-A2 | 021, 024 | READY |
| FDN-027 | ADR-0011: interfaz común de adaptadores y procedencia | CL-A0 | 030, 031 | DONE (b290224) |
| FDN-020 | ADR-0008: validación con Zod 4 | CL-A0 | — | DONE (propuesta escrita) |
| FDN-015 | `run.ps1` de Blender compatible con Windows PowerShell 5.1 | CX | 011 | DONE (d216597; A0 lo verificó en PS 5.1) |
| FDN-016 | Revideo: FFmpeg del sistema en lugar del binario GPLv3 de 2018 + `npm audit` (vite) + ADR-0010 | CL-A1 | 010 | DONE (c8ba756) |
| FDN-021 | Esquema Zod + validación + serialización de `Project` | CL-A2 | 003, 020 | DONE (b0325f9) |
| FDN-022 | Tiempo racional y timecode sin deriva | CX | 003 | DONE (026af28) |
| FDN-023 | Fixtures (incluida la híbrida de 10 s) + round-trip | CL-A2 | 021, 022 | DONE (1a35a36) |
| FDN-024 | Marco de migraciones + migración de ejemplo | CX | 021 | DONE (8cbdde3) |
| FDN-025 | Cierre de la Fase 2 (criterio #2) | CL-A0 | 023, 024, 026 | BACKLOG (tras FDN-026) |
| FDN-030 | Registro dinámico de conectores + ADR-0009 | AG | 003 | DONE (4ee6910) |
| FDN-031 | Ejecución aislada de procesos (`runtime/workers`) | CX | 003 | DONE (e73f706) |
| FDN-032 | Adaptador Revideo real (JobRequest→JobResult con procedencia) | CL-A1 | 010, 021, 030, 031 | READY |
| FDN-033 | Cierre de la Fase 3 | CL-A0 | 032 | BACKLOG |
| FDN-040 | Adaptador Blender (nivel A) | CX | 011, 030, 031 | READY |
| FDN-041 | Adaptador FreeCut (nivel A o B según la F1) | AG | 012, 030, 031 | BACKLOG |
| FDN-042 | Rutas A/B/C + `ExternalProjectRef`/`RenderArtifact` enlazados | a decidir | 021, 032, 040, 041 | BACKLOG |
| FDN-043 | Cierre de la Fase 4 (criterio #3) | CL-A0 | 042 | BACKLOG |
| FDN-050 | Núcleo del router (8 pasos, modos, restricciones duras) con tarjetas simuladas | AG | 030 | READY |
| FDN-051 | Medición de tokens: tarjeta simple frente a avanzada | a decidir | 050 | BACKLOG |
| FDN-052 | Fallbacks con adaptadores reales | a decidir | 050, 043 | BACKLOG |
| FDN-053 | Cierre de la Fase 5 (criterios #4 y #5) | CL-A0 | 051, 052 | BACKLOG |
| FDN-060 | Dirección artística: perfiles de estilo y reglas | libre (el primero que quede libre) | 021 | DONE (b78af00, AG) |
| FDN-061 | Gradientes y técnicas → operaciones por backend | a decidir | 060, 032, 040 | BACKLOG |
| FDN-062 | Cierre de la Fase 6 (criterio #6) | CL-A0 | 061 | BACKLOG |
| FDN-070 | Caché con invalidación por dependencias | CX | 021, 031 | READY |
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
