# @fme/pipeline: pipeline de la prueba híbrida (FDN-042c, criterio #3)

`runHybrid(projectPath, outDir, options?)` abre un proyecto FME (`deserialize`, v3), lo enruta con `planWorkflow` sobre un registro con los **tres adaptadores reales** y produce un MP4 con todas las capas.

| Paso | Capa | Adaptador | Salida |
|---|---|---|---|
| `render.video` (alpha) | título (`text`) y 2D (`drawing`) | `revideo` | MOV ProRes 4444 con alpha |
| `render.image-sequence` | 3D (`model3d`) | `adapter.blender` | PNG RGBA por fotograma |
| `encode.prores4444` | 3D | **paso propio** `fme.pipeline.prores` (FFmpeg con `runIsolated`) | MOV ProRes 4444 (FreeCut no acepta `image/png-sequence`, hallazgo de FDN-042a) |
| `edit.compose` | fondo, audio y todo lo anterior | `adapter.freecut` | MP4 H.264 |

Cada paso deja su procedencia. El resultado es `outDir/hybrid.mp4` y `outDir/project.fme.json`, con `project.artifacts` (ADR-0015) y `renderArtifactId` enlazado en cada capa renderizada:

- `render-capa-titulo`, `render-capa-2d`: el MOV de Revideo;
- `render-capa-3d`: la secuencia PNG de Blender (`image/png-sequence`; `framesSha256` en `config`); `render-capa-3d-prores`: el MOV derivado (`derivedFrom`);
- `render-final`: el MP4 (no enlazado desde una capa).

El `dependencyHash` sale de `@fme/cache` (proyecto, capa, FPS, tamaño, assets y adaptador con la versión del motor).

## Decisiones de implementación
- **Proyecto de composición derivado:** FreeCut compone `text` de forma nativa y no admite recibir un overlay en una capa `text`. Para componer el título renderizado por Revideo se escribe `outDir/jobs/NN-compose/project/project.compose.fme.json`, donde las capas renderizadas pasan a `drawing` (sin `text`) y reciben su MOV por `requirements['input.<capa>']`. El proyecto del usuario no se modifica.
- **Assets nativos** (fondo, audio): se copian al proyecto de composición (FreeCut solo acepta rutas relativas contenidas).
- **Blender a menor resolución** (`blenderResolution`, por defecto `960x540`; el test usa `640x360`): el paso ProRes lo reescala al tamaño del proyecto.
- El modelo `.glb` de la fixture no existe: Blender usa su primitivo de sustitución y el aviso `BLENDER_ASSET_MISSING` queda en los diagnósticos del paso.
- El test usa 1280×720 (resolución verificada de FreeCut) y skip con motivo si falta algún motor.
