# 2026-11-22 · FDN-010 verificar Revideo

- **Autor:** claude-code-a1 (Sonnet 5.5) · **Sesión:** claude-code-a1 · **Rama/commit:** fdn/FDN-010-revideo · **Fase:** 1

## Objetivo
Demostrar que Revideo renderiza headless en la PC de referencia (criterio #1, parte Revideo) y emitir sus tarjetas de conector.

## Hecho
- Revisión upstream (API de GitHub): activo, MIT, release 0.11.0 (2026-07-10).
- Proyecto npm aislado `examples/fase1/revideo/` (fuera de los workspaces) con Revideo 0.11.0 exacto, escena de 90 fotogramas, `render.mjs`, `run.ps1` (`npm run verify`), `RESULTADOS.md`, `card.simple.json`, `card.advanced.json`.
- Instalación autorizada por el usuario en chat (npm, 6 paquetes @revideo + vite + typescript, Chrome ~150-250 MB estimados; **real: 364 MB de node_modules + 443 MB de Chrome**). Se añadió además `@revideo/ui@0.11.0` (1,3 MB, mismo origen/versión) porque `vite-plugin` lo exige; no estaba en la lista mostrada al usuario.

## Verificado
| Comando | Resultado real |
|---|---|
| `npm run verify` (dos veces; la 2.ª con `node_modules` borrado) | `ACEPTACIÓN OK: 90 fotogramas a 30 FPS`; mismos SHA-256 |
| `ffprobe -count_frames` sobre `out/fme-revideo.mp4` | h264, 1280×720, 30/1, nb_read_frames=90, 3.000000 s |
| `alpha.mov` + PIL | ProRes yuva444p12le, alpha extremos (0,255) |
| `nvidia-smi` | 0 MiB de VRAM usada (render por software) |

`npm run typecheck` (raíz) → sin errores. `npm test` no se ejecutó: no se tocó código de los paquetes.

## Decisiones tomadas
Ninguna duradera. Candidata a ADR (para A0): licencia GPLv3 del ffmpeg que trae `@ffmpeg-installer` si se redistribuye.

## Pendiente / próxima acción
1. Subir vite a ≥ 8.3.8 y reprobar (npm audit high).
2. Investigar el exportador wasm (MP4 vacío), WebM-alpha, FPS fraccionario, ffmpeg del sistema, 1080p.
3. FDN-032 usa `renderVideo` con exportador ffmpeg, `range` calculado `(frames-1)/fps` y fondo `rgba(0,0,0,0)` para alpha.

## Memoria actualizada
No actualizada (MCP `forgex` no usado en esta sesión); A0 puede registrar las trampas 1-4 de `RESULTADOS.md` como `gotcha`.
