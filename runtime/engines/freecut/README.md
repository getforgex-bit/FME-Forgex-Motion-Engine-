# Motor FreeCut (wrapper CLI Nivel A, FDN-041 / FDN-042a / FDN-074a)

Este directorio **no** duplica ni forkea FreeCut: envuelve los módulos oficiales `headless/lib/*` y `dist/headless.html` instalados fuera del repo (por defecto `C:\Users\bogex\Documents\Forgex\FME-ext\freecut`, configurable mediante `FME_FREECUT_DIR` o `--freecut-dir`).

## Uso

- Consultar versión fijada:
  `node runtime/engines/freecut/cli.mjs --version [--freecut-dir <ruta>]`
- Renderizar/componer un job preparado por `@fme/adapter-freecut` (`edit.export` y `edit.compose`):
  `node runtime/engines/freecut/cli.mjs --job <job.json> --out <out.mp4> --work-dir <dir> [--freecut-dir <ruta>] [--browser auto|msedge|chrome|playwright]`

## Capacidades empíricas en composición (`edit.compose`)
- Pistas múltiples ordenadas por `zIndex` ascendente, rango `[startFrame, startFrame + durationFrames)`, `sourceInFrame` y dimensiones `transform.width` / `transform.height`.
- Overlays con canal alpha nativo comprobado: WebM VP9 (`yuva420p`), MOV ProRes 4444 (`yuva444p10le` / `yuva444p12le`) y PNG RGBA (`preserveAlpha` / `opacity < 1` para evitar la poda de oclusión en `frame-occlusion.ts`).
- Audio y sincronía A/V (`FDN-074a`): exportación MP4 AAC estéreo fijada a `48000 Hz` (`audioSampleRate: 48000`), soporte de pistas WAV (`audio/wav` / `audio/x-wav`) en pistas dedicadas (`addTrack({ kind: 'audio' })`) para convivir sin colisiones con el audio embebido de vídeo (`track-2`), remuestreo automático de WAV no-48 kHz (p. ej. 22050 Hz / 44100 Hz) y conversión de ganancia lineal FME (`volume`) a dB (`[-60, +12]`, `0 dB` = `1.0`) sobre pistas de audio y compañeros vinculados.
- Todo el workspace temporal de FreeCut se crea dentro de `--work-dir`, sin usar `os.tmpdir()` ni modificar el clon upstream.
