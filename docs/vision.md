# Visión, objetivos y principios

> Fuente: especificación v0.1, §01–§05. Estado de las afirmaciones según las [convenciones de certeza](README.md#convenciones-de-certeza).

## 1. Definición del producto

FME es un **motor integral de producción audiovisual procedural** orientado a agentes de IA y desarrolladores. Deberá:

- editar vídeo convencional;
- generar motion graphics;
- dibujar y animar 2D con apariencia artesanal;
- trabajar con 3D;
- componer recursos heterogéneos.

La IA expresa **intención artística** y/o escribe **código**; FME traduce esa intención en **operaciones verificables** sobre motores existentes.

## 2. Objetivos de diseño

1. **Integración rápida:** reutilizar software open source operativo antes de hacer modificaciones profundas.
2. **Dirección artística asistida por IA:** estética intencionada, composición legible, naturalidad y continuidad; no simple aleatoriedad visual.
3. **Timeline como centro** del proyecto y edición no destructiva de los recursos originales.
4. **Cinco técnicas de animación** combinables simultáneamente y a cualquier escala temporal.
5. **Espectros graduales** de expresión visual y fusión audiovisual, modificables con curvas en el tiempo.
6. **Arquitectura "módem":** conectores con entradas y salidas definidas, registro dinámico y sustitución de piezas.
7. **Enrutamiento inteligente** automático, manual o híbrido, con selección justificada de herramientas.
8. **Operación code-native, API-first y MCP-ready**, con poco consumo de contexto para la IA.
9. **Posible comercialización futura**, sujeta a auditoría de licencias y dependencias.
10. **Rendimiento adaptativo** según el equipo, sin reducir innecesariamente la calidad final.

## 3. Principios innegociables

> **La técnica se adapta a la visión artística, no al revés. Ninguna herramienta externa define por sí sola el proyecto universal.**

- No se exige un solo motor por vídeo, escena o plano. Un mismo objeto puede combinar técnicas.
- La IA puede elegir, o el usuario imponer restricciones.
- Cada integración debe poder cambiarse por otro adaptador **sin rediseñar el proyecto**.
- El núcleo **no usa IA para microdecisiones deterministas** que puede resolver código convencional.

## 4. Límites del producto inicial

- No se promete una calidad indistinguible de un artista humano.
- No se promete un pipeline 2D/3D completamente editable entre todas las aplicaciones.
- **No** se desarrollará un editor completo, un renderizador propietario ni un motor de pinceles desde cero.
- La integración inicial prioriza resultados operativos por **intercambio de archivos**; el intercambio profundo de propiedades vendrá después.

## 5. Qué producirá FME

### Entradas
Instrucciones creativas en lenguaje natural, scripts TypeScript/JavaScript, programas o adaptadores Python/Rust, vídeo, fotos, audio, ilustraciones, SVG, dibujos raster y vectoriales, Lottie, modelos y escenas 3D, archivos de proyecto de motores especializados, máscaras, datos de tracking y metadatos.

### Salidas
Previsualizaciones, fotogramas, renders intermedios con transparencia, secuencias de imágenes, mezclas audiovisuales, archivos exportados (p. ej. MP4) y proyectos originales que se puedan reabrir. Los formatos exactos dependerán de cada backend y de su soporte **comprobado**.

### Tipos de producción

| Familia | Ejemplos | Capacidades |
|---|---|---|
| Animación 2D | Personajes, ilustración narrativa, trazo artesanal | Pinceles, poses, exposición, curvas, fondos |
| Motion graphics | Tipografía cinética, logos, formas, diagramas | Vectores, máscaras, easing, transiciones, jerarquía |
| 3D / híbridos | Escenas Blender, parallax, Grease Pencil | Cámaras, rigging, render, profundidad, composición |
| Edición audiovisual | Clips reales, fotos, voz y música | Timeline multipista, montaje, corrección, audio |
| Composición VFX | Rotoscopia, tracking, chroma, integración | Máscaras, nodos, tracking, color, canales |

### Requisitos no funcionales

| Requisito | Significado práctico |
|---|---|
| Reproducibilidad | Misma versión, semillas, assets y configuración producen resultados equivalentes (cuando la herramienta lo permita) |
| Extensibilidad | Plugins versionados; formatos y capacidades descubiertos por contrato |
| Seguridad | Permisos, aislamiento de comandos y control de escritura/ejecución |
| Recuperación | Trabajos registrables, cancelables y reintentables cuando sea seguro |
| Trazabilidad | Se guarda qué herramienta, versión y parámetros produjeron cada resultado |
| Eficiencia | Cachés, previsualizaciones reducidas y revisión selectiva de fotogramas |

## 6. Cinco técnicas de animación (sin exclusividad)

| Modo | Base y objetivo visual | Rol de la técnica secundaria |
|---|---|---|
| `2d` | Trazos, ilustración raster/vectorial, animación plana | No requiere estructura 3D |
| `3d` | Geometría, materiales, luces, cámaras 3D | No exige dibujos 2D |
| `2.5d` | Elementos planos con profundidad y parallax | Espacio/cámara 3D para sensación espacial |
| `2d-guided-by-3d` | La imagen final debe verse dibujada en 2D | El 3D guía anatomía, perspectiva, movimiento o cámara |
| `3d-with-2d` | Escena o sujetos 3D dominantes | Dibujos, líneas, expresiones y efectos 2D visibles |

Son **modos de producción**, no categorías excluyentes. FME guarda el propósito y el método usados en cada segmento.

**Granularidad de la mezcla:** proyecto, secuencia/plano, capa/objeto y tiempo (las técnicas pueden aparecer, desaparecer o transicionar).

**Transiciones entre técnicas:** no basta con interpolar un número. FME elige una operación concreta (morphing, sustitución de geometría, transformación de cámara, composición progresiva, máscaras, interpolación de propiedades, render de referencia o cambio de representación). Si no se puede garantizar continuidad, **lo informa** y propone un corte o una transición menos ambiciosa.

## 7. Espectros audiovisuales continuos

### Espectro de Expresión Audiovisual (lenguaje visual, no calidad)

| Ancla | Etiqueta | Característica |
|---|---|---|
| 0 | Grafismo esencial | Pocos elementos, formas claras, objetivos funcionales |
| 25 | Motion design | Tipografía, vectores, transiciones, ritmo |
| 50 | Animación editorial | Ilustraciones con más expresividad y personalidad |
| 75 | Animación narrativa | Actuación, continuidad, puesta en escena, personajes |
| 100 | Animación cinematográfica | Mayor complejidad escénica, actuación, cámara y composición |

### Gradiente de Fusión Audiovisual (relación entre lo real y lo animado)
Anclas: superposición → integración ligera → composición → integración espacial → integración profunda. Ejemplo: un texto sobre un vídeo puede evolucionar hasta recibir perspectiva, oclusión, iluminación y seguimiento de la escena.

### Independencia y automatización temporal
- Ambos gradientes son **independientes** entre sí.
- Cualquier gradiente debe poder variar con **fotogramas clave, curvas y easing**, al menos por escena y por capa.

```ts
// Ejemplo conceptual de curvas, no un render automático.
expression:  [{ frame: 0, value: 0.2 }, { frame: 90, value: 0.75 }],
integration: [{ frame: 0, value: 0.1 }, { frame: 90, value: 0.9 }]
```

## 8. Apariencia artesanal y dirección artística

**"Como dibujado por un humano"** significa aproximarse al lenguaje de una ilustración hecha con tableta: grosor variable, presión, curva, velocidad, textura, terminaciones, pequeñas irregularidades **consistentes**, ritmo, anticipación y decisiones artísticas comprensibles. **No** se trata de añadir ruido aleatorio, sino de modelar un estilo intencional.

| Submódulo | Información principal | Resultado deseado |
|---|---|---|
| Pinceles | Presión, velocidad, opacidad, punta, textura | Trazo expresivo y reproducible |
| Dibujo vectorial | Curvas, tangentes, capas, deformaciones | Edición de formas y movimiento |
| Dibujo raster | Pintura, texturas, borrado, fotogramas | Acabado orgánico y estilo variable |
| Animación tradicional | Poses, breakdowns, inbetweens, exposición | Actuación natural y timing |
| Animación procedural | Esqueletos, trayectorias, ciclos, física | Trabajo repetible y controlable |
| Coherencia temporal | Semillas, correlación de variación, continuidad | Evitar parpadeo y vibración no intencional |

**Reglas de dirección de animación:** squash & stretch, anticipación, staging, arcos, slow in/out, seguimiento, solapamiento, exageración, acting, movimiento secundario, jerarquía visual, ritmo, color y espacios negativos. Se eligen según la escena; **no** son efectos automáticos.

**Estilos personalizables:** tinta, boceto, caricatura, editorial, minimalismo geométrico, texturas pictóricas, etc., con pinceles y reglas editables. Un estilo no se ata a un único programa.

**Evaluación artística:** legibilidad, continuidad, intención, composición, coherencia de estilo, naturalidad, jerarquía, ritmo y adecuación narrativa. La calidad se valida con **revisión visual**, no por cumplir un porcentaje.
