# Bitácora · FDN-074a — Audio 48 kHz y sincronía A/V en `edit.compose` (FreeCut)

- **Fecha:** 2026-11-23
- **Rama:** `fdn/FDN-074a-audio` (worktree `C:\Users\bogex\Documents\Forgex\FME-wt\antigravity`)
- **Sesiones participantes:** `antigravity-b1` (`b1-freecut`) y `antigravity-b2` (`b2-registry`)
- **Estado:** **VERIFICADO** (pendiente de revisión de A0/B0 para merge e integración en `develop`)

## 1. Hallazgos empíricos de Fase 1 (motor FreeCut `5ceeeb3`)

1. **Frecuencia de muestreo (`48000 Hz`):**
   - `renderRequestSchema.strict()` en `FME-ext/freecut/headless/lib/contract.mjs` rechaza claves extra en `prepareJob` `jobArgs`.
   - El pipeline PCM de exportación MP4 en `src/runtime/renderer/audio/pipeline.ts` (`processAudio`) y `src/runtime/renderer/canvas-render-orchestrator.ts` (`addEncodedAudioTrack`) fija `sampleRate: 48_000`, `channels: 2`, `codec: 'aac'`, `bitrate: 192_000`.
   - El adaptador (`mapping.ts` / `adapter.ts`) y `runtime/engines/freecut/cli.mjs` fijan `DEFAULT_AUDIO_SAMPLE_RATE = 48_000` por defecto y rechazan frecuencias distintas con `bad-requirements`.
2. **Colisión evitada en `track-2` al mezclar vídeo con audio + WAV externo:**
   - Al añadir un vídeo con audio mediante `addClip`, `placeVideoClip` en `src/headless/edit-ops.ts` crea automáticamente `created[0]` (`video` en `track-1`) **y** `created[1]` (`audio` vinculado en `track-2`).
   - En la sonda `short-wav-plus-bg-same-track2`, colocar un WAV externo solapado también en `track-2` silenció el pulso (`baselineRms: 0.00556`, `peakRms: 0.00738`, `audioPulseSec: null`).
   - Al detectar vídeo con `audioCodec` presente (`hasVideoWithEmbeddedAudio`) y asignar a las capas `audio` externas pistas dedicadas mediante `addTrack({ kind: 'audio' })`, FreeCut mezcla ambas fuentes sin pérdida y con desfase `0 ms`.
3. **Unidades de `volume` en dB y compañero vinculado (`created[1]`):**
   - FreeCut interpreta `item.volume` en **dB** (`dsp.ts`: `Math.pow(10, db / 20)`, default `0 dB` = ganancia lineal `1.0`). `cli.mjs` convierte la ganancia lineal FME (`>= 0`) a dB en `[-60, +12]` (`linearGainToDb`).
   - Para vídeos con audio embebido, `planning.ts` reproduce el compañero vinculado `created[1]` en lugar del nodo de vídeo `created[0]`, por lo que `cli.mjs` propaga `volume` y `sourceStart`/`sourceEnd` también a `created[1]`.

## 2. Tabla de mediciones reales de sincronía A/V (`measureAvSync`)

