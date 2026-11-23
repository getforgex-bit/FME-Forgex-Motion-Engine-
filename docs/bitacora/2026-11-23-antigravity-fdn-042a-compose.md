# 2026-11-23 · FDN-042a FreeCut compone pistas y overlays (`edit.compose`)

- **Autores:** `antigravity-b1` (sonda empírica de alpha, `runtime/engines/freecut/**`, `compose.integration.test.ts`, bitácora) y `antigravity-b2` (`packages/adapters/freecut/src/**`, `compose.test.ts`), coordinados por `antigravity-b0`
- **Worktree / Rama:** `C:\Users\bogex\Documents\Forgex\FME-wt\antigravity` · `fdn/FDN-042a-compose`
- **Fase:** 4

## Objetivo
Añadir la operación `edit.compose` en `@fme/adapter-freecut` y `runtime/engines/freecut/cli.mjs` para componer escenas multipista ordenadas por `zIndex`, `startFrame` y duración sobre artefactos heterogéneos (`inputs[]`), verificando empíricamente el soporte real de canal alpha en FreeCut y rechazando honestamente (`unsupported-alpha`, sin simular) formatos no soportados.

## Sonda empírica real de alpha en FreeCut (`5ceeeb3` + Edge `msedge`)
Fondo azul `#0000ff` (1280×720, 30 FPS, 60 frames) + overlay rojo/verde/amarillo opaco en mitad izquierda `(320,360)` y transparente `alpha=0` en mitad derecha `(960,360)`, rango `15..45`:

| Formato de entrada | ¿Aceptado por FreeCut? | Alpha real preservado | Evidencia RGB (`frame5` / `frame30` / `frame50`) y hallazgo |
|---|---|---|---|
| `image/png` (PNG RGBA, `opacity: 1`) | Sí | **No** (aplana a negro) | `frame30`: izq `[232,0,1]`, der `[0,0,0]`. Causa en `frame-occlusion.ts:44-57`: solo desactiva oclusión en `video`, saltando pistas inferiores |
| `image/png` (PNG RGBA, `opacity: 0.999`) | Sí | **Sí** | `frame5`: `[3,0,244]`/`[3,0,244]`; `frame30`: izq `[232,0,1]`, der `[3,0,244]`; `frame50`: `[3,0,244]`/`[3,0,244]` |
| `video/webm` (`vp9`, `yuva420p`) | Sí | **Sí** (nativo `opacity: 1`) | `probeMedia` `videoCodecSupported: true`; `frame30`: izq `[15,252,6]`, der `[3,0,244]` |
| `video/quicktime` (ProRes 4444 `yuva444p10le` y `yuva444p12le` de Revideo) | Sí | **Sí** (nativo `@mediabunny/prores`, `opacity: 1`) | Aunque `probeMedia` marca `videoCodecSupported: false`, el render decodifica ProRes 4444 10/12-bit con transparencia: `frame30` izq `[250,255,11]`, der `[3,0,244]` |
| `image/png-sequence` (secuencia PNG RGBA, p. ej. Blender) | **No** | **No** | `stageLocalMedia` exige archivo regular (`INVALID_MEDIA_SOURCE` en dir, `ENOENT` en patrón); sin soporte nativo de secuencias |

## Hecho
- `packages/adapters/freecut/src/cards.ts`: añadido `'edit.compose'` en `simple.capabilities`; `advanced.technical` alineado con la sonda (`alpha: 'no'`, `alphaInputWebm: 'yes'`, `alphaInputProRes4444: 'yes'`, `alphaInputPng: 'yes'`, `pngSequenceInput: 'no'`, `multiTrackCompose: 'yes'`).
- `packages/adapters/freecut/src/mapping.ts`: añadido `buildFreeCutComposeJob` (resolución determinista de `inputs[]` + `layerInputs` / `input.<layerId>`, contención estricta de rutas, ordenación por `zIndex`, `opacity: 0.999` + `preserveAlpha: true` en overlays PNG RGBA, rechazo `unsupported-alpha` en secuencias PNG) manteniendo `buildFreeCutJob` retrocompatible.
- `packages/adapters/freecut/src/adapter.ts` y `src/index.ts`: soporte dual `edit.export` y `edit.compose`, inspección previa de streams con `ffprobe` (`inspectMediaStream` / `isSupportedAlphaStream`), rechazo `unsupported-alpha` con alternativa concreta sin simular, y paso seguro de `mediaPaths` a `allowedPaths` de `runIsolated`.
- `runtime/engines/freecut/cli.mjs` y `README.md`: pistas de vídeo y audio por `zIndex`, `updateItem` para `transform` (`opacity`, `width`, `height`), `blendMode` y `sourceInFrame`.
- `packages/adapters/freecut/test/compose.test.ts` (unitarios) y `packages/adapters/freecut/test/compose.integration.test.ts` (composición real PNG RGBA + MOV ProRes 4444 `yuva444p12le` con verificación RGB en frames `5`/`30`/`50`, `contentSha256`, limpieza de `os.tmpdir()` y rechazo `unsupported-alpha` sobre secuencia PNG real).

## Verificado
| Comando | Resultado real observado |
|---|---|
| `npx.cmd tsc -b packages/adapters/freecut` | Exit `0` |
| `npm.cmd run typecheck` (`tsc -b && tsc -p tsconfig.test.json`) | Exit `0` |
| `node --test packages/adapters/freecut/test/*.test.ts` | Exit `0` (`14/14` pass, `0` skipped, `29954.77ms`); PNG `f5=[3,0,244]/[3,0,244]`, `f30=[232,0,1]/[3,0,244]`, `f50=[3,0,244]/[3,0,244]`; ProRes 4444 `f30=[231,0,0]/[3,0,244]`; `contentSha256_png=c604d6aa...`, `contentSha256_mov=00c9bed5...` |
| `npm.cmd test` | Exit `0` (`tests 193`, `suites 5`, `pass 185`, `fail 0`, `skipped 8` [integración Revideo sin motor instalado], `58245.19ms`) |
| `codegraph.cmd sync` + `context` + `impact` + `affected` | B2: `1 sync` (`42` arch, `787` nodos) + `context` + `impact`; B1: `1 sync` (`7` arch, `216` nodos, `64` refs) + `1 affected` (`15` archivos de test) |
| `graphify update .` | Reconstruido: `2039` nodos, `3718` aristas, `159` comunidades |

## Pendiente
- Revisión por B0 y envío del evento `REVIEW` de `FDN-042a` a `claude-code-a0`.
