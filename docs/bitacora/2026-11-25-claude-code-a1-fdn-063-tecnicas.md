# 2026-11-25 · FDN-063 técnicas compuestas (cierre de la Fase 6)

- **Autor:** claude-code-a1 (Sonnet 5.5) · **Rama:** fdn/FDN-063-tecnicas · **Fase:** 6

## Hecho
- `2.5d`: `parallaxFactor(depth)=1/(1+d)` y `depthScale(depth)=1/(1+0,25·d)` en `@fme/art-direction` (`src/backends/parallax.ts`). El adaptador Revideo acepta `requirements.depth` (≥ 0), exige que la capa declare `2.5d` y atenúa x/y y escala.
- `2d-guided-by-3d` + `guide3DLayerId`: «guía JSON v1» (`{version:1, frames:[{x,y,scale?}]}`, fracciones 0–1 desde arriba-izquierda; `packages/adapters/revideo/src/guide.ts`). `requirements.guide` (ruta; solo se lee dentro de la carpeta del proyecto o del `workDir`, ≤ 5 MB). Se alinea en tiempo de escena (`startFrame2D + f − startFrame3D`, extremos fijos) y se suma al movimiento propio.
- `3d-with-2d`: el overlay 2D se renderiza con alpha y puede seguir al objeto 3D; verificada la composición encima del render 3D con FFmpeg `overlay`. **No integrada en el pipeline** (queda `partial` en la tabla).
- `techniqueSupport('revideo', …)`: `2.5d` yes, `2d-guided-by-3d` yes, `3d-with-2d` partial.
- **Solicitud a A0** (Blender, código de Codex): exportar la posición en pantalla del centro del modelo por fotograma (`world_to_camera_view`) como `camera.json`. Mientras, la guía la produce la silueta alfa de los PNG reales de Blender (productor provisional, marcado `source` en el JSON del test).

## Verificado (motores reales)
| Comando | Resultado real |
|---|---|
| `node --test packages/adapters/revideo/test/techniques.integration.test.ts` (Revideo + Blender + FFmpeg) | 2 pass, ~63 s |
| 2.5d (centroide alfa, fotogramas 0 y 59, recorrido nominal 600 px) | depth 0: 600 px; depth 1: 300 px (razón 0,50); depth 3: 150 px (razón 0,25); área √: 0,80 y 0,57 |
| guía (Blender 320×180, cámara con `x` de −1,5 a 1,5; el objeto recorre > 150 px) | error de seguimiento 2D vs 3D en los fotogramas de escena 105, 140, 180, 210, 239: 0,73 / 0,73 / 0,69 / 0,73 / 0,70 px (umbral < 6 px) |
| 3d-with-2d (composición con `overlay`) | en 5 fotogramas, el píxel de la posición guiada es el color del 2D (RGB ≈ 0,255,128); con el orden invertido lo tapa el 3D; > 20 000 px de cobre alrededor |
| con `FME_FFMPEG_PATH` inválido | 2 skips con el motivo |
| `node --test packages/adapters/revideo/test/mapping.test.ts` | 15 pass (6 nuevos: parallax, guía, alineación, errores) |
| `node --test packages/art-direction/test/backends.test.ts` | 6 pass |
| `npx tsc -b`, `npx tsc -p tsconfig.test.json` | sin errores |
| `npm test` (raíz) | 245/251; fallos ajenos abajo |

## Fallos ajenos en `npm test`
1. `tests/regresion/render.test.ts` · Revideo SVG: baseline anterior al arreglo del SVG (FDN-073c pendiente).
2. `packages/recovery/test/real-fallbacks.integration.test.ts` · «fallback REAL con FreeCut»: `escalated !== ok`; falla también aislado (1,4 s). No toqué FreeCut ni `recovery`; es de FDN-052.

## Pendiente
- Blender nativo: `camera.json` (solicitud enviada).
- `3d-with-2d` en el pipeline (hoy solo verificada con FFmpeg `overlay`).
- 2.5d con varios planos en una sola composición (cada plano es un job).
