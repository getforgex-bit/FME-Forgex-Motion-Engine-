# Regresión audiovisual FDN-073a

Desde la raíz del repositorio, compila los workspaces con `npm run typecheck` y ejecuta `node --test tests/regresion/*.test.ts`. Las pruebas usan los adaptadores reales y crean sus proyectos, fuentes y salidas en directorios temporales por test.

Se usa `FME_BLENDER_PATH` para indicar Blender, `FME_FREECUT_DIR` para el clon compilado de FreeCut y `FME_REVIDEO_ENGINE_DIR` para un motor Revideo instalado. Si Revideo requiere localizar Chrome, indica su caché con `FME_PUPPETEER_CACHE_DIR`. `FME_FFMPEG_PATH` y `FME_FFPROBE_PATH` son opcionales si las herramientas están en el PATH. Un motor o navegador ausente produce una omisión con motivo. Un fallo de render o una diferencia respecto de la referencia hace fallar la prueba.

| Motor | Job fijo a 30 FPS | Base de comparación |
|---|---|---|
| Blender 5.2.3 | Cubo sustituto, semilla 11, órbita 0°→12°, 3 PNG a 96 × 64 | SHA-256 RGBA de cada fotograma en orden, según la procedencia del adaptador. |
| Revideo 0.11.0 | SVG local de colores planos sin fuentes, 12 fotogramas a 96 × 64 | SHA-256 de vídeo decodificado a YUV420p por FFmpeg. |
| FreeCut 0.0.0+5ceeeb38 | Pista MP4 generada con `testsrc2`, 12 fotogramas a 320 × 240 | SHA-256 de vídeo decodificado a YUV420p según procedencia y verificado con FFmpeg. |

Los baselines se obtuvieron en Windows con FFmpeg 9.0.2 y Chrome for Testing 157.0.8103.78 para Revideo. Los hashes comparan píxeles en orden y excluyen metadatos de archivo. Los hashes de los MP4 cubren la pista de vídeo. La prueba de Blender renderiza además la misma escena con la órbita desplazada +30° y exige que el comparador informe `contentSha256 cambió`.

## Revisar una actualización

1. Ejecuta el modo de candidatos y conserva la salida del job material que cambió. El comando imprime la versión y los hashes sin escribir los archivos esperados.

   ```powershell
   $env:FME_REGRESSION_CANDIDATES = '1'
   node --test tests/regresion/*.test.ts
   Remove-Item Env:FME_REGRESSION_CANDIDATES
   ```

2. Comprueba resolución, fotogramas, apariencia y causa del cambio. Pide a A0 que revise los candidatos junto con el cambio que los produjo.
3. Tras la revisión de A0, actualiza únicamente los archivos aprobados en `expected/`, documenta el entorno y ejecuta de nuevo la suite sin el modo de candidatos.
