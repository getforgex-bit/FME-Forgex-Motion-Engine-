# Informe de la prueba híbrida final (FDN-075)

> Generado por `node scripts/prueba-hibrida.mjs`. **No editar a mano.** Un criterio solo es «superado» si todas sus pruebas se ejecutaron y pasaron; una prueba omitida (falta un motor) lo deja «no ejecutado», nunca «superado».

**Resultado:** 8/8 superados · 0 fallidos · 0 no ejecutados · 0 pendientes.

## Entorno

| | |
|---|---|
| Fecha | 2026-11-25T08:51:18.208Z |
| Commit | `9a4959f` en `develop` |
| Sistema | Windows_NT 10.0.26200 (x64) |
| Node | v24.21.0 |
| CPU | AMD Ryzen 7 4800H with Radeon Graphics ×16 |
| RAM | 23.4 GiB |
| GPU | NVIDIA GeForce RTX 3050 Laptop GPU, 4096 MiB, 595.97 |

## Motores

| Motor | Disponible | Versión / diagnóstico |
|---|---|---|
| Revideo | sí | 0.11.0 (adaptador revideo 0.0.0) |
| Blender | sí | 5.2.3 (adaptador adapter.blender 0.0.0) |
| FreeCut | sí | 0.0.0+5ceeeb38 (adaptador adapter.freecut 0.0.0) |
| FFmpeg | sí | ffmpeg version 9.0.2-full_build-www.gyan.dev Copyright (c) 2000-2026 the FFmpeg developers |

## Resumen

| # | Criterio | Estado | Tiempo |
|---|---|---|---|
| 1 | FreeCut, Revideo y Blender ejecutan cada uno una operación de muestra de forma independiente | ✅ superado | 72.9 s |
| 2 | Un proyecto FME puede guardar, validar, recuperar y versionar su timeline | ✅ superado | 0.7 s |
| 3 | Los tres adaptadores ejecutan trabajos reales, no simulados | ✅ superado | 261.0 s |
| 4 | El router selecciona una ruta compatible consultando primero la tarjeta simple | ✅ superado | 1.6 s |
| 5 | Solo consulta el detalle avanzado cuando una restricción crítica lo requiere | ✅ superado | 26.2 s |
| 6 | Los gradientes cambian una propiedad visual comprobable a lo largo del tiempo | ✅ superado | 48.9 s |
| 7 | Se exporta correctamente un vídeo híbrido de 10 s con audio y sincronía adecuados | ✅ superado | 135.2 s |
| 8 | Se pueden reabrir las fuentes externas y cambiar una parte sin rehacer todos los activos | ✅ superado | 121.4 s |

## Detalle por criterio

### Criterio 1: ✅ superado

_FreeCut, Revideo y Blender ejecutan cada uno una operación de muestra de forma independiente_

#### Revideo (render real de una capa): ✅ superado

- **Comando:** `node --test --test-reporter=tap packages/adapters/revideo/test/adapter.integration.test.ts`
- **Resultado:** 6 pasan, 0 fallan, 0 omitidas (de 6); salida 0
- **Tiempo:** 28.3 s
- **packages/adapters/revideo/test/adapter.integration.test.ts (SHA-256):** `d455ff5636ac1ab7ddb7286dfc276bbf374087f76ec18f383bad3d909316159d`

#### Blender (render real de PNG RGBA): ✅ superado

- **Comando:** `node --test --test-reporter=tap packages/adapters/blender/test/adapter.test.ts`
- **Resultado:** 6 pasan, 0 fallan, 0 omitidas (de 6); salida 0
- **Tiempo:** 29.5 s
- **packages/adapters/blender/test/adapter.test.ts (SHA-256):** `74cd6edc4a6676d88804c95f823c929d6c4a607de5e5c0c792e0b1d03c20928d`

#### FreeCut (composición real a MP4): ✅ superado

- **Comando:** `node --test --test-reporter=tap packages/adapters/freecut/test/adapter.integration.test.ts`
- **Resultado:** 2 pasan, 0 fallan, 0 omitidas (de 2); salida 0
- **Tiempo:** 15.1 s
- **packages/adapters/freecut/test/adapter.integration.test.ts (SHA-256):** `eda552de96fc254866f2c1c6543ea3e5bbae71473429b6fa69fd688e8524bb89`

