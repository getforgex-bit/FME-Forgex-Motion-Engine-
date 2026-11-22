# Arquitectura

> Fuente: especificación v0.1, §06, §07, §09, §10, §11, §12 y §13.

## 1. Dos mitades + módem inteligente

El núcleo se divide en dos mitades y un plano de ejecución independiente:

| Pieza | Pregunta que responde | Responsabilidades |
|---|---|---|
| **Mitad A: Dirección artística** (`packages/art-direction`) | **Qué** se busca | Recibe objetivos, referencias, restricciones y preferencias. Produce un plan estético por secuencia, plano, capa y objeto. Traduce las 5 técnicas y los 2 gradientes al vocabulario de capacidades de cada backend. Consulta reglas, plantillas y procedimientos. Revisa previsualizaciones e indica correcciones verificables. |
| **Mitad B: Proyecto universal** (`packages/project`) | **Qué existe** | Fuente de verdad de timeline, escenas, capas, recursos y animaciones. Mantiene identidad, relaciones, versiones, fuentes y derivados. Expone modificaciones no destructivas. Guarda referencias editables a documentos externos. **Su esquema no depende** de los campos internos de FreeCut, Revideo o Blender. |
| **Plano de ejecución: el módem** (`packages/connectors`, `packages/router`, `runtime/`) | **Con qué herramienta y cómo** | Registro dinámico de conectores (sin número fijo de "puertos"). Tarjetas simple y avanzada. Enrutador que compara capacidades, complejidad, tiempo, recursos y editabilidad. Planificador de trabajos y transferencias. Validación de permisos, errores, resultados y rutas alternativas. |

```
IA / USUARIO ──► Mitad A (qué) + Mitad B (qué existe) ──► Enrutador ──► Adaptadores ──► Motores externos
                                                                     ◄── artefactos + procedencia ──┘
```

## 2. Modelo universal de proyecto: el timeline primero

### Jerarquía
**Proyecto → Secuencias → Escenas/planos → Capas/grupos → Propiedades animables.**
Los recursos se guardan en un **catálogo separado** y se referencian por identificador.

| Entidad | Responsabilidad mínima |
|---|---|
| `Project` | Identidad, versión de esquema, FPS racional, resolución, seed, catálogo y secuencias |
| `Sequence` | Agrupación temporal con orden editorial y timeline |
| `Scene` / `Shot` | Rango de tiempo, cámaras, relaciones y composición |
| `Layer` / `Clip` | Referencia a asset o generador, recorte, posición, orden y propiedades |
| `Asset` | Original con URI, tipo, metadatos, hash, licencias y versiones |
| `Curve` / `Keyframe` | Animación de propiedades numéricas, discretas y de estado |
| `ExternalProjectRef` | URI, motor, versión, archivo editable de origen y vínculo al render derivado |
| `RenderArtifact` | Archivo generado, configuración, hash de dependencias y procedencia |

### Tiempo y composición
- El tiempo se expresa en **fotogramas enteros** o con **tasa racional explícita** (p. ej. `30000/1001`) para no acumular deriva.
- Los clips guardan entrada/salida del original, inicio en la timeline, duración, velocidad, canales de audio y sincronización.
- El orden visual depende de capas, grupos, profundidad y compositor.

### Editabilidad y fuentes de verdad
Toda producción distingue **original**, **proyecto editable externo**, **representación universal** y **render intermedio**. Un MP4 o PNG generado **no equivale** a una escena editable.

### Versionado
- Todos los archivos centrales llevan `schemaVersion`; cada adaptador registra `pluginId`/`pluginVersion`.
- Cuando cambien los formatos, se escriben **migraciones** y se mantienen **fixtures** de versiones anteriores.
- Un cambio en un backend no debe invalidar proyectos universales previos.

Detalle de tipos: [`contratos.md`](contratos.md).

## 3. Enrutador inteligente

### Modos operativos

