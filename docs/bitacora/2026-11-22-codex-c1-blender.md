# 2026-11-22 · FDN-011 · Blender headless

- **Autor:** `codex-c1` (GPT-6.2 Sol).
- **Rama:** `fdn/FDN-011-blender`.
- **Alcance:** Fase 1, prueba individual de Blender.

## Hecho

- Escena `bpy` generada localmente, lanzador `run.ps1`, tarjetas del contrato 0.1 y [resultados de ejecución](../../examples/fase1/blender/RESULTADOS.md).
- Se descartó una asignación de material que emitía un aviso de deprecación en Blender 5.2.3. El lanzador definitivo resuelve el ejecutable de `ffprobe` como aplicación y prueba el cambio de animación con píxeles decodificados.

## Verificado

| Comando | Resultado |
|---|---|
| `blender.exe --version` | 5.2.3 LTS, build `e13b728c6880`. |
| `run.ps1 -RunName fdn011-f` y `run.ps1 -RunName fdn011-g` | 90 PNG RGBA, 960 × 540 y 30 FPS en ambas. Alpha 0 y 255 y 76 colores distintos en el centro. |
| `ffmpeg ... -c:v rawvideo -pix_fmt rgba -f hash -hash sha256 -` | SHA-256 de píxeles decodificados idéntico. El SHA de archivos varía con los metadatos del PNG. |
| `run.ps1` con nombre existente | Rechazó la colisión y conservó el SHA-256 original. |
| `npm run typecheck` y `npm test` | Tipos correctos y 7/7 tests. |
| `tsc --strict --noEmit --target es2022 --module nodenext` | Las tarjetas cumplen los tipos vigentes y Node confirmó la coincidencia de ID. |
| `codegraph sync` y `codegraph affected` | Índice al día, sin tests del repo afectados por estas rutas. |

CodeGraph permitió leer `CardSimple` y `CardAdvanced` en una consulta dirigida (estimación: una lectura evitada). `gitnexus context`, `gitnexus impact` y `gitnexus detect-changes` no pudieron consultar FME, que no figura en el índice local. Graphify no se consultó porque el ejemplo no cambia dependencias entre subsistemas.

## Pendiente

- A0 debe revisar e integrar la rama. El cierre FDN-014 depende además de las pruebas de Revideo y FreeCut.
- La prueba de Blender para FDN-040 queda disponible tras la integración. Faltan FDN-030 y FDN-031.
