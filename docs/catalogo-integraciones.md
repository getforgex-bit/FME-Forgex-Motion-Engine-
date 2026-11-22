# Catálogo de integraciones

> Fuente: especificación v0.1, §14–§17 y Anexo C (§24).
> **Alcance congelado:** no se proponen integraciones nuevas fuera de este catálogo.
> **Prioridad inicial ≠ funcionamiento comprobado.** Las licencias citadas se refieren al proyecto principal y requieren auditoría de distribución y dependencias (ver [`licencias-seguridad.md`](licencias-seguridad.md)).

Estado de verificación en este repositorio: **ninguna herramienta está verificada todavía** (eso es la Fase 1). Al verificarlas, actualiza la columna "Verificado" con la versión fijada y un enlace a la entrada de la bitácora.

## 1. Núcleo inicial (cadena de prueba)

| Herramienta | Rol acordado | Situación según la spec | Verificado |
|---|---|---|---|
| **FreeCut** | Editor/timeline principal: capas, clips, texto, efectos y exportación | Conector 1; MIT; requiere Chromium moderno para el flujo completo [S1] | ☐ |
| **Revideo** | Motor de animación y vídeos por código TypeScript | Conector 2; MIT; render programático [S2] | ☐ |
| **Blender** | Modelado, cámaras, rigging, 3D, Grease Pencil y render | Conector 3; GPL; automatización `bpy` [S3] | ☐ |
| Blender MCP | Puente comunitario de IA con Blender | Complemento opcional; no oficial [S4] | ☐ |
| FFmpeg | Procesado y exportación audiovisual | Transversal; LGPL/GPL según configuración [S5] | ☐ |
| OpenTimelineIO | Intercambio de cortes y estructura editorial | Interoperabilidad; límites claros [S6] | ☐ |

**Restricciones conocidas**
- No hay que suponer que FreeCut expone hoy todas sus operaciones internas como API pública estable. El primer adaptador puede requerir integración a nivel de código o de importación/exportación.
- Revideo genera vídeos por código; hay que confirmar el empaquetado y los tipos de salida de la versión fijada.
- Blender por Python es más estable para lotes reproducibles que los comandos arbitrarios enviados por MCP.

**Rutas de la primera versión**
- **A:** script Revideo → salida con alpha o composición compatible → FreeCut.
- **B:** trabajo Blender → render secuencial o vídeo → FreeCut.
- **C:** recursos originales de vídeo/foto/audio → FreeCut.

El proyecto FME registra enlaces, in/out, timeline y procedencia. Ninguna ruta supone todavía edición bidireccional completa.

## 2. Dibujo y movimiento

| Pieza | Función en FME | Estado |
|---|---|---|
| libmypaint | Pinceles sensibles a dinámica, presión y textura | ISC [S7]; candidato para trazo artesanal |
| Paper.js | Curvas, vectores y edición geométrica | MIT; candidato |
| Rough.js | Bocetos y variaciones de línea | MIT; efectos concretos, no sustituye al artista |
| OpenToonz | Animación tradicional y flujo de fotogramas | BSD modificada en núcleo [S8]; externo |
| Krita | Pintura y animación raster | GPL; herramienta externa opcional |
| Synfig Studio | Interpolación y animación 2D vectorial/raster | GPLv3; opción especializada |
| ThorVG | Render SVG/Lottie y gráficos vectoriales | MIT [S9]; motor reutilizable |
| Lottie-web | Reproducción de animaciones Lottie | MIT; si el editor no cubre la necesidad |
| PixiJS | Vista previa 2D acelerada | Candidato de interfaz; no obligatorio |
| Vello | Renderizador vectorial en Rust | MIT/Apache-2.0; comparar, **no** integrar a la vez que ThorVG |
| Godot | Rigging, física, blend trees, animación programática | MIT; motor externo futuro |
| Rapier | Física 2D/3D | Apache 2.0; procesador opcional |

La combinación libmypaint + Paper.js + una herramienta de animación tradicional es una **propuesta funcional** para el acabado humano. No existe un puente listo que convierta automáticamente esos elementos en animación artesanal de cine: hace falta integración, referencias y dirección artística.

## 3. Edición, VFX y 3D

| Pieza | Función | Tratamiento |
|---|---|---|
| MLT Framework | Edición multipista, filtros y transiciones | Candidato si FreeCut limita; licencia por módulos [S10] |
| Natron | Composición por nodos, keying, rotoscopia | GPLv2 [S11]; externo, fase posterior |
| OpenFX | Estándar de plugins de efectos | SDK BSD-3 [S12]; implementar un host es trabajo grande |
| OpenCV | Análisis y tracking visual | Procesamiento futuro |
| SAM 2 | Segmentación de objetos en foto/vídeo | Evaluar hardware, pesos y condiciones |
| OpenColorIO | Gestión de color consistente | BSD-3 [S13]; etapa de composición avanzada |
| OpenEXR | Renders con canales y precisión elevados | Formato y bibliotecas, no editor |
| OpenImageIO | Procesamiento de imágenes multiformato | Biblioteca de infraestructura |
| Three.js | Cámara, profundidad y escenas 3D en navegador | Vista previa/escena ligera |
| glTF-Transform | Conversión/optimización glTF | Procesador de modelos |
| Assimp | Importación multiformato de modelos | Biblioteca opcional |
| meshoptimizer | Optimización de mallas | Biblioteca opcional |
| OpenUSD | Composición y referencias de escenas 3D | Intercambio avanzado; futuro |

