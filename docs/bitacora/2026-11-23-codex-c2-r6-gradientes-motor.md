# 2026-11-23 · FDN-061b Motor Blender y gradientes

- **Sesión** `codex-c2-r6` · **Rama** `fdn/FDN-061b-blender-gradientes`

## Hecho

- El motor lee `gradientOps` como una operación por fotograma local desde 0. Comprueba la longitud y los rangos numéricos antes de renderizar.
- Expresión controla el grosor y la opacidad de un contorno negro Freestyle en siluetas y bordes. Integración mezcla el material físico con una emisión plana donde hay un Principled BSDF, conserva su alpha y controla la energía de la luz de área entre el 55 % y el 100 % de la base. [API de Freestyle](https://docs.blender.org/api/5.2/bpy.types.FreestyleLineStyle.html)
- El render base conserva su configuración de Cycles CPU, cuatro muestras y fondo transparente.

## Verificado

- `blender -b --factory-startup --disable-autoexec --python-exit-code 1 -P render_scene.py -- params.json`, Blender 5.2.3, cubo sustituto de 96 × 96, cámara fija y seed 11. Cada secuencia recorrió valores 0, 0,5 y 1.
- Expresión con integración fija en 1 produjo 53, 128 y 458 píxeles con alpha > 15 y RGB máximo ≤ 40. La luminancia central permaneció en 132,86.
- Integración con expresión fija en 0 produjo luminancia central Rec.709 de 111,97, 118,75 y 132,86. La región midió 16 × 16 y usó píxeles con alpha > 250.
- Los extremos neutros de ambas curvas igualaron el SHA-256 RGBA del render sin gradientes. Las dos secuencias repetidas conservaron los tres hashes RGBA respectivos.
- `git diff --check` pasó en las rutas del motor.

## Pendiente

- Integración y suite conjunta a cargo de C0. Freestyle agrega pasos de render cuando el contorno está activo. El motor aplica la mezcla plana a materiales con Principled BSDF y una salida de superficie conectada.
