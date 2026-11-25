# Glosario

> Fuente: especificación v0.1, §25, ampliado con explicaciones prácticas.

| Término | Significado en FME | Ejemplo práctico |
|---|---|---|
| **Módem** | Enrutador + registro dinámico de adaptadores. Decide con qué herramienta y cómo se ejecuta cada operación. | Recibe "anima este título SVG" y lo envía a Revideo en lugar de a Blender. |
| **Conector / adaptador** | Pieza que traduce instrucciones FME a operaciones de una herramienta concreta (CLI, API, biblioteca o MCP). | `adapters/blender` convierte una capa FME en un script `bpy` y devuelve el render. |
| **Tarjeta simple** | Resumen mínimo de un conector para descubrirlo y filtrarlo rápido (pocas líneas, pocos tokens). | `{ id, capabilities, accepts, produces, executor }` |
| **Tarjeta avanzada** | Detalles técnicos que solo se piden cuando hace falta verificar algo (alpha, VRAM, licencias…). | El router la consulta solo si el trabajo exige transparencia. |
| **MCP** (Model Context Protocol) | Protocolo estándar para que un agente IA invoque herramientas con contratos tipados. | Claude llama a `project.create` en el servidor MCP de FME. |
| **Timeline** | Organización temporal de clips, capas y escenas. Es la estructura central de FME. | Fondo en 0–300, personaje en 30–240, título en 180–300. |
| **Asset** | Recurso fuente: foto, vídeo, audio, SVG, modelo 3D, etc. Se referencia por ID desde las capas. | `char-source` = ilustración PNG del personaje. |
| **Render** | Cálculo o exportación de fotogramas/audio a partir de fuentes y operaciones. Incluye vistas previas e intermedios. | Blender genera una secuencia PNG RGBA del objeto 3D. |
| **Artefacto de render** | Archivo generado más su configuración, hash de dependencias y procedencia. | `render/3d-cam-v2.png-seq` + versión de Blender + seed. |
| **2.5D** | Planos 2D colocados en un espacio con profundidad para conseguir efecto espacial. | Bosque dibujado en varias capas con cámara en parallax. |
| **2D apoyado por 3D** | Se usa el 3D como referencia; el resultado final busca lenguaje 2D. | Pose 3D que sirve de guía para animar a mano un personaje. |
| **3D con 2D** | Base tridimensional con componentes dibujados visibles. | Objeto 3D con estelas y líneas de impacto dibujadas. |
| **Gradiente / espectro** | Control continuo (0–100) de una dimensión estética, animable en el tiempo. | Expresión de 20 → 75 a lo largo de 3 s. |
| **Fork** | Copia de un proyecto externo para evolucionar su código propio. En FME, solo ante una carencia demostrada. | Fork de FreeCut si no expone una operación necesaria. |
| **Editabilidad** | Capacidad real de reabrir y cambiar elementos generativos, no solo un vídeo final. | Reabrir el `.blend` original y cambiar la cámara sin rehacer todo. |
| **ADR** (Architecture Decision Record) | Documento breve que registra una decisión de arquitectura, su contexto y sus consecuencias. | `docs/decisiones/0002-…` |
| **Code Mode (pctx)** | Forma de usar MCP en la que la IA escribe TypeScript que llama a las herramientas y recibe solo el resultado, ahorrando contexto. | Ver [`memoria-y-registro.md`](memoria-y-registro.md). |
| **FPS racional** | Tasa de fotogramas expresada como fracción exacta para evitar deriva. | `{ num: 30000, den: 1001 }` = 29,97 FPS. |
