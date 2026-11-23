# 2026-11-23 · FDN-032 adaptador Revideo

- **Autor:** claude-code-a1 (Sonnet 5.5) · **Rama:** fdn/FDN-032-adapter-revideo · **Fase:** 3

## Objetivo
Primer adaptador real: `ConnectorAdapter` (ADR-0011) que renderiza una capa `text`/`svg` de un proyecto FME a MP4 o MOV ProRes 4444 con procedencia.

## Hecho
- `packages/adapters/revideo` (`@fme/adapter-revideo`): `mapping.ts` (muestreo puro de canales x/y/opacity/scale/rotation con easing linear/smooth/hold), `adapter.ts` (`RevideoAdapter`: `probe()` real, `run()` con `runIsolated`, diagnósticos `engine-missing`, `unsupported-fps`, `unsupported-layer`, `layer-not-found`, `timeout`, `render-failed`, `no-output`…), `cards.ts`.
- `runtime/engines/revideo`: motor aislado con `cli.mjs`, escena genérica, proyectos opaco/alpha, `ffmpeg-compat.mjs`, lockfile propio. Instalado con `npm ci --prefer-offline` previa confirmación del usuario (~364 MB; Chrome reutilizado de `examples/fase1/revideo/out/.puppeteer`).
- Aplicado lo de FDN-010/016: rango inclusivo, exportador ffmpeg, alpha solo ProRes con `rgba(0,0,0,0)`, ffmpeg explícito (ADR-0010) y parche lavfi.

## Verificado
| Comando | Resultado real |
|---|---|
| `npx tsc -b packages/adapters/revideo` | sin errores |
| `npx tsc -p tsconfig.test.json` | sin errores |
| `npm test` (raíz) | 86 pass, 0 fail, 0 skipped (incluye 9 unitarios del mapeo y 6 de integración con el motor real) |
| integración: título de la fixture híbrida | 120 fotogramas a 30 FPS, 1920×1080 (`probe-media.mjs`), `checkAdapterResult` = [] |
| integración: `alpha:true` | MOV ProRes con alpha, 120 fotogramas |
| integración: capa SVG (asset temporal) | 210 fotogramas |
| `FME_FFMPEG_PATH` inválido | 3 tests de integración en **skip** con el motivo; el resto en verde |

## Decisiones / interpretaciones a validar por A0
- `Keyframe.frame` relativo a la capa; el `easing` de una clave gobierna el tramo que **llega** a ella (coherente con la fixture); antes de la 1.ª clave y tras la última se mantiene su valor. x/y en px desde el centro, rotation en grados.
- La capa `text` no tiene campo de texto en el contrato: se usa `requirements.text` (por defecto, el nombre del proyecto). Propuesta de cambio de contrato si se quiere en el proyecto.
- `executor: 'cli'`, `editability: 'baked'`, `licenseReview: 'pending'` (ffmpeg GPLv3, ADR-0010).

## Pendiente
- Solo 30 FPS; sin audio, ni varias capas por render, ni NTSC.
- El render escribe temporales de Revideo en `os.tmpdir()` (fuera de `workDir`).
- `package-lock.json`/`tsconfig.json` raíz: A0 añade la referencia al integrar.
- Test de integración depende de FFmpeg y Chrome locales (skip si faltan).
