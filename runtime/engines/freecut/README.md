# Motor FreeCut (wrapper CLI Nivel A, FDN-041)

Este directorio **no** duplica ni forkea FreeCut: envuelve los módulos oficiales `headless/lib/*` y `dist/headless.html` instalados fuera del repo (por defecto `C:\Users\bogex\Documents\Forgex\FME-ext\freecut`, configurable mediante `FME_FREECUT_DIR` o `--freecut-dir`).

## Uso

- Consultar versión fijada:
  `node runtime/engines/freecut/cli.mjs --version [--freecut-dir <ruta>]`
- Renderizar un job preparado por `@fme/adapter-freecut`:
  `node runtime/engines/freecut/cli.mjs --job <job.json> --out <out.mp4> --work-dir <dir> [--freecut-dir <ruta>] [--browser auto|msedge|chrome|playwright]`

Todo el workspace temporal de FreeCut se crea dentro de `--work-dir`, sin usar `os.tmpdir()` ni modificar el clon upstream.
