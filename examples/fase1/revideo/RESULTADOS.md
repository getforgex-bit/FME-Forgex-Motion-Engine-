# FDN-010 · Verificación de Revideo (Fase 1, criterio #1, parte Revideo)

Estado: **VERIFICADO** en la PC de referencia (Windows 11, Node 24.21.0, npm 11.19.0, RTX 3050 Laptop 4 GB). Fecha: 2026-11-22/23.

## Veredicto
Revideo 0.11.0 renderiza **headless** desde código TS vía la API `renderVideo` (Puppeteer + Vite + FFmpeg). Un MP4 H.264 de 3 s a 30 FPS sale con **90 fotogramas exactos**, y un MOV ProRes 4444 sale con **alpha real**. Hay cuatro trampas que el adaptador (FDN-032) debe respetar (sección Limitaciones).

## Comando (repetible)
```powershell
cd examples/fase1/revideo
npm run verify        # = powershell -File run.ps1 (npm ci → Chrome → render mp4 + alpha → ffprobe → SHA-256 → mide recursos)
```
Primera ejecución: `npm ci` (~2 min) y descarga de Chrome (~1 min). La carpeta `out/` está ignorada por git.

## Versiones y origen (todo del registro npm; sin forks)
| Paquete | Versión | Licencia |
|---|---|---|
| @revideo/core, 2d, renderer, vite-plugin, ffmpeg, ui | 0.11.0 (exacta) | MIT |
| vite | 8.1.2 | MIT |
| typescript | 7.0.2 | Apache-2.0 |
| puppeteer (transitiva de renderer) | 25.18.1 | Apache-2.0 |
| Chrome for Testing (lo baja `puppeteer browsers install chrome`) | 157.0.8103.78 | binario de Google |
| @ffmpeg-installer/ffmpeg + win32-x64 (transitiva) | 4.1.0 (ffmpeg N-92722, 2018) | **paquete LGPL-2.1, binario GPLv3** |
| fluent-ffmpeg (transitiva) | 2.1.3 | MIT, **deprecada** |

`@revideo/ui` hace falta aunque no se use el editor: `@revideo/vite-plugin` hace `require.resolve('@revideo/ui/…')` y falla sin él. Instalación: 364 MB en `node_modules` + 443 MB de Chrome en `out/.puppeteer`.

## Upstream (https://github.com/midrender/revideo, consultado vía API pública de GitHub)
Activo y no archivado: último push 2026-07-15, release 0.11.0 del 2026-07-10, MIT, 4 227 estrellas, 63 issues abiertas. Relevantes: #399/#400 (editor roto en Windows por rutas con `\`; **no afecta** al render headless), #401 (sin control de bitrate/CRF en el exportador FFmpeg), #373 (varias escenas con audio en un mismo render), #371 (audio local).

## Escena y salida
`src/scene.tsx`: rótulo «FME · Revideo» (aparece con fundido), círculo animado (traslación + rotación con `easeInOutCubic`) y barra que crece. 1280×720, 30 FPS, 3 s.

| Salida | Verificación (`ffprobe`) | SHA-256 |
|---|---|---|
| `out/fme-revideo.mp4` (37 KB) | h264, yuv420p, 1280×720, `r_frame_rate=30/1`, **`nb_read_frames=90`**, duración 3.000000 s | `02e2497b4e222e5f6b82d81925963b151176636f37f6a948dbabc6569d0ab6aa` |
| `out/alpha.mov` (~8 MB) | prores, yuva444p12le, 90 fotogramas, 30/1; fotograma 60 decodificado a PNG: modo RGBA, extremos de alpha = (0, 255) y píxel (5,5) = (0,0,0,0) | `63a2e9aa75d9d53169962f77b4d0e8e8a463616f9396c6df96a9a39bc2f3e2a4` |


El MP4 dio el mismo hash en 3 ejecuciones (incluida una con `node_modules` borrado) y el MOV en 2: salida determinista en esta máquina.

## Medidas (3 ejecuciones de `run.ps1`)
| Render | Tiempo total (arranque Vite+Chrome incluido) | RAM pico (árbol de procesos) |
|---|---|---|
| MP4 | 8,7 s / 12,5 s | 708 / 883 MB |
| MOV alpha | 9,8 s / 9,2 s | 1 078 / 1 074 MB |