| Modo | Comportamiento |
|---|---|
| Automático | FME filtra candidatos, pide datos avanzados cuando hace falta y elige una ruta compatible |
| Manual | El usuario/agente obliga a usar una herramienta o cadena; FME valida restricciones |
| Híbrido | El usuario fija herramientas o criterios para partes del trabajo; FME elige el resto |

### Secuencia de decisión
1. Traducir la tarea a **requisitos observables**: entrada, salida, transparencia, 2D/3D, editabilidad, calidad y plazo.
2. Consultar **solo tarjetas simples** para generar candidatos.
3. Descartar incompatibles. **Nunca afirmar compatibilidad por ausencia de datos.**
4. Consultar solo las secciones avanzadas pertinentes de los finalistas.
5. Comprobar disponibilidad, recursos, licencia/distribución y permisos.
6. Escoger una ruta única o un grafo de tareas, justificando las compensaciones de calidad y coste.
7. Ejecutar los trabajos y comprobar los artefactos resultantes.
8. Ante un error: reintentar de forma segura, simplificar, proponer sustituto o pedir aprobación.

### Factores de valoración
Fidelidad visual estimada, compatibilidad, editabilidad, tiempo de proceso, RAM/VRAM, necesidad de GPU, disponibilidad, complejidad, consumo de tokens del agente y confiabilidad. **La compatibilidad y los permisos son restricciones duras**: una buena puntuación de velocidad no compensa la falta de una transparencia indispensable.

### Rutas de ejemplo (no garantizan automatización completa)

| Solicitud | Ruta inicial sugerida | Motivo |
|---|---|---|
| Título SVG animado | Revideo → composición/FreeCut | No requiere 3D pesado |
| Personaje 2D artesanal | OpenToonz o pinceles/vector → render → editor | Dibujo y exposición de fotogramas |
| Cámara sobre ciudad 3D | Blender → render con alpha → compositor | Cámaras, escena y profundidad reales |
| Vídeo real con rótulo integrado | Editor + tracking/composición | Hay que armonizar el contenido con la grabación |
| Plano mixto complejo | 2D + Blender + composición → timeline | Divide la tarea por especialidad |

## 4. Operación para agentes de IA

- **API-first:** el núcleo expone una API coherente invocable desde TypeScript/JavaScript.
- **MCP como adaptador de esa API**, no como un segundo sistema.
- Agentes previstos: Claude, Codex y entornos como Antigravity, siempre que sus capacidades reales lo permitan.
- **Ahorro de contexto:** tarjetas simples para la exploración, procedimientos reutilizables, errores estructurados (no logs extensos), previsualizaciones muestreadas y re-ejecución solo de los segmentos afectados.
- **Seguridad:** no se acepta ejecución indiscriminada de código del agente en procesos privilegiados. Python en Blender o comandos de sistema exigen políticas explícitas: sandbox/proceso aislado, rutas permitidas, tiempo máximo, lista de acciones, permisos de escritura/red y confirmación para operaciones destructivas. El puente comunitario Blender MCP se revisa antes de habilitarlo en producción.

