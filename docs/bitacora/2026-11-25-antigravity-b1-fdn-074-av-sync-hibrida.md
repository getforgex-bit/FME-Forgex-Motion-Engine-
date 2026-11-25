# Bitácora · FDN-074 — Exportación híbrida con audio y sincronía A/V medida (criterio #7)

- **Fecha:** 2026-11-25
- **Sesión:** `antigravity-b1` (`b1-freecut`)
- **Worktree / Rama:** `C:\Users\bogex\Documents\Forgex\FME-wt\antigravity` · `fdn/FDN-074-av-sync-hibrida` (desde `develop` `dccf7cf`)
- **Estado:** **VERIFICADO** (listo para revisión de B0; sin evento `REVIEW` ni liberación todavía)

## 1. Implementación

- **`packages/pipeline/test/av-sync.integration.test.ts`:**
  - Parte de la fixture `examples/prueba-hibrida-10s/project.fme.json` (`deserialize` v3, `1280×720`, `300` fotogramas a `30` FPS).
  - Genera con `ffmpeg` (`execFile`, `shell: false`):
    - `assets/fondo.mp4`: `1280×720`, 30 FPS, 10 s (`300` fotogramas, H.264 `yuv420p`, `-g 30`), fondo negro `#000000` con 3 destellos blancos `#ffffff` a pantalla completa en `between(n,30,32)`, `between(n,150,152)` y `between(n,270,272)`, más audio AAC estéreo 48 kHz (`192k`) con base `0.02*sin(2*PI*220*t)` y 3 pulsos sincronizados de `1000 Hz` (`0.7` amplitud, `0.1 s`) en `[1.0, 1.1]`, `[5.0, 5.1]` y `[9.0, 9.1]`.
    - `assets/base.wav`: 48 kHz estéreo `pcm_s16le` (`10 s`, base `0.01*sin(2*PI*110*t)`) para `capa-audio`.
    - `assets/ilustracion.svg`: círculo negro `360×360`.
  - Inyecta `RevideoAdapter` con `FME_REVIDEO_ENGINE_DIR` y `FME_PUPPETEER_CACHE_DIR` (fallback `examples/fase1/revideo/out/.puppeteer`); hace `skip` con motivo explícito cuando falta algún motor en `probe()`.
  - Ejecuta `runHybrid` y mide el MP4 final con `measureAvSync` (`@fme/adapter-freecut`) más decodificación directa de los 3 pulsos (`scale=64:36 gray` + `f32le 48000 Hz mono`).
  - Verifica conformidad `checkAdapterResult`, `parseProject`, `adaptersInProvenance` (`revideo`, `adapter.blender`, `fme.pipeline.prores`, `adapter.freecut`), stream delta `<= 33.34 ms`, desfase A/V `<= 33.34 ms` en los 3 pulsos y deriva/rango `< 33.34 ms`.

## 2. Mediciones reales de la exportación híbrida de 10 s (`runHybrid`, `93.71 s`)

### Streams del MP4 final (`measureAvSync`)

| Parámetro | Valor medido |
|---|---|
| `videoCodec` / `audioCodec` | `h264` / `aac` |
| `fps` / `frames` | `30` / `300` |
| `audioSampleRate` / `audioChannels` | `48000` Hz / `2` |
| `videoStartSec` / `audioStartSec` | `0` s / `0` s |
| `streamStartDeltaMs` | **`0` ms** (`<= 33.34 ms`) |
| `videoDurationSec` / `audioDurationSec` | `10` s / `10.005333` s |
| `adaptersInProvenance` | `["revideo", "adapter.blender", "fme.pipeline.prores", "adapter.freecut"]` |

### Los 3 pulsos sincronizados y deriva a lo largo de 10 s

| Medición | Frame esperado (`t`) | `flashFrame` (`flashSec`) | `baselineRms` | `peakRms` | `audioPulseSec` | `avOffsetMs` |
|---|---|---|---|---|---|---|
| `measureAvSync` (pulso 1) | `30` (`1.0 s`) | `30` (`1` s) | `0.02213` | `0.7101` | `1` s | **`0` ms** |
| Decodificación directa pulso 1 | `30` (`1.0 s`) | `30` (`1` s) | `0.02231` | `0.7101` | `1` s | **`0` ms** |
| Decodificación directa pulso 2 | `150` (`5.0 s`) | `150` (`5` s) | `0.02232` | `0.70948` | `5` s | **`0` ms** |
| Decodificación directa pulso 3 | `270` (`9.0 s`) | `270` (`9` s) | `0.02231` | `0.7098` | `9` s | **`0` ms** |

- **Deriva extremo a extremo (`|pulso3 - pulso1|`):** **`0` ms** (`< 33.34 ms`)
- **Rango total (`maxOffset - minOffset`):** **`0` ms** (`< 33.34 ms`)

## 3. Verificación ejecutada

- `npm.cmd ci --offline` → exit `0` (enlace de workspace `@fme/pipeline` restaurado offline; `added 112 packages, 7s`)
- `npx.cmd tsc -b packages/pipeline` & `npm.cmd run typecheck` → exit `0`
- `node --test packages/pipeline/test/av-sync.integration.test.ts` (sin `FME_REVIDEO_ENGINE_DIR`) → exit `0` (`tests 1`, `pass 0`, `fail 0`, `skipped 1`, `duration_ms 1117.5329`; motivo: `revideo: El motor no está instalado...`)
- `node --test packages/pipeline/test/av-sync.integration.test.ts` (con `FME_REVIDEO_ENGINE_DIR` y `FME_PUPPETEER_CACHE_DIR`) → exit `0` (`tests 1`, `pass 1`, `fail 0`, `skipped 0`, `duration_ms 96549.0799`)
- `npm.cmd test` → exit `0` (`tests 246`, `suites 7`, `pass 227`, `fail 0`, `cancelled 0`, `skipped 16` de Revideo sin motor instalado en este worktree, `todo 3`, `duration_ms 59328.6557`)
- **CodeGraph:**
  - Pre-edición: `codegraph.cmd sync` (`17 changed files`, `Added: 6, Modified: 11 - 532 nodes in 6.9s`) + `codegraph.cmd context "runHybrid createHybridAdapters"`
  - Post-edición: `codegraph.cmd sync` (`1 changed files`, `Added: 1 - 49 nodes in 5.3s`, `Resolved 29 pending references (27 unresolved)`) + `codegraph.cmd affected packages/pipeline/test/av-sync.integration.test.ts` (`Affected test files (1): packages/pipeline/test/av-sync.integration.test.ts`)
- **Graphify:** `graphify update .` bloqueado en este entorno por directiva de Control de aplicaciones sobre `C:\Users\bogex\.local\bin\graphify.exe` (`ApplicationFailedException`).
