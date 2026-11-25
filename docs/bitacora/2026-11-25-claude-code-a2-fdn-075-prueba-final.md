# 2026-11-25 · claude-code-a2 · FDN-075 Prueba híbrida final (informe de los 8 criterios)

## Hecho
- `scripts/prueba-hibrida.mjs`: un único comando que ejecuta, con los motores reales, las pruebas que respaldan cada criterio (`node --test` con reportero TAP) y genera `examples/prueba-hibrida-10s/INFORME.md`: comando, resultado (pasan/fallan/omitidas), tiempo y SHA-256 de cada paso, versiones de los motores (probe real de Revideo, Blender y FreeCut, FFmpeg), commit, SO, CPU, RAM y GPU.
- Regla de verdad: «superado» solo si todas las pruebas del criterio se ejecutaron y pasaron; una prueba omitida (falta un motor) → «no ejecutado»; fallo → «fallido»; si aún no existe la prueba → «pendiente». El criterio #7 sale «pendiente de FDN-074» (falta `packages/pipeline/test/av-sync.integration.test.ts`); cuando exista, el script la ejecutará sin cambios.
- Criterio #3 incluye un paso extra: `fme project export` de la fixture híbrida (1280×720) con SHA-256 del MP4 y del proyecto enlazado. Opciones: `--only 1,3,8`, `--informe`, `--sin-artefacto`, `--estricto`. Salida 1 si hay algún fallido (o, con `--estricto`, si no son 8/8).
- Mapeo: #1 tests de integración de cada adaptador (sucesores de los `run.ps1` de la F1; esos scripts no se ejecutan); #2 project/{schema,serialize,migrate,fixtures}; #3 pipeline + export CLI; #4 router real-adapters; #5 router (tokens, real-adapters) + recovery real-fallbacks; #6 gradientes de Revideo y Blender; #7 av-sync; #8 incremental.

## Verificado
- `node scripts/prueba-hibrida.mjs` completo con motores reales (Revideo 0.11.0, Blender 5.2.3, FreeCut 0.0.0+5ceeeb38, FFmpeg 9.0.2; RTX 3050 4 GB): **7/8 superados, 0 fallidos, 1 pendiente (#7)**, unos 10 min. Informe en `examples/prueba-hibrida-10s/INFORME.md`.
- Sin Revideo instalado (mi worktree antes del enlace) el script marcó el criterio afectado sin «superado»: probado con `--only 2,4,5,7`.

## Avisos
- **Ruta larga:** en mi worktree (`…\.claude\worktrees\fdn-021-esquema-5e2860\…`) `real-fallbacks.integration.test.ts` falla con `ENAMETOOLONG` en Chromium (`mkdtemp … playwright_chromiumdev_profile`); no es un fallo de código. El informe definitivo lo ejecuté en un worktree temporal de ruta corta (`C:\fw`, ya eliminado), de ahí que el informe cite el commit `ba48fdd` (script, sin el último retoque del formato de tiempos de la consola) y «HEAD». A0 debería regenerarlo en su checkout (`node scripts/prueba-hibrida.mjs`).
- Revideo: las pruebas buscan el motor en `runtime/engines/revideo` (no respetan `FME_REVIDEO_ENGINE_DIR`); usé una junction a la `node_modules` del worktree de A1 (no versionada). Chrome vía `FME_PUPPETEER_CACHE_DIR`.
- El hash del MP4 depende del codificador y puede variar entre ejecuciones; los de las pruebas son los de sus fuentes.
