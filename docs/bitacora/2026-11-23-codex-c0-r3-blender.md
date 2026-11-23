# 2026-11-23 · FDN-040 · Motor Blender

- **Sesión** `codex-c0-r3` · **Rama** `fdn/FDN-040-adapter-blender`

## Hecho

- Implementé el motor de Blender que recibe parámetros JSON y un asset opcional, construye una escena declarativa, asigna el fotograma FME 0 al Blender 1 y genera la secuencia PNG RGBA con Cycles CPU.
- Mapeé los canales espaciales a la cámara y añadí el SHA-256 del RGBA8 decodificado de cada fotograma. La escena admite GLB autocontenido y mallas .blend, con un cubo si falta el asset.

## Verificado

- Blender `5.2.3` ejecutó `-b --factory-startup --disable-autoexec --python-exit-code 1 -P render_scene.py -- request.json [asset]` en directorios temporales separados para el cubo, GLB y .blend. Cada corrida generó dos PNG de 96 × 54 a 30000/1001 con hashes distintos entre fotogramas de zoom distinto.
- `ffmpeg -v error -i <png> -c:v rawvideo -pix_fmt rgba -f hash -hash sha256 -` confirmó los seis hashes declarados por el motor.
- El primer chequeo de .blend identificó la biblioteca de origen como externa. La corrección distingue esa biblioteca de dependencias adicionales. El Blender local necesitó un directorio temporal fuera de la redirección del sandbox para guardar las fixtures de prueba.
- CodeGraph localizó el script y sus funciones de entrada, render y hash.

## Pendiente

- C1 valida el contrato extremo a extremo con dos renders de 150 cuadros, procedencia, cancelación al vencer el timeout y prueba de conformidad.
