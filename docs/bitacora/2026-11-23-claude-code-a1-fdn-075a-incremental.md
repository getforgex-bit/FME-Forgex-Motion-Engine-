# 2026-11-23 · FDN-075a cambio parcial sin rehacer todo (criterio #8)

- **Autor:** claude-code-a1 (Sonnet 5.5) · **Rama:** fdn/FDN-075a-incremental · **Fase:** 7

## Hecho
- `packages/pipeline/src/stepcache.ts`: `StepCache` sobre `DiskCache` (`@fme/cache`). El manifiesto JSON (clave = `dependencyHash`) lista los archivos de `cache/files/<clave>/` con su SHA-256; solo es acierto si todos los archivos siguen intactos.
- `runHybrid` (`hybrid.ts`): plan de segmentos con `planSceneRender` (`@fme/render-plan`, un segmento por capa); las claves incluyen capa (texto, canales…), assets (SHA-256 del contenido de los nativos), versión del adaptador y del motor (de `probe()`), parámetros (alpha, resolución) y la versión de FFmpeg para el paso ProRes. La composición tiene su propia clave (todas las claves de capa + FreeCut).
- Cada `HybridStep` lleva `source: 'engine' | 'cache'` y `cacheKey`; el resultado, `engineJobs`, `cachedSteps`, `segmentKeys` y `composeKey`. Los pasos servidos desde la caché conservan su procedencia (también la de los tres adaptadores).
- `reopenExternalSource(project, layerId, baseDir)`: resuelve el `ExternalProjectRef` hacia su documento nativo y su artefacto (si el archivo no existe, `exists: false`; no se inventa).
- Los jobs de cada corrida van en `outDir/jobs/<runId>/`; la caché persiste en `outDir/cache`.

## Verificado
| Comando | Resultado real |
|---|---|
| `node --test packages/pipeline/test/incremental.integration.test.ts` (3 motores reales) | pass; 160 s en total |
| Ejecución 1 (completa) | 109,0 s; 5 pasos de motor (revideo×2, blender, prores, freecut); 0 de caché |
| Ejecución 2 (sin cambios) | 0,7 s; **0 jobs de motor**, 5 pasos de caché; mismo MP4 (SHA-256 igual), mismos artefactos y claves |
| Ejecución 3 (cambia el texto del título) | 31,7 s; **2 jobs**: revideo (`capa-titulo`) + freecut (composición); de caché: revideo `capa-2d`, blender `capa-3d`, prores `capa-3d` |
| Artefactos no afectados | `render-capa-2d`, `render-capa-3d`, `render-capa-3d-prores`: mismo `dependencyHash`, mismo URI y mismo SHA-256 de archivo; cambian `render-capa-titulo` y `render-final`; solo cambian la clave del título y la de la composición |
| Diferencia de píxeles run 1 vs run 3 FUERA de 180–299 (13 fotogramas) | meanAbs = 0 y changed = 0 en todos. **Umbral declarado:** media abs. por canal ≤ 0,25 y fracción de píxeles con \|Δ\|>16 ≤ 0,001 |
| Diferencia DENTRO de 180–299 (5 fotogramas) | meanAbs 5,1–5,8; ≈ 4,6–5,4 % de píxeles cambiados |
| `FME_FFMPEG_PATH` inválido | 1 skip con el motivo |
| `npx tsc -b`, `npx tsc -p tsconfig.test.json` | sin errores |
| `npm test` (raíz) | 226/231 (2 fallos ajenos, ver abajo; el resto en verde) |

## Fallos ajenos a esta tarea (en `npm test`)
1. `tests/regresion/render.test.ts` · «Revideo · MP4 de una ilustración SVG fija»: `contentSha256 cambió`. **Causa:** el baseline `tests/regresion/expected/revideo.json` se fijó (commit 6aff255, 12:02) con el render del SVG VACÍO; mi corrección del SVG (cb2d404, 12:16) hace que el SVG se dibuje. Requiere actualizar el baseline tras la revisión de A0 (procedimiento documentado en ese README). No lo toqué.
2. `packages/adapters/freecut/test/audio-sync.integration.test.ts` · `EPERM … rename … .media-links.json` (carrera de archivos en Windows al correr suites en paralelo; ajeno a este cambio).

## Pendiente
- Actualizar `package-lock.json`/`tsconfig.json` raíz (A0): el paquete ahora depende también de `@fme/render-plan`.
- La caché no se poda (sin política de expulsión).
- El «documento nativo» de Revideo/Blender sigue siendo la propia capa del proyecto; `titulo.tsx` de la fixture no existe.
