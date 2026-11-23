# 2026-11-23 · claude-code-a2 · FDN-080b `preview.render` real y lógica compartida MCP/CLI

## Hecho
- `apps/mcp/src/ops.ts` (nuevo, exportado como `@fme/mcp/ops` sin cargar el SDK de MCP): `loadProjectFile`, `findLayer`, `summarize`, `buildRegistry`, `routeTaskFor`, `renderLayer`, `buildPreviewProject` y `previewRender`, más `OpsError`. MCP y CLI son ahora adaptadores finos sobre esa lógica (se eliminó la duplicación de FDN-081: resumen, carga, localización de capa, enrutado y ejecución del job).
- `preview.render` (MCP) y `fme preview render <archivo> --layer <id> --out <dir> [--start --end --vram --alpha --timeout]` (CLI): `@fme/render-plan` (`selectPreviewProfile` + `planSceneRender`, perfil de 4 GB = 4096 MiB por defecto → 960×540 para 1920×1080) + el adaptador enrutado. Se deriva un proyecto de una capa a la resolución del perfil, con el rango pedido; las curvas se muestrean fotograma a fotograma (como las evalúa el motor), x/y y `fontSize` se escalan, y el asset SVG se copia junto al derivado. Sin motor: `ENGINE_UNAVAILABLE` (CLI salida 3) sin ejecutar nada.
- `project.export` y `preview.inspect` siguen devolviendo `NOT_IMPLEMENTED` (export espera a `@fme/pipeline`, FDN-042c, de A1; no se duplica).
- `main.ts` de MCP: `FME_REVIDEO_ENGINE_DIR` cambia la carpeta del motor.

## Verificado
- Sin motor: `npm run typecheck` sin errores; `npm test`: 200 pass, 0 fail, 10 skipped (los skips son los tests con motor real, con motivo).
- Con motor real (el de otro worktree local, `FME_REVIDEO_ENGINE_DIR=…/fdn-010-revideo-33dac4/runtime/engines/revideo`; no se descargó nada): test MCP `preview.render` del título → MP4 960×540 y 120 fotogramas medidos con `scripts/probe-media.mjs`; CLI 11/11, incluidos `job run` y `preview render` (960×540, 30 fotogramas con `--start 0 --end 30`).

## Límites conocidos
- El temblor (`jitter`) de los gradientes se siembra por fotograma relativo a la capa derivada: una preview de un rango no reproduce el mismo temblor que ese tramo del render completo. Tampoco se escalan `strokeWidth`/sombras de los gradientes con la resolución.
- Solo capas `text` y `svg`/`drawing` con SVG (las que pinta Revideo); otras dan `NO_CONNECTOR`.
- `preview.render` escribe en `<raíz>/.fme-jobs/<id>/` (MCP) o `<out>/<id>/` (CLI).

## Pendiente para A0
- Regenerar `package-lock.json`: `@fme/mcp` añade `@fme/adapter-revideo` y `@fme/render-plan` (y pasa a dependencia de `@fme/cli`). Yo probé con un `npm install` local y revertí el lockfile.
- `docs/contratos.md` §3 si procede (preview.render implementado).