| Escenario | Vídeo entrada | Audio entrada | `audioCodec` / `sampleRate` | `streamStartDeltaMs` | `videoFlashFrame` (`s`) | `baselineRms` | `peakRms` | `audioPulseSec` | `avOffsetMs` |
|---|---|---|---|---|---|---|---|---|---|
| Sonda `short-wav-plus-bg-same-track2` (control colisión `track-2`) | 1280×720 30 fps 90f, flash `30..32`, 220 Hz `-24 dB` | WAV 48 kHz stereo `0.1s` en `track-2` (colisión) | `aac` / `48000` Hz (2 ch) | `0` | `30` (`1.000`) | `0.00556` | `0.00738` | `null` | `null` |
| Sonda `short-wav-plus-bg-dedicated-track` | Igual + `addTrack` | WAV 48 kHz stereo `0.1s` en `startFrame: 30` (`A2`) | `aac` / `48000` Hz (2 ch) | `0` | `30` (`1.000`) | `0.00556` | `0.06506` | `1.000` | `0` |
| Sonda `full-wav-plus-bg` | Igual + `addTrack` | WAV 48 kHz stereo `3.0s` pulso en `1.0..1.1s` (`A2`) | `aac` / `48000` Hz (2 ch) | `0` | `30` (`1.000`) | `0.00556` | `0.50347` | `1.000` | `0` |
| Sonda `wav-22k-silent-bg` | 1280×720 30 fps 90f mudo, flash `30..32` | WAV `22050 Hz` mono `0.1s` en `startFrame: 30` | `aac` / `48000` Hz (2 ch) | `0` | `30` (`1.000`) | `0` | `0.08928` | `1.000` | `0` |
| Sonda `volume-db-check` | Fondo con `-20 dB` en `created[1]` | WAV 48 kHz `0.1s` a `0 dB` en `A2` | `aac` / `48000` Hz (2 ch) | `0` | `30` (`1.000`) | `0.00054` | `0.06307` | `1.000` | `0` |
| E2E Test 1 (`audio-sync.integration.test.ts`) | 1280×720 30 fps 90f, flash `30..32`, 220 Hz `-24 dB` | `audio/wav` 48 kHz stereo `1000 Hz` vía `inputs[]` (`startFrame: 30`, `volume: 1`) | `aac` / `48000` Hz (2 ch) | `0` | `30` (`1.000`) | `0.005514` | `0.503468` | `1.000` | `0` |
| E2E Test 2 (`audio-sync.integration.test.ts`) | 1280×720 30 fps 90f mudo, flash `30..32` | `audio/x-wav` `22050 Hz` mono `1000 Hz` vía `inputs[]` (`startFrame: 30`, `volume: 0.5`) | `aac` / `48000` Hz (2 ch) | `0` | `30` (`1.000`) | `0` | `0.352796` | `1.000` | `0` |

## 3. Archivos modificados y creados

- **B2 (`packages/adapters/freecut/src/**` y unit tests):**
  - `packages/adapters/freecut/src/audio-sync.ts` (`DEFAULT_AUDIO_SAMPLE_RATE = 48_000`, `measureAvSync`)
  - `packages/adapters/freecut/src/mapping.ts` (`resolveAudioSampleRate`, `audioSampleRate`, `volume` lineal en `FreeCutMediaLayer`, soporte `audio/wav` y `audio/x-wav`)
  - `packages/adapters/freecut/src/adapter.ts` (lectura/validación de `requirements.audioSampleRate` y `provenance[0].params.audioSampleRate`)
  - `packages/adapters/freecut/src/cards.ts` y `src/index.ts`
  - `packages/adapters/freecut/test/audio-sync.test.ts`
- **B1 (`runtime/engines/freecut/**`, E2E y bitácora):**
  - `runtime/engines/freecut/cli.mjs` (`linearGainToDb`, validación `audioSampleRate=48000`, aislamiento de pista `addTrack` cuando existe vídeo con audio embebido, propagación de `volume` y `sourceStart`/`sourceEnd` a `created[1]`)
  - `runtime/engines/freecut/README.md`
  - `packages/adapters/freecut/test/audio-sync.integration.test.ts`
  - `docs/bitacora/2026-11-23-antigravity-fdn-074a-audio.md`

## 4. Verificación ejecutada

- `npx.cmd tsc -b packages/adapters/freecut` → exit `0`
- `npm.cmd run typecheck` (`tsc -b && tsc -p tsconfig.test.json`) → exit `0`
- `node --test packages/adapters/freecut/test/*.test.ts` → exit `0` (`tests 20`, `pass 20`, `fail 0`, `skipped 0`, `18884.5207ms`)
- `npm.cmd test` → exit `0` (`tests 206`, `suites 5`, `pass 198`, `fail 0`, `skipped 8` por motor Revideo no instalado en este worktree, `39887.7795ms`)
- **CodeGraph:**
  - B2: `1 sync` (`17` arch, `361` nodos) + `2` consultas (`context "buildFreeCutComposeJob FreeCutAdapter audio"` y `impact buildFreeCutComposeJob`).
  - B1: `codegraph.cmd sync` (`8 changed files`, `Added: 3, Modified: 5 - 266 nodes in 1.9s`) + `codegraph.cmd affected` (`Affected test files (18)`).
- **Graphify:** `graphify update .` → `Rebuilt: 2132 nodes, 3944 edges, 169 communities`.
