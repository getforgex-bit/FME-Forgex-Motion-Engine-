# 2026-11-22 · FDN-012 Verificación de FreeCut

- **Autor:** `antigravity-b1` (Antigravity, Equipo B) · **Worktree:** `C:\Users\bogex\Documents\Forgex\FME-wt\antigravity` · **Rama:** `fdn/FDN-012-freecut` · **Fase:** 1

## Objetivo
Ejecutar la verificación completa de `FDN-012` (criterio de aceptación #1, parte FreeCut): fijar commit oficial de `walterlow/freecut` tras autorización del usuario, instalar y compilar en `C:\Users\bogex\Documents\Forgex\FME-ext\freecut`, importar un clip MP4 de prueba, editar timeline, exportar MP4 verificado con `ffprobe` + SHA-256, capturar un `project.json` real y emitir tarjetas v0.1 y recomendación para `FDN-041`.

## Hecho
- Clonado `https://github.com/walterlow/freecut.git` en `C:\Users\bogex\Documents\Forgex\FME-ext\freecut` (fuera del repo FME) en el commit `5ceeeb388eef5423640b7db157706274bf1b8165` (licencia `MIT`).
- Instaladas dependencias con `npm.cmd ci` (con `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, sin descargar Chromium adicional) y compilado `dist/headless.html` con `npm.cmd run build`.
- Creados [`examples/fase1/freecut/generate-test-clip.ps1`](../../examples/fase1/freecut/generate-test-clip.ps1), el driver E2E [`examples/fase1/freecut/freecut-e2e.mjs`](../../examples/fase1/freecut/freecut-e2e.mjs) (usa `headless/lib/*` sin modificar FreeCut y soporta Edge/Chrome/Playwright local ante el hardcode `channel: 'chrome'` upstream) y el runner PowerShell 5.1 repetible [`examples/fase1/freecut/run.ps1`](../../examples/fase1/freecut/run.ps1).
- Capturado el proyecto real generado en disco en [`examples/fase1/freecut/sample-project.json`](../../examples/fase1/freecut/sample-project.json) (`schemaVersion: 15`).
- Actualizados [`card.simple.json`](../../examples/fase1/freecut/card.simple.json), [`card.advanced.json`](../../examples/fase1/freecut/card.advanced.json) y [`RESULTADOS.md`](../../examples/fase1/freecut/RESULTADOS.md) con recomendación **Nivel A (CLI aislado sin shell, ADR-0011)** para `FDN-041`.

## Verificado
| Comando / Comprobación | Resultado real observado |
|---|---|
| `git -C C:\Users\bogex\Documents\Forgex\FME-ext\freecut rev-parse HEAD` | `5ceeeb388eef5423640b7db157706274bf1b8165` (clon `79,390,251` bytes; tras `npm.cmd ci`: `1,220,959,816` bytes) |
| `npm.cmd run build` (en `FME-ext\freecut`) | Exit `0` en `12.03s`; `dist/headless.html` generado (`True`) |
| `npm.cmd run headless:test:node` (en `FME-ext\freecut`) | Exit `0` (`108/108` pruebas en verde en `4086.77ms`) |
| `node headless/probe.mjs` (en `FME-ext\freecut`) | Exit `1`: `Chromium distribution 'chrome' is not found` (confirma hardcode `channel: 'chrome'`) |
| Sonda WebGPU + WebCodecs (`msedge` y `chromium-1243`) | Ambos `isSecureContext: true`, WebGPU `ok: true` (`amd gcn-5`), `h264: true`, `vp9: true`, `av1: true`, `aac: true`, `opus: true` |
| `powershell -NoProfile -ExecutionPolicy Bypass -File .\examples\fase1\freecut\run.ps1` (corrida 1) | Exit `0` en `6352.81ms` (Node `164.02` MiB, Edge `867.1` MiB, VRAM NVIDIA `0` MiB); `exported.mp4` `6,431,872` bytes, SHA-256 `FD37DD11FFF8C63284A4CDF376A8E9C5CCBB979B562DD32584A14DD357B31090` |
| `powershell -NoProfile -ExecutionPolicy Bypass -File .\examples\fase1\freecut\run.ps1` (corrida 2 desde cero) | Exit `0` en `6564.05ms` (Node `180.83` MiB, Edge `953.76` MiB); `exported.mp4` `6,431,872` bytes, SHA-256 `083E12A66E5719099BCC668D959B415D343D018B2219201D32CF21F4A4C199D1` |
| `ffprobe` sobre `out/exported.mp4` | Contenedor `mov,mp4,m4a,3gp,3g2,mj2` `5.013333s`; vídeo `h264` `yuv420p` `1280x720` `30/1` `150` frames `5s`; audio `aac` `48000 Hz` `2 ch` `5.013333s` |

## Pendiente
- Revisión por B0 del commit en `fdn/FDN-012-freecut` antes de emitir el evento `REVIEW` a `claude-code-a0`.
- Registro de la fila `FreeCut` (`0.0.0+5ceeeb3`, MIT) en `docs/licencias-seguridad.md` por A0 durante la integración.
- En `FDN-041` (`@fme/adapter-freecut`): implementar el adaptador CLI Nivel A reutilizando el wrapper sin forkear FreeCut y añadiendo prueba opcional de `addKeyframe` / `webm` si la Fase 4 lo requiere.
