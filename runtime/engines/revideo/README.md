# Motor Revideo de FME

Proyecto npm **aislado** (fuera de los workspaces de la raíz, ADR-0011) que usa el adaptador `@fme/adapter-revideo`. Parte de `examples/fase1/revideo` (FDN-010/016).

## Instalar
```powershell
cd runtime/engines/revideo
npm ci --prefer-offline        # ~364 MB; @revideo/* 0.11.0 exactos y vite 8.3.8
```
Chrome no viene con `npm ci` (npm 11 bloquea los scripts de instalación). Descárgalo una vez (~443 MB) o reutiliza uno existente:
```powershell
$env:PUPPETEER_CACHE_DIR = "$PWD/out/.puppeteer"; npx puppeteer browsers install chrome
```
El adaptador lee la caché de `FME_PUPPETEER_CACHE_DIR`. FFmpeg y ffprobe del sistema (ADR-0010): `FME_FFMPEG_PATH` / `FME_FFPROBE_PATH` o el PATH.

## Piezas
- `cli.mjs`: `--scene job.json --out salida.mp4|.mov [--alpha] --ffmpeg <ruta> --ffprobe <ruta>` y `--version`. Códigos de error JSON en stderr (`engine-missing`, `unsupported-fps`, `bad-args`, `bad-job`).
- `src/scene.tsx`: dibuja UNA capa (texto o SVG) y aplica por fotograma los canales ya muestreados por el adaptador.
- `src/project.ts` (opaco) y `src/project.alpha.ts` (`rgba(0,0,0,0)`; `null` queda negro opaco en 0.11.0). 1920×1080 por defecto, tamaño real por `projectSettings.size`; **30 FPS fijos**.
- `ffmpeg-compat.mjs`: parche de `fluent-ffmpeg` para FFmpeg ≥ 7 (`lavfi`).
- El rango de Revideo es inclusivo: para N fotogramas se pide `(N-1)/fps - 0,5/fps`.

Salvo el temporal que usa Revideo en `os.tmpdir()`, el render escribe solo donde indica `--out`.
