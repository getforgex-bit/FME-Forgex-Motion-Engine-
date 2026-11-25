# 2026-11-23 · claude-code-a2 · FDN-080c `project.export` real (MCP y CLI)

## Hecho
- `apps/mcp/src/export.ts` (nuevo; subruta `@fme/mcp/export`): `exportProject` llama a `runHybrid` de `@fme/pipeline` usando **solo su firma pública** (`runHybrid(projectPath, outDir, options)`); el pipeline se carga bajo demanda. Variables reconocidas: `FME_REVIDEO_ENGINE_DIR` (se inyecta un `RevideoAdapter`, porque `HybridOptions` no expone esa carpeta), `FME_PUPPETEER_CACHE_DIR`, `FME_FFMPEG_PATH`, `FME_FFPROBE_PATH`, `FME_BLENDER_PATH`, `FME_FREECUT_DIR`.
- MCP `project.export {path, outDir?, blenderResolution?, timeoutMs?}`: `path` y `outDir` validados con `resolveInRoot` (por defecto `.fme-exports/<uuid>`). CLI `fme project export <archivo> --out <dir> [--blender-resolution WxH] [--timeout ms]`.
- Errores estructurados: `ENGINE_UNAVAILABLE` (falta un motor; **no se ejecuta ningún paso**, `details.progress` vacío; CLI sale con 3), `NO_CONNECTOR`, `INVALID_PROJECT`, `FILE_NOT_FOUND`, `OUT_DIR_NOT_EMPTY` (no se sobrescribe un export anterior), `INVALID_RESOLUTION`, `PATH_OUTSIDE_ROOT` y `EXPORT_FAILED` (con el progreso hasta el fallo).
- Salida JSON: `mp4`, `projectPath`, `summary`, `progress[]` (por paso: `step`, `layerId`, `operation`, `adapterId`, `status`, `durationMs`, `outputs`, `diagnostics`), `adaptersInProvenance` y `artifacts[]`.
- `preview.inspect` es ahora la única herramienta `NOT_IMPLEMENTED`.
- Helper de pruebas `apps/mcp/test/hybrid-input.ts` (entradas reales a 1280×720 con FFmpeg, igual que el test del pipeline).

## Verificado
- Sin motores: `npm run typecheck` sin errores; `npm test`: 216 pass, 1 fail (el test intermitente de `packages/cache` «escrituras concurrentes»; aislado, 11/11 dos veces), 14 skipped (con motivo).
- **Con los tres motores reales** (Revideo y Chrome del worktree `fdn-010-revideo-33dac4` vía `FME_REVIDEO_ENGINE_DIR` y `FME_PUPPETEER_CACHE_DIR`; Blender 5.2 y FreeCut en sus rutas por defecto; nada descargado): CLI 102 s y MCP 180 s, ambos con MP4 de 300 fotogramas, 30 FPS, 1280×720 (`probe-media`), todos los pasos `ok`, los tres adaptadores en la procedencia y `renderArtifactId` resoluble en las capas título, 2D y 3D.

## Límites
- `runHybrid` no emite eventos: el progreso por pasos se entrega **al terminar**, no en vivo. El cliente MCP debe ampliar su `timeout` de petición (la exportación tarda 1,5–3 min; el SDK usa 60 s por defecto) o quedará en manos de A0 pedir un callback de progreso a A1.
- Los tests reales de MCP y CLI ejecutan los tres motores a la vez: en paralelo con el test del propio pipeline compiten por la GPU de 4 GB; si falla por memoria, `--test-concurrency=1`.
- No se cubre el cambio de A1 en curso (FDN-075a, caché) más allá de la firma pública.

## Pendiente para A0
- `package-lock.json`: `@fme/mcp` añade `@fme/pipeline` (y las de FDN-080b); revertí mi lockfile local.