**VRAM: 0 MiB** usada según `nvidia-smi` (base y pico) → Chrome headless renderiza el canvas por software; la GPU no interviene. Es cuello de botella de CPU, no de los 4 GB de VRAM. No se midió escalado con escenas complejas ni 1080p.

## Limitaciones y hallazgos (importan a FDN-032)
1. **Un fotograma de más:** el rango es inclusivo; una escena de 3,0 s con rango por defecto da **91** fotogramas. Para 90 hay que pasar `projectSettings.range = [0, 2.96]` (`ceil(2.96·30)=89` → fotogramas 0..89). El adaptador debe calcular `(frames-1)/fps` y restar un margen.
2. **Exportador wasm (el valor por defecto de `renderVideo`) produce un MP4 vacío** (156 bytes, sin streams) en este entorno y luego falla con `Invalid duration specification for t: N/A`. Se evita con el exportador `@revideo/core/ffmpeg`. Causa raíz no investigada (POR VALIDAR; el renderer fuerza `--single-process` en Chrome).
3. **Alpha:** `background: null` en el proyecto, y el `background` de `projectSettings`, **no dan transparencia**: se queda negro opaco (el override se ignora si es falsy). Funciona con `background: 'rgba(0,0,0,0)'` en la definición del proyecto (`src/project.alpha.ts`). El alpha solo sale por **ProRes 4444 `.mov`** (yuva444p12le); VP9 `.webm` con alpha existe en el código (`yuva420p`) pero **no se probó**.
4. **Secuencia PNG: NO disponible en headless.** `renderVideo` lanza un error explícito si se pide `@revideo/core/image-sequence` (solo desde el editor). Como alternativa, extraer PNG del `.mov` con ffmpeg.
5. El MP4 lleva una pista de audio AAC silenciosa añadida automáticamente aunque la escena no tenga audio.
6. **FPS y timebase:** solo se verificó 30 FPS entero (`r_frame_rate=30/1`; timebase del MP4 `1/15360`). NTSC fraccionario (30000/1001) y FPS variable: **no probados** (`fps` del proyecto es un número, no un racional → posible fricción con el `Fps {num, den}` de `@fme/project`).
7. **Resolución verificada:** solo 1280×720.
8. **Licencia del binario ffmpeg:** el paquete `@ffmpeg-installer/win32-x64` declara **GPLv3** y es un ffmpeg de 2018. Si FME redistribuye un instalador con Revideo, esto requiere revisión (candidato a ADR; alternativa: apuntar `ffmpeg` al del sistema mediante `FfmpegSettings`, no probado). Registrar en `docs/licencias-seguridad.md` (lo hace A0).
9. **Seguridad:** `npm audit` marca 1 vulnerabilidad *high* en `vite 8.0.0–8.1.5` (servidor de desarrollo: `launch-editor`, middleware, `server.fs.allow`). El renderer levanta un servidor Vite local por render (puerto base 9000). Mitigación probable: subir a vite ≥ 8.3.8 y reprobar; **no hecho**. Los scripts de instalación no se ejecutaron (npm 11 los bloquea); el `postinstall` de `@revideo/telemetry` (crea un id en `~/.revideo`) quedó sin correr y se exporta `DISABLE_TELEMETRY=true`; si la telemetría se desactiva realmente es POR VALIDAR (no se inspeccionó el tráfico).
10. **Aislamiento:** el render escribe en `os.tmpdir()` (`revideo-<nombre>-<id>`) y abre un puerto local; el adaptador debe fijar `outDir`, timeouts y limpiar el temporal.

## Tarjetas
`card.simple.json` y `card.advanced.json` (valores `yes/no/unknown` basados solo en lo anterior). `executor: "library"` porque la API pública es `renderVideo()` de Node; `editability: "native"` (el `.tsx` es el documento fuente) pero no se reabre un proyecto FME desde el MP4.

## Pendiente (no verificado)
Audio real, vídeo como entrada, 1080p y escenas pesadas, FPS fraccionario, WebM-alpha, exportador wasm (causa), vite parcheado, ffmpeg del sistema, ejecución en otra máquina (la aceptación «otra sesión desde cero» está cubierta solo por una segunda ejecución propia con `node_modules` borrado; Chrome estaba en caché).
