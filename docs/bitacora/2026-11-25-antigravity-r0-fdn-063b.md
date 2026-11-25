# 2026-11-25 · antigravity-r0 · FDN-063b · Exportación nativa de `camera.json` en Blender

- **Tarea:** `FDN-063b` — exportación nativa de `camera.json` en Blender para `guide3DLayerId`
- **Sesión / Equipo:** `antigravity-r0` (`antigravity-relevo`)
- **Relevo de:** `codex` (`codex-c0-r9`)
- **Punta origen:** `d94d757` (con merge fast-forward limpio de `develop` `abbb646`)
- **Rama:** `fdn/FDN-063b-blender-camera-relevo-antigravity-relevo`
- **Worktree:** `C:\Users\bogex\Documents\Forgex\FME-wt\antigravity-relevo`

## Hecho

1. **Relevo y base de código:**
   - Creado el worktree exclusivo desde `d94d757`, integrado `develop` (`abbb646`) en fast-forward limpio y aplicado el parche del acta `FME-ops/relevos/20261125T080133842Z-codex-c0-r9.patch` (una sola vez, usando `git apply --recount --3way` porque el último hunk del parche tenía dos líneas de contexto final omitidas en su cabecera).
   - Preparado `node_modules` en el worktree con `npm.cmd ci --offline --no-audit --no-fund` sin modificar `package.json` ni `package-lock.json`.
2. **Auditoría del contrato `camera.json` v1 y ajustes en el relevo:**
   - Verificada compatibilidad 100 % con el consumidor de A1 (`packages/adapters/revideo/src/guide.ts` y `packages/adapters/revideo/test/techniques.integration.test.ts`):
     - `runtime/engines/blender/render_scene.py` ejecuta `bpy.context.view_layer.update()` tras `set_camera(...)`, proyecta el centro de referencia `focus` con `bpy_extras.object_utils.world_to_camera_view(scene, scene.camera, focus)` y escribe `render.json.camera` con `{ version: 1, width, height, frames: [{ frame, x, y: 1 - projected.y, depth: projected.z, lens }] }` serializado con `allow_nan=False`.
     - Las coordenadas `(x, y)` son fracciones normalizadas desde la esquina superior izquierda, exactamente como espera `parseGuide` / `guideOffsets`.
   - **Nota de compatibilidad (`cameraGuide` opt-in):** `requirements.cameraGuide` es booleano y por defecto `false`. Cuando no se solicita o es `false`, el adaptador devuelve únicamente los `durationFrames` artefactos `image/png` sin escribir `camera.json`, preservando compatibilidad total con consumidores fuera de ficha (`packages/pipeline/src/hybrid.ts` y `tests/regresion/render.test.ts`). Al activarlo (`cameraGuide: true`), emite los `durationFrames` PNG seguidos de `camera.json` (`type: 'application/json'`) con procedencia completa y `checkAdapterResult(run, adapter)` vacío (`[]`); `adapter.simple.produces` incluye `['image/png', 'application/json']`.
   - **Ajustes añadidos sobre el parche de Codex (dentro de rutas autorizadas):**
     - `packages/adapters/blender/src/request.ts`: reordenado el mensaje de error de requisitos admitidos a `'Solo se admiten los requisitos cameraGuide, layerId y resolution.'` para mantener la compatibilidad con el patrón `/layerId y resolution/` validado en `tests/seguridad/limits.test.ts:114` sin modificar archivos fuera de ficha.
     - `packages/adapters/blender/src/artifacts.ts`: reforzada la validación en `readCamera` para rechazar también `entry.lens <= 0` además de valores no finitos o índices/dimensiones incoherentes.
