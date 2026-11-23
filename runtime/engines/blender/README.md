# Motor Blender de FDN-040

El adaptador ejecuta este script versionado con Blender 5.2 en segundo plano y con la ejecución automática de scripts deshabilitada. El intérprete recibe un archivo JSON y, si existe, la ruta validada del asset como argumentos posicionales después de `--`. La aplicación crea un directorio de trabajo por job y el motor escribe `frames/frame-0001.png` y los fotogramas siguientes, junto con `render.json`. El informe identifica la versión de Blender y contiene el SHA-256 de los bytes RGBA8 decodificados de cada PNG, en orden de filas y sin metadatos.

El JSON contiene las dimensiones, la duración en fotogramas, el FPS racional, los canales de la capa y la semilla opcional. El fotograma local 0 corresponde al 1 de Blender. `x` e `y` desplazan la cámara en el plano de la imagen, `rotation` orbita en grados y `scale` controla el zoom. El código interpola las curvas lineales, suaves y de retención. Los demás canales permanecen disponibles en el proyecto para etapas posteriores.

El render de preview usa Cycles CPU, cuatro muestras y fondo transparente. El flujo admite GLB v2 autocontenido y mallas de archivos Blender preparados para el proyecto. Rechaza dependencias externas detectadas al importar. Si el asset falta, el adaptador invoca el motor sin esa ruta y devuelve el diagnóstico correspondiente. En ese caso, el motor usa un cubo biselado.