**Alternativas discutidas, sin cambiar el plan:** OpenCut (editor alternativo; se mantiene FreeCut como base), mcut (SDK de edición TS/MCP interesante pero temprano), Remotion (adaptador opcional; **revisar su licencia** antes de cualquier uso comercial). Ninguna es dependencia obligatoria.

## 4. Audio, servicios y recursos

| Pieza | Función | Observación |
|---|---|---|
| Tone.js | Automatización y síntesis de audio en JS | Optativo |
| WaveSurfer.js | Forma de onda y UI de audio | Visualización |
| whisper.cpp | Transcripción local | Verificar rendimiento en el hardware |
| pysubs2 | Subtítulos SRT/ASS | Herramienta Python puntual |
| PySceneDetect | Detección de escenas/cortes | No duplicar si FreeCut basta |
| Rhubarb Lip Sync | Sincronización labial básica | No equivale a actuación facial completa |
| React Flow | Interfaz de nodos y pipelines | UI, no ejecutor |
| MCP TypeScript SDK | Servidor/cliente para agentes IA | Capa externa para operaciones FME [S14] |
| OpenRV | Revisión de imágenes y renders | Posterior |
| OpenCue | Render distribuido | No necesario en la primera PC |
| Poly Haven / ambientCG | HDRI, texturas, modelos, PBR (CC0) | Bibliotecas de recursos |
| OpenAssetIO | Gestión avanzada de recursos | Evaluación futura; no requisito v0.1 |

**Política de recursos:** cada asset lleva URI, autor/origen, licencia verificable, atribuciones, dimensiones, duración, formato, fecha de captura/descarga, hash y versiones derivadas. Que el motor sea open source **no implica** que cualquier asset usado se pueda vender o redistribuir.

## 5. Fuentes y repositorios de referencia

La existencia de un repositorio o su README **no sustituye** la validación con la versión fijada.

| Ref. | Proyecto | URL |
|---|---|---|
| S1 | FreeCut | https://github.com/walterlow/freecut |
| S2 | Revideo | https://github.com/midrender/revideo |
| S3 | Blender (FAQ/GPL) | https://www.blender.org/support/faq/ |
| S4 | Blender MCP comunitario | https://github.com/ahujasid/mcp-for-blender |
| S5 | FFmpeg (legal/licencia) | https://ffmpeg.org/legal.html |
| S6 | OpenTimelineIO | https://opentimelineio.readthedocs.io/ |
| S7 | libmypaint | https://github.com/mypaint/libmypaint |
| S8 | OpenToonz | https://github.com/opentoonz/opentoonz |
| S9 | ThorVG | https://github.com/thorvg/thorvg |
| S10 | MLT Framework | https://github.com/mltframework/mlt |
| S11 | Natron | https://github.com/NatronGitHub/Natron |
| S12 | OpenFX | https://github.com/AcademySoftwareFoundation/openfx |
| S13 | OpenColorIO | https://github.com/AcademySoftwareFoundation/OpenColorIO |
| S14 | SDK oficial MCP TypeScript | https://github.com/modelcontextprotocol/typescript-sdk |
| — | Paper.js | https://paperjs.org/ |
| — | Rough.js | https://github.com/rough-stuff/rough |
| — | Krita | https://krita.org/ |
| — | Synfig | https://github.com/synfig/synfig |
| — | Godot | https://github.com/godotengine/godot |
| — | Vello | https://github.com/linebender/vello |
| — | Rapier | https://rapier.rs/ |
| — | PixiJS | https://pixijs.com/ |
| — | Three.js | https://threejs.org/ |
| — | OpenEXR | https://github.com/AcademySoftwareFoundation/openexr |
| — | OpenImageIO | https://github.com/AcademySoftwareFoundation/OpenImageIO |
| — | OpenUSD | https://github.com/PixarAnimationStudios/OpenUSD |
| — | OpenRV | https://github.com/AcademySoftwareFoundation/OpenRV |
| — | OpenCue | https://github.com/AcademySoftwareFoundation/OpenCue |
| — | OpenAssetIO | https://docs.openassetio.org/ |
| — | Rhubarb Lip Sync | https://github.com/DanielSWolf/rhubarb-lip-sync |
| — | whisper.cpp | https://github.com/ggml-org/whisper.cpp |
| — | PySceneDetect | https://github.com/Breakthrough/PySceneDetect |
| — | Poly Haven | https://polyhaven.com/ |
| — | ambientCG | https://ambientcg.com/ |
| — | React Flow | https://reactflow.dev/ |
| — | mcut | https://github.com/mattppal/mcut |
| — | OpenCut | https://github.com/OpenCut-app/OpenCut |
| — | Remotion (licencia) | https://www.remotion.dev/license |
