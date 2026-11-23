# FDN-011 · Blender 5.2 headless

**VERIFICADO en la PC de referencia entre el 22 y el 23 de noviembre de 2026.** Dos ejecuciones desde directorios vacíos produjeron 90 fotogramas de 960 × 540 a 30 FPS (3 s), en PNG RGBA de 8 bits. Se comprobó el mismo SHA-256 de los píxeles RGBA en ambas secuencias.

## Entorno y reproducción

- Blender **5.2.3 LTS**, build **`e13b728c6880`**, release Windows. Verificado con `--version`.
- Windows 11 10.0.26200, AMD Ryzen 7 4800H (8 núcleos, 16 hilos), 23,42 GiB de RAM visible y NVIDIA GeForce RTX 3050 Laptop GPU de 4096 MiB.
- PowerShell en Windows y `ffprobe` 9.0.2 disponibles. La comparación adicional de píxeles usa `ffmpeg`. El muestreo de memoria de la GPU depende de que `nvidia-smi` esté disponible.
- Cycles en CPU, 4 muestras fijas por píxel, semilla 11 y fondo transparente. La escena incluye un cubo biselado con tres claves de rotación, una luz de área y una cámara fija.

Desde la raíz del repositorio, elige nombres de corrida nuevos:

```powershell
$blender = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
& $blender --version
.\examples\fase1\blender\run.ps1 -RunName fdn011-f
.\examples\fase1\blender\run.ps1 -RunName fdn011-g
```

`run.ps1` crea `out/<corrida>/` y ejecuta el equivalente a este comando con rutas absolutas:

```powershell
& $blender -b --factory-startup --disable-autoexec --python-exit-code 1 `
    -P $scriptPath -- $outputPath
```

Solo ejecuta `render_scene.py`, que forma parte de este ejemplo. El proceso tiene un límite de 15 minutos. El script rechaza nombres de corrida ya existentes y conserva sus archivos. `out/` está ignorado por Git. Cada corrida guarda los PNG, `report.json`, `render.json`, `SHA256SUMS` y los registros de los procesos.

## Evidencia de aceptación

`ffprobe` contó 90 fotogramas y devolvió `960 × 540`, `rgba` y `30/1` con la cadencia indicada al demuxer `image2`. El script `bpy` fijó de forma independiente 30 FPS en la escena y registró ese valor en `render.json`. En cada PNG, `System.Drawing` leyó alpha 0 en (0, 0) y 255 en (480, 270). Hubo 76 colores distintos en el píxel central a lo largo de la animación.

| Corrida | Proceso Blender, s | Media por fotograma, s | Mín. a máx. por fotograma, s | Pico RAM Blender, MiB | Lecturas VRAM | VRAM observada, MiB |
|---|---:|---:|---:|---:|---:|---:|
| `fdn011-f` | 26,082 | 0,2475 | 0,1706 a 0,9876 | 292,03 | 26 | 0 a 0 |
| `fdn011-g` | 33,930 | 0,3216 | 0,2150 a 0,4428 | 291,14 | 33 | 0 a 0 |

El tiempo por fotograma incluye render y escritura PNG. La RAM es el pico del conjunto residente del proceso Blender, leído cada 250 ms. La VRAM es el uso global de la GPU que reportó `nvidia-smi` cada segundo, con precisión de MiB. Cycles estaba configurado para CPU.

El archivo `SHA256SUMS` conserva el SHA-256 de cada PNG. Estos fueron los SHA-256 de los manifiestos:

- `fdn011-f` · `571a23e281d86250351e23fa4b84959f0eecb86f5a8f62f3acb0c5aed3cb91ac`
- `fdn011-g` · `dd1de49af8c6cf9caa70a348b126023a9fef31581327f2b731c6d401c9a9a6d4`

Blender escribe metadatos variables de fecha y duración del render en los bloques `tEXt` de los PNG. Al decodificar los 90 fotogramas en orden, ambas corridas devolvieron `SHA256=c9706f102905154468b84ca85189eb339e4128eebcce7946e64d61cfa96c450b`:

```powershell
foreach ($run in 'fdn011-f', 'fdn011-g') {
    $frames = "examples/fase1/blender/out/$run/frame-%04d.png"
    ffmpeg -v error -f image2 -framerate 30 -start_number 1 -i $frames `
        -c:v rawvideo -pix_fmt rgba -f hash -hash sha256 -
}
```

## Tarjetas y alcance

Las tarjetas se validaron con TypeScript contra `CardSimple` y `CardAdvanced` del contrato 0.1 y se comprobó que comparten el ID `adapter.blender`. La capacidad de CLI describe el script local de confianza y la producción de PNG.

| Campo | Valor | Evidencia |
|---|---|---|
| `headless` | `yes` | Ejecución `blender -b -P` sin interfaz. |
| `alpha` | `yes` | PNG RGBA y muestras alpha 0 y 255 en todos los archivos. |
| `keyframes` | `yes` | Tres claves de rotación y cambios de color medidos entre fotogramas. |
| `audioInPngSequence` | `no` | La salida de este flujo consta de fotogramas PNG. |
| `depth`, `gpuCompute` | `unknown` | Salida suplementaria de profundidad y render con GPU pendientes de prueba. |
| `editability` | `unknown` | La escena se regenera desde Python. Reapertura en un proyecto nativo pendiente de prueba. |

Los valores `verified*` describen la configuración ensayada. La revisión de licencia de esta versión queda pendiente. Esta evidencia cubre la parte Blender del criterio de Fase 1. FDN-040 conserva como dependencias el registro de conectores y el runtime de procesos.