### Criterio 2: ✅ superado

_Un proyecto FME puede guardar, validar, recuperar y versionar su timeline_

#### Esquema, serialización, migraciones y fixtures (round-trip byte a byte): ✅ superado

- **Comando:** `node --test --test-reporter=tap packages/project/test/schema.test.ts packages/project/test/serialize.test.ts packages/project/test/migrate.test.ts packages/project/test/fixtures.test.ts`
- **Resultado:** 38 pasan, 0 fallan, 0 omitidas (de 38); salida 0
- **Tiempo:** 0.7 s
- **packages/project/test/schema.test.ts (SHA-256):** `ff48026debf018dcb3984aa5e34892e3659d2c7e881e3e5c0f2287728d619a99`
- **packages/project/test/serialize.test.ts (SHA-256):** `4c7329b5735e595b514f94d44897acad141fc69b9846dd35f771cf7a3a3726dd`
- **packages/project/test/migrate.test.ts (SHA-256):** `10c729e78fcf4105f28f6f5a833783fa845b89458601c5bbfa7dfb82b850afa0`
- **packages/project/test/fixtures.test.ts (SHA-256):** `05189c82c23f0b322034ad1359f8ae0f9593644b77f2ab4c10a01d33a1359b52`

### Criterio 3: ✅ superado

_Los tres adaptadores ejecutan trabajos reales, no simulados_

#### Pipeline híbrido con Revideo, Blender y FreeCut: ✅ superado

- **Comando:** `node --test --test-reporter=tap packages/pipeline/test/hybrid.integration.test.ts`
- **Resultado:** 1 pasan, 0 fallan, 0 omitidas (de 1); salida 0
- **Tiempo:** 134.7 s
- **packages/pipeline/test/hybrid.integration.test.ts (SHA-256):** `cbea71a678e6ba2d7a53b6dd55be965eebc3ebcf46b668d47dd14988a5dc2b9b`

#### Exportación con la CLI (`fme project export`) y hash del MP4 final: ✅ superado

- **Comando:** `node apps/cli/src/main.ts project export <entradas> --out <salida> --blender-resolution 640x360 --json`
- **Resultado:** 300 fotogramas, 30 FPS, 1280×720, audio: true; 5 pasos (todos ok); adaptadores en la procedencia: adapter.blender, fme.pipeline.prores, revideo, adapter.freecut
- **Tiempo:** 126.3 s
  - 20261125085449-01-capa-3d (adapter.blender) ok 11605.4 s
  - 20261125085449-02-capa-3d-prores (fme.pipeline.prores) ok 4.0 s
  - 20261125085449-03-capa-2d (revideo) ok 12.7 s
  - 20261125085449-04-capa-titulo (revideo) ok 7.6 s
  - 20261125085449-05-compose (adapter.freecut) ok 18.4 s
- **hybrid.mp4 (SHA-256):** `cd77b0514966d53daaec96b04d5bb8b13968ed219651483917ac93edc6b60014`
- **project.fme.json enlazado (SHA-256):** `32a9ab8ec3ce92b958b5f0595ad8c3154e2ca9bf70732f42465ac9a84d426add`

### Criterio 4: ✅ superado

_El router selecciona una ruta compatible consultando primero la tarjeta simple_

#### Router sobre las tarjetas reales de los tres adaptadores: ✅ superado

- **Comando:** `node --test --test-reporter=tap packages/router/test/real-adapters.test.ts`
- **Resultado:** 2 pasan, 0 fallan, 0 omitidas (de 2); salida 0
- **Tiempo:** 1.6 s
- **packages/router/test/real-adapters.test.ts (SHA-256):** `5f783d43ae17602fe60e8bbedf762a753ef8bc8a72c52c7250cf506e8fdad933`

### Criterio 5: ✅ superado

_Solo consulta el detalle avanzado cuando una restricción crítica lo requiere_

#### Router: métricas de tarjetas leídas e inspecciones: ✅ superado

