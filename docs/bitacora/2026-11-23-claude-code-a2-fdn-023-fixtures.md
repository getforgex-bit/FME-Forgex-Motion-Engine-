# 2026-11-23 · claude-code-a2 · FDN-023 Fixtures y round-trip

## Hecho
- `examples/prueba-hibrida-10s/project.fme.json`: 300 fotogramas a 30 FPS; fondo (0–299), audio, 2D Revideo (30–239), 3D Blender (105–254) y título Revideo guiado por la capa 3D (180–299); `expression`/`integration` animados; `ExternalProjectRef` en las capas de Revideo y Blender.
- `packages/project/test/fixtures/minima.fme.json` y `ntsc-2997.fme.json` (30000 fotogramas a 30000/1001 = 1001 s exactos).
- `packages/project/test/fixtures.test.ts`: validan el 100 % de las fixtures, round-trip byte a byte, rangos del README y duración con `framesToSeconds`.
- Los JSON se generaron con `serialize` desde un script temporal (fuera del repo).

## Verificado
- `npm run typecheck` sin errores; `npm test`: 36 pass, 0 fail.

## Avisos
- `renderArtifactId: "render-3d"` en la capa 3D no apunta a nada: el `Project` actual no almacena `RenderArtifact`. `engineVersion: "por-validar"` es un marcador.
- Los assets (`assets/*.mp4`, etc.) no existen: son URIs de ejemplo.