3. **Tests unitarios y de integración real con Blender 5.2.3:**
   - Añadido `packages/adapters/blender/test/camera.integration.test.ts` (y conservados los casos de `adapter.test.ts` del parche) cubriendo:
     - Validación de `prepareJob` para `cameraGuide` booleano, opt-in por defecto y declaración de `produces`.
     - Validación unitaria de `collectArtifacts`: emisión condicional de `camera.json` solo con `cameraGuide: true`, comprobación de SHA-256 y rechazo de 10 variantes malformadas de `render.json.camera` (ausente, `version !== 1`, dimensiones o longitud incorrectas, índice `frame` alterado, coordenadas no numéricas/nulas, `lens <= 0`).
     - Integración con **Blender 5.2.3 LTS** real a **1280×720** (3 fotogramas: inicio, medio y fin, con desplazamiento en X `-1.5→1.5`, desplazamiento en Y `-0.7→0.7`, órbita `-25°→+25°` y zoom `scale 0.5→0.7` / `lens 24.00→33.60 mm`), verificando `checkAdapterResult === []`, procedencia válida, esquema v1, precisión `< 6 px` frente al centroide alfa de los PNG renderizados, determinismo bit a bit entre ejecuciones independientes (a `256x144`, verificando además invariancia de `(x, y)` normalizadas `< 1e-6` frente a `1280x720`) y compatibilidad opt-out (`cameraGuide` omitido y `false`).

## Verificado

- **Consultas `codegraph`** (índice inicializado con `codegraph init -i`: 135 archivos, 2 862 nodos, 7 951 aristas; sincronizado con `codegraph sync` tras añadir el test):
  - `codegraph impact collectArtifacts` → 15 símbolos afectados.
  - `codegraph impact prepareJob` → 19 símbolos afectados.
  - `codegraph impact createBlenderAdapter` → 24 símbolos afectados.
  - `codegraph affected packages/adapters/blender/src/artifacts.ts` (y `request.ts`, `index.ts`) → 13 archivos de test afectados (incluyendo el nuevo `camera.integration.test.ts`).
  - `codegraph affected runtime/engines/blender/render_scene.py` → sin tests TS directos (invocado por el adaptador).
- **Errores de proyección vs. centroide alfa medidos a 1280×720 (Blender 5.2.3 LTS real):**
  - Fotograma 0 (inicio): `camera=(824.99, 295.25)`, `centroid=(830.06, 295.84)`, **error = `5.11 px`** (`depth=8.483`, `lens=24.00 mm`).
  - Fotograma 1 (medio): `camera=(640.00, 360.00)`, `centroid=(635.39, 358.28)`, **error = `4.92 px`** (`depth=9.171`, `lens=28.80 mm`).
  - Fotograma 2 (fin): `camera=(541.11, 371.09)`, `centroid=(540.02, 368.98)`, **error = `2.37 px`** (`depth=11.022`, `lens=33.60 mm`).
  - Todos `< 6 px` (rango `2.37–5.11 px`, recorrido del centroide `290.0 px` en X y `73.1 px` en Y).
- **Comandos ejecutados (todos sobre el estado final del código):**
  - `npm.cmd run typecheck` → exit `0` (`tsc -b && tsc -p tsconfig.test.json`).
  - `node --test --test-concurrency=1 packages/adapters/blender/test/*.test.ts` → exit `0` (`tests 10, pass 10, fail 0, skipped 0, todo 0, duration_ms 154591.40`).
  - `node --test tests/seguridad/limits.test.ts` → exit `0` (`tests 10, pass 10, fail 0, skipped 0, todo 0, duration_ms 962.94`).
  - `node --test tests/regresion/render.test.ts` → exit `0` (`tests 3, pass 2, fail 0, skipped 1 [Revideo engine-missing], todo 0, duration_ms 26734.52`; Blender ✔ `7696.92 ms`, FreeCut ✔ `18463.04 ms`).
  - `npm.cmd test` → exit `0` (`tests 255, suites 7, pass 237, fail 0, cancelled 0, skipped 18 [Revideo engine-missing en este worktree], todo 0, duration_ms 89371.07`).
  - `git diff --check` → exit `0` (limpio).

## Pendiente

- Revisión independiente por `@verifier` y posterior entrega a `claude-code-a0` por `@coordinator`.
- Integración del consumidor en `packages/pipeline` o `packages/adapters/revideo` (fuera del alcance de `FDN-063b`) activando `requirements.cameraGuide: true` cuando una capa 2D declare `guide3DLayerId`.