- **Comando:** `node --test --test-reporter=tap packages/router/test/real-adapters.test.ts packages/router/test/tokens.test.ts`
- **Resultado:** 7 pasan, 0 fallan, 0 omitidas (de 7); salida 0
- **Tiempo:** 1.5 s
- **packages/router/test/real-adapters.test.ts (SHA-256):** `5f783d43ae17602fe60e8bbedf762a753ef8bc8a72c52c7250cf506e8fdad933`
- **packages/router/test/tokens.test.ts (SHA-256):** `7e97fa90a75b27588ed98b0149339f6b4bf1444e2a4c439ceb3ce2cdcb45f1e4`

#### Fallbacks reales con recuperación: ✅ superado

- **Comando:** `node --test --test-reporter=tap packages/recovery/test/real-fallbacks.integration.test.ts`
- **Resultado:** 3 pasan, 0 fallan, 0 omitidas (de 3); salida 0
- **Tiempo:** 24.8 s
- **packages/recovery/test/real-fallbacks.integration.test.ts (SHA-256):** `0398eb2727f8bace296653e4213b4d0c4d94b647c02eead19307f8e2fb4b1487`

### Criterio 6: ✅ superado

_Los gradientes cambian una propiedad visual comprobable a lo largo del tiempo_

#### Gradientes en Revideo (contorno y sombra por píxeles): ✅ superado

- **Comando:** `node --test --test-reporter=tap packages/adapters/revideo/test/gradients.integration.test.ts`
- **Resultado:** 1 pasan, 0 fallan, 0 omitidas (de 1); salida 0
- **Tiempo:** 11.3 s
- **packages/adapters/revideo/test/gradients.integration.test.ts (SHA-256):** `8272d7d71d94e20b66143dc7124433f8cd6b2d14e716d4154e0c06aec65b0388`

#### Gradientes en Blender (contorno y luminancia): ✅ superado

- **Comando:** `node --test --test-reporter=tap packages/adapters/blender/test/gradients.integration.test.ts`
- **Resultado:** 1 pasan, 0 fallan, 0 omitidas (de 1); salida 0
- **Tiempo:** 37.6 s
- **packages/adapters/blender/test/gradients.integration.test.ts (SHA-256):** `47dccbfff0fae0de185de78f4ebb26fef0eb38578298dc9efc9e4b92d32a2fe4`

### Criterio 7: ✅ superado

_Se exporta correctamente un vídeo híbrido de 10 s con audio y sincronía adecuados_

#### Exportación híbrida con audio y sincronía A/V medida (≤ 1 fotograma): ✅ superado

- **Comando:** `node --test --test-reporter=tap packages/pipeline/test/av-sync.integration.test.ts`
- **Resultado:** 1 pasan, 0 fallan, 0 omitidas (de 1); salida 0
- **Tiempo:** 135.2 s
- **packages/pipeline/test/av-sync.integration.test.ts (SHA-256):** `4b61484293a379f0e6198333b0b88b11def116557e02de8e872c377a0b5550bf`

### Criterio 8: ✅ superado

_Se pueden reabrir las fuentes externas y cambiar una parte sin rehacer todos los activos_

#### Re-render incremental con caché (1 job de Revideo + composición): ✅ superado

- **Comando:** `node --test --test-reporter=tap packages/pipeline/test/incremental.integration.test.ts`
- **Resultado:** 1 pasan, 0 fallan, 0 omitidas (de 1); salida 0
- **Tiempo:** 121.4 s
- **packages/pipeline/test/incremental.integration.test.ts (SHA-256):** `b55e8343031b7c39f56eadefe05a68f4f41ac1149d1caf45354d3b4f63749bfa`

## Reproducir

```
node scripts/prueba-hibrida.mjs
```

Requisitos: Revideo instalado en `runtime/engines/revideo` (`npm ci` allí) y Chrome de Puppeteer (`FME_PUPPETEER_CACHE_DIR`), Blender y FreeCut en las rutas por defecto de sus adaptadores (o `FME_BLENDER_PATH`, `FME_FREECUT_DIR`) y FFmpeg (`FME_FFMPEG_PATH`). `--only 3,8` ejecuta solo esos criterios; `--sin-artefacto` omite la exportación con la CLI. Los hashes de las pruebas son los de sus archivos fuente; el del MP4 depende del codificador y puede variar entre ejecuciones.
