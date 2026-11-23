# Motor FreeCut (wrapper CLI Nivel A, FDN-041 / FDN-042a)

Este directorio **no** duplica ni forkea FreeCut: envuelve los módulos oficiales `headless/lib/*` y `dist/headless.html` instalados fuera del repo (por defecto `C:\Users\bogex\Documents\Forgex\FME-ext\freecut`, configurable mediante `FME_FREECUT_DIR` o `--freecut-dir`).

## Uso

- Consultar versión fijada:
  `node runtime/engines/freecut/cli.mjs --version [--freecut-dir <ruta>]`
- Renderizar/componer un job preparado por `@fme/adapter-freecut` (`edit.export` y `edit.compose`):
  `node runtime/engines/freecut/cli.mjs --job <job.json> --out <out.mp4> --work-dir <dir> [--freecut-dir <ruta>] [--browser auto|msedge|chrome|playwright]`

## Capacidades empíricas en composición (`edit.compose`)
- Pistas múltiples ordenadas por `zIndex` ascendente, rango `[startFrame, startFrame + durationFrames)`, `sourceInFrame` y dimensiones `transform.width` / `transform.height`.
- Overlays con canal alpha nativo comprobado: WebM VP9 (`yuva420p`), MOV ProRes 4444 (`yuva444p10le` / `yuva444p12le`) y PNG RGBA (`preserveAlpha` / `opacity < 1` para evitar la poda de oclusión en `frame-occlusion.ts`).
- Todo el workspace temporal de FreeCut se crea dentro de `--work-dir`, sin usar `os.tmpdir()` ni modificar el clon upstream.