Herramientas MCP mínimas: ver [`contratos.md`](contratos.md#3-herramientas-mcp-mínimas).

## 5. Stack técnico y responsabilidades

| Tecnología | Responsabilidad | Razón |
|---|---|---|
| TypeScript | Proyecto universal, timeline lógico, reglas, registro, enrutador, MCP | Tipado y ecosistema JS para agentes |
| JavaScript / Node.js | Runtime del código TypeScript y compatibilidad web | No duplicar el núcleo en dos lenguajes |
| Rust | Operaciones pesadas, geometría/pinceles, caché, puente nativo | Rendimiento donde haya un cuello de botella **medido** |
| Python | Automatización de Blender y herramientas Python | Acceso a `bpy` y scripts de render |
| WGSL / GLSL | Shaders y efectos GPU cuando haga falta | Procesamiento gráfico acelerado |
| FFmpeg | Transcodificación, muxing, mezcla, exportación | Infraestructura audiovisual amplia |
| SQLite / JSON | Metadatos y contratos serializables | Arranque local simple |
| React / Tauri | Interfaz y escritorio (opcional) | UI reutilizable; no es requisito del primer hito |

PixiJS y Three.js pueden servir para previsualizaciones 2D/3D; Paper.js para trazos vectoriales; NAPI-RS para exponer Rust a Node; Blender Python para render y modelado; FreeCut sigue como editor inicial. **No se instalan todos los renderizadores alternativos a la vez.**

**Fases por lenguaje:** primero API y estructura en TypeScript; después integración por CLI y formatos existentes; por último, mover a Rust las operaciones cuyo perfil de tiempo/memoria lo justifique. No se escribe un motor nativo nuevo hasta probar insuficiencias concretas.

## 6. Interoperabilidad, composición y exportación

### Niveles de integración

| Nivel | Qué funciona | Qué se conserva |
|---|---|---|
| A. Archivo / CLI | Importar/exportar imagen, vídeo, audio, escena renderizada | Origen y parámetros si se guardan referencias |
| B. Adaptador estructurado | Modificar timeline, capas y parámetros compatibles | Subconjunto de propiedades editables mapeadas |
| C. Integración profunda / fork | Sincronizar documentos internos y operaciones complejas | Mayor editabilidad; coste de desarrollo superior |

### Formatos

| Formato | Propósito / limitación |
|---|---|
| JSON FME | Contrato del proyecto; no reemplaza archivos binarios |
| OTIO | Intercambio editorial de timeline/cortes; no representa todos los efectos ni rigs |
| SVG / Lottie | Vectores y animaciones compatibles, sujetos al backend |
| PNG RGBA / secuencia | Composición transparente intermedia; puede perder editabilidad vectorial |
| EXR | Imágenes y pases de precisión (color/depth/alpha según exportador) |
| glTF / GLB | Modelos y animaciones 3D compatibles |
| WAV / SRT / ASS | Audio y subtítulos interoperables |
| MP4 | Distribución final; normalmente no editable por capas |

### Flujo de composición
Un adaptador produce un artefacto temporal (tiempo, canales, dimensiones, color, transparencia, procedencia) → el compositor lo sincroniza en la timeline → el editor aplica montaje y mezcla → el exportador construye el vídeo final. **No se pierden los vínculos a los archivos nativos.**

### Color y audio
Hay que acordar una cadena de espacios de color y gestión de alpha (OpenColorIO queda registrado para color avanzado). El audio requiere timebase estable, sample rate explícito, niveles y sincronía.

## 7. Renderizado, previsualización y recursos

- **Renderizar** = calcular imágenes y sonido finales (o previsualizaciones e intermedios) a partir de dibujos, modelos, escenas, fotos, clips, tipografía y efectos.
- **Tres estrategias de rendimiento:** previsualización adaptativa (menor resolución o muestras), render por segmentos/capas y exportación final con la máxima calidad viable.
- **Entorno de referencia:** GPU RTX 3050 de **4 GB de VRAM**, ~23 GB de RAM y CPU Ryzen 7 4800H. El diseño debe funcionar con previsualizaciones prudentes y no cargar todo el proyecto en GPU a la vez.
- **Caché y determinismo:** la clave de un render intermedio se deriva de proyecto, segmento, assets y versiones de adaptadores. Si cambia una capa, se invalidan **solo los nodos dependientes**. La semilla procedural se fija cuando importe la reproducibilidad (el determinismo estricto puede estar limitado por la GPU, los códecs o los ejecutores externos).
- **Errores:** ante falta de memoria, reducir la vista previa, subdividir segmentos o usar otro backend compatible. La exportación final **informa de las restricciones reales** (no promete 4K ni ciertos efectos si el renderizador no los admite).
