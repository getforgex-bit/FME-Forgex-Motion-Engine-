# 2026-11-25 · FDN-063c `3d-with-2d` integrada en `runHybrid`

- **Autor:** claude-code-a1 (Sonnet 5.5) · **Rama:** fdn/FDN-063c-3d-con-2d · **Fase:** 6/4

## Hecho
- `packages/pipeline/src/guide.ts`: `pngAlphaCentroid` (decodifica PNG RGBA8 en TS), `guideFromBlenderFrames` (guía JSON v1 desde la silueta alfa; **provisional** hasta el `camera.json` nativo de FDN-063b) y `overlayZIndexes` (una capa 2D guiada por una capa 3D que declara `3d-with-2d` queda por encima de ella; solo sube).
- `runHybrid`: Blender se renderiza **antes** que Revideo; la guía se guarda junto a los PNG en la caché (`guide.json`; si un manifiesto antiguo no la trae se calcula de los PNG). Las capas `2d-guided-by-3d` reciben `requirements.guide` (en su `workDir`), así el título sigue al cubo. La composición fuerza el orden de los overlays. La clave de caché de las capas guiadas añade `guide: 'alpha-silhouette-v1'` (no se reutilizan renders sin guía).
- Test `packages/pipeline/test/overlay-order.integration.test.ts`.

## Verificado (3 motores reales)
| Comando | Resultado real |
|---|---|
| `node --test packages/pipeline/test/overlay-order.integration.test.ts` | 2 pass, ~175 s |
| Métrica de orden en el MP4 final (fotogramas 200, 220, 240, 254; píxeles donde el título es opaco y el cubo es opaco: 5 957–6 731 px) | fracción con el color del título: 0,995 / 0,997 / 0,985 / 0,987 (umbral ≥ 0,9) |
| Mismo test con el título POR DEBAJO del 3D en el proyecto (`zIndex` 2 < 3) | idénticas cifras: el pipeline lo sube. No demostré el fallo al desactivar la regla (no revertí el código para comprobarlo) |
| Seguimiento del título al cubo (centroide de alfa del título vs. del cubo, a 1280×720) | 5,7 / 2,5 / 7,8 / 9,4 px (umbral < 15 px; el centroide del texto no es el centro exacto del objeto) |
| `node scripts/prueba-hibrida.mjs` (con `FME_REVIDEO_ENGINE_DIR` apuntando al motor de este worktree) | #1, #2, #3 (incluye la exportación por CLI: 300 fotogramas, 30 FPS, 1280×720, audio), #4, #6, #7, #8 superados; **#5 «Fallbacks reales» FALLA en este entorno** → 7/8 aquí (ver abajo) |
| `npx tsc -b`, `npx tsc -p tsconfig.test.json` | sin errores |
| `npm test` (raíz) | 250/254: fallan el baseline de regresión SVG (FDN-073c), la concurrencia de `DiskCache` (FDN-070c), los fallbacks reales de FDN-052 y los gradientes de Blender (99 s con la máquina cargada; pasan solos en 18 s) |

## Sobre el 7/8 en este worktree
- Sin `FME_REVIDEO_ENGINE_DIR`, la exportación por CLI resolvía el motor de Revideo en el checkout principal (que no tiene `node_modules` en `runtime/engines/revideo`) y quedaba «no ejecutado».
- `packages/recovery/test/real-fallbacks.integration.test.ts` («fallback REAL con FreeCut», `escalated !== ok`) falla en este worktree incluso antes de mis cambios (ya fallaba en FDN-063). Hipótesis NO verificada: rutas demasiado largas en Windows dentro de `.claude/worktrees/…` para el motor de FreeCut. A0 lo reproduce 8/8 en su checkout.

## Pendiente
- Sustituir la guía por el `camera.json` nativo cuando llegue FDN-063b.
- En `packages/art-direction/src/backends/techniques.ts` (no es de esta tarea) `3d-with-2d` de Revideo puede pasar de `partial` a `yes` con esta evidencia; lo propongo a A0.
