# 2026-11-23 · FDN-042c pipeline de la prueba híbrida (criterio #3)

- **Autor:** claude-code-a1 (Sonnet 5.5) · **Rama:** fdn/FDN-042c-pipeline · **Fase:** 4

## Hecho
- `packages/pipeline` (`@fme/pipeline`): `runHybrid(projectPath, outDir, options)`; `src/prores.ts` (paso propio FFmpeg → ProRes 4444 con `runIsolated` y su procedencia); README con la tabla de pasos.
- Flujo: `deserialize` v3 → registro con los tres adaptadores reales → `planWorkflow` → Revideo (título y 2D, MOV alpha) → Blender (3D, PNG RGBA) → ProRes 4444 → FreeCut `edit.compose` → `project.artifacts` + `renderArtifactId` → `project.fme.json` junto a `hybrid.mp4`.
- Proyecto de composición derivado: las capas renderizadas pasan a `drawing` (sin `text`) y con `channels = {}` (ya van horneados en el MOV; el `defaultValue` 0 de la opacidad del título lo dejaba invisible en FreeCut). El proyecto original no se modifica.
- **Bug encontrado y corregido en mi FDN-032:** las capas SVG se renderizaban VACÍAS (el nodo `SVG` de Revideo falla con «The scene is not available…»); mis tests solo comprobaban el número de fotogramas. Ahora el motor usa `<Img src="data:image/svg+xml…">` y el test de SVG exige píxeles naranjas (regresión).
- Arreglé el test e2e de FDN-033 (fallaba con schemaVersion 3: el id enlazado no estaba en `artifacts`).

## Verificado
| Comando | Resultado real |
|---|---|
| `node --test packages/pipeline/test/hybrid.integration.test.ts` (3 motores reales, 3 ejecuciones) | pass; `runHybrid` ≈ 79–92 s; test ≈ 86 s |
| MP4 final (`probe-media`) | 300 fotogramas, 30 FPS, 1280×720, con audio |
| Métrica de píxeles (firmas de color distintas del fondo) | 2D (negro): 0 en 29 → 90 138 en 30; 45 063 en 239 → 0 en 240. 3D (cobre): 15 en 104 → 34 023 en 105; 112 654 en 254 → 5 816 en 255. Título (blanco puro): 0 en 179; 14 969 en 200; 14 964 en 255; 15 192 en 299 (la opacidad 0→1 está horneada; el blanco pleno llega en 200 = 180 + 20) |
| mismas cifras | idénticas en las ejecuciones repetidas (determinista) |
| `FME_FFMPEG_PATH` inválido | 1 skip con el motivo |
| `npx tsc -p tsconfig.test.json`; `npx tsc -b` | sin errores |
| `npm test` (raíz) | 200/201 en la primera pasada; el único fallo (e2e de FDN-033, v3) ya está corregido y pasa |

## Decisiones / notas para A0
- `render-capa-3d` es la secuencia PNG de Blender (`image/png-sequence`, `framesSha256`); `render-capa-3d-prores` es el MOV derivado (`derivedFrom`); `render-final` es el MP4. Las capas enlazan al artefacto nativo del motor (PNG para 3D).
- Test a 1280×720 (resolución verificada de FreeCut) y Blender a 640×360 reescalado por el paso ProRes. El modelo `.glb` no existe: primitivo de sustitución con aviso `BLENDER_ASSET_MISSING`.
- El `dependencyHash` incluye capa, FPS, tamaño, assets y adaptador/versión del motor.
- Fondo y audio se generan con FFmpeg en el test (`testsrc2` + `sine`); el MP4 final conserva el audio.

## Pendiente
- Lockfile y `tsconfig.json` raíz (A0): añadir `packages/pipeline` y sus dependencias.
- Solo se probó 1280×720; 1920×1080 no verificado en FreeCut.
- El título solo puede verificarse con blanco pleno desde el fotograma 200 (rampa de opacidad); el inicio exacto en 180 no es medible con color.
- Para resolver `@fme/*` en el worktree uso junctions locales en `node_modules/@fme` (ignorado por git).
