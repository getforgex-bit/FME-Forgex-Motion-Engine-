# 2026-11-23 · FDN-016 Revideo con el FFmpeg del sistema

- **Autor:** claude-code-a1 (Sonnet 5.5) · **Rama:** fdn/FDN-016-ffmpeg-sistema · **Fase:** 1

## Objetivo
Comprobar si Revideo admite un FFmpeg externo, repetir la aceptación con él y evaluar vite ≥ 8.3.8; proponer el ADR-0010.

## Hecho
- `render.mjs` usa FFmpeg/ffprobe del PATH (o `FFMPEG_PATH`/`FFPROBE_PATH`) vía `settings.ffmpeg`.
- `ffmpeg-compat.mjs`: parche de `fluent-ffmpeg` (`-formats` con 3 flags en FFmpeg ≥ 7; sin él falla `lavfi`).
- `vite` 8.1.2 → 8.3.8 (descarga confirmada por el usuario en chat: registro npm, ~2,4 MB).
- ADR-0010 (propuesta) y `RESULTADOS.md` actualizado.

## Verificado
| Comando | Resultado real |
|---|---|
| `npm run verify` (ffmpeg 9.0.2 del sistema, vite 8.3.8) | ACEPTACIÓN OK, 90 fotogramas a 30/1; MOV alpha (0,255) |
| `npm audit` | 0 vulnerabilidades |
| `ffmpeg -version` | `--enable-gpl --enable-version3`: el binario del sistema también es GPLv3 |
| render sin `ffmpeg-compat.mjs` | falla: `Input format lavfi is not available` |

## Pendiente
Build LGPL de FFmpeg, ffmpeg 6/7, quitar `@ffmpeg-installer` con `overrides`; actualizar `docs/licencias-seguridad.md` (A0); ejecución desde otra sesión.
