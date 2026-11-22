# Prueba híbrida de 10 segundos

Primera prueba de integración (spec §20). **No es una producción realizada**: es la especificación objetivo del mediano plazo.

- **Formato:** 30 FPS → **300 fotogramas** (0–299). Resolución por definir según los recursos (propuesta: 1920×1080, con previews a 960×540).
- **Entorno de referencia:** RTX 3050 de 4 GB de VRAM, ~23 GB de RAM y Ryzen 7 4800H.

| Rango | Fotogramas | Contenido | Origen previsto |
|---|---|---|---|
| 0,0–10,0 s | 0–299 | Vídeo o imagen de fondo; audio si procede | FreeCut + biblioteca de assets |
| 1,0–8,0 s | 30–239 | Figura/personaje o gráfica 2D animada con estilo controlado | Revideo + recursos 2D |
| 3,5–8,5 s | 105–254 | Elemento/escena 3D con movimiento de cámara | Blender (adaptador Python/MCP) |
| 6,0–10,0 s | 180–299 | Tipografía cinética y composición final | Revideo + editor |
| Todo el vídeo | 0–299 | Cambios de expresión/fusión y combinación de modos | Proyecto FME, planner y adaptadores |

Solicitud de referencia (Anexo B): *"Crea un vídeo de 10 segundos: comienza con una grabación, incorpora una ilustración animada que se sienta hecha a mano, revela profundidad, agrega un objeto 3D y un título; conserva los originales."*

Criterios de aceptación: [`docs/pruebas-aceptacion.md`](../../docs/pruebas-aceptacion.md).
Cuando existan, aquí vivirán: `project.fme.json`, los scripts de cada adaptador y el informe de resultados.
