# FDN-012 · Verificar FreeCut — Resultados (Fase 1)

- **Tarea:** `FDN-012` · **Sesión:** `antigravity-b1` · **Rama:** `fdn/FDN-012-freecut`
- **Estado:** **VERIFICADO en ejecución local real** (2026-11-23), tras autorización explícita del usuario registrada en `FME-ops` (`20261123T063256331Z`).

---

## 1. Versión fijada, licencia y tamaño en disco

- **Repositorio upstream:** `https://github.com/walterlow/freecut.git`
- **Clon local (fuera del repo FME):** `C:\Users\bogex\Documents\Forgex\FME-ext\freecut`
- **Commit fijado (`git rev-parse HEAD`):** `5ceeeb388eef5423640b7db157706274bf1b8165` (HEAD de `main` del 2026-10-29; sin tags ni releases oficiales en upstream).
- **Licencia verificada en `LICENSE`:** `MIT` (`Copyright (c) 2025 FreeCut`). En `card.advanced.json` queda `licenseReview: "pending"` hasta que A0 registre la fila correspondiente en `docs/licencias-seguridad.md`.
- **Tamaño en disco medido:**
  - Clon Git limpio: `79,390,251` bytes (~75,7 MiB).
  - Tras `npm.cmd ci` (425 paquetes añadidos con `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, sin descargar Chromium nuevo): `1,220,959,816` bytes (~1,14 GiB).
- **Compilación del harness (`npm.cmd run build`):** OK en `12,03s` (exit `0`), genera `dist/headless.html`.
- **Suite contractual Node de FreeCut (`npm.cmd run headless:test:node`):** `108/108` pruebas en verde (`4086.77ms`).

---

## 2. Entorno de verificación y navegadores

- **Sistema:** Windows 11, Node `v24.21.0`, npm `11.19.0`, FFmpeg/FFprobe `9.0.2-full_build-www.gyan.dev`, GPU `NVIDIA GeForce RTX 3050 Laptop GPU (4096 MiB)` + GPU integrada AMD (`gcn-5`).
- **Hallazgo real sobre `channel: 'chrome'` en upstream:**
  - Al ejecutar directamente `node headless/probe.mjs` en `FME-ext\freecut`, falla con exit `1`:
    `browserType.launch: Chromium distribution 'chrome' is not found at C:\Users\bogex\AppData\Local\Google\Chrome\Application\chrome.exe`.
  - Los scripts CLI upstream (`headless/probe.mjs`, `headless/agent.mjs`, `headless/render.mjs`, `headless/serve.mjs`, `headless/lib/page-session.mjs`) fijan `channel: 'chrome'`.
  - **Solución sin forkear (`AGENTS.md` regla 2):** [`freecut-e2e.mjs`](./freecut-e2e.mjs) importa directamente los módulos oficiales `headless/lib/*.mjs` de `FME-ext\freecut` y selecciona automáticamente `channel: 'msedge'` (Edge `157.0.4341.42` instalado en Windows), `chrome`, o la caché local `%LOCALAPPDATA%\ms-playwright\chromium-1243`.
- **Capacidades WebGPU + WebCodecs medidas en el equipo:**
  - `msedge` (`channel: 'msedge'`): `isSecureContext: true`, WebGPU `ok: true` (`vendor: "amd"`, `arch: "gcn-5"`), `VideoEncoder`: `h264: true`, `h264Main: true`, `hevc: false`, `vp9: true`, `av1: true`; `AudioEncoder`: `aac: true`, `opus: true`.
  - `chromium-1243` (caché Playwright local): `isSecureContext: true`, WebGPU `ok: true` (`vendor: "amd"`, `arch: "gcn-5"`), `VideoEncoder`: `h264: true`, `h264Main: true`, `hevc: true`, `vp9: true`, `av1: true`; `AudioEncoder`: `aac: true`, `opus: true`.

---

## 3. Ejecución repetible desde cero (`run.ps1`) y evidencia `ffprobe` / SHA-256

Script PowerShell 5.1 repetible: [`run.ps1`](./run.ps1) (borra `out/` y ejecuta desde cero [`generate-test-clip.ps1`](./generate-test-clip.ps1) → [`freecut-e2e.mjs`](./freecut-e2e.mjs) → `ffprobe` + `Get-FileHash`).

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\examples\fase1\freecut\run.ps1
```

### Flujo E2E ejecutado dentro del motor real de FreeCut (`window.freecut`)
1. Generación de entrada sintética (`generate-test-clip.ps1`): `out/test-clip-5s.mp4` (`2,027,339` bytes, SHA-256 `5C3134E27E3D15DA4956B96CBD8B50F737BE1F487ACA95CAF8C73AC86741120A`, H.264 `1280x720` `30/1` `150` frames + AAC `48000` Hz `1` ch `5` s).
2. Creación de workspace en `out/workspace/` y proyecto `fdn012-sample` (`1280x720`, `30` FPS) con `window.freecut.createProject` + `createProjectResource`.
3. Importación real del clip MP4 con `stageLocalMedia` + `window.freecut.probeMedia` + `commitStagedMedia` (`videoCodecSupported: true`, `audioCodecSupported: true`).
4. Edición programática en timeline con `window.freecut.editProject` (`addClip`, `addTrack`, `addText` `"FDN-012 FreeCut"` en frames `15..105`) + `normalizeProject` + `saveProjectResource` (`3` pistas: `V2`, `V1`, `A1`; `3` items).
5. Exportación MP4 (`codec: 'avc'`, `audioCodec: 'aac'`, `container: 'mp4'`, `quality: 'high'`, `1280x720`, `30` FPS) mediante `prepareJob` + `renderJob` hacia `out/exported.mp4` (`warnings: []`).

### Resultados medidos en dos corridas completas desde cero

| Métrica | Corrida 1 | Corrida 2 |
|---|---:|---:|
| Tiempo total pared (`run.ps1`) | `6352.81` ms | `6564.05` ms |
| Tiempo E2E Node (`freecut-e2e.mjs`) | `5113` ms | `5123` ms |
| Pico RAM proceso Node | `164.02` MiB | `180.83` MiB |
| Pico RAM procesos Edge lanzados | `867.1` MiB | `953.76` MiB |
| VRAM GPU NVIDIA (`nvidia-smi`, 4 muestras) | `0–0` MiB (WebGPU usó GPU AMD `gcn-5`) | `0–0` MiB (WebGPU usó GPU AMD `gcn-5`) |
| Tamaño `out/exported.mp4` | `6,431,872` bytes | `6,431,872` bytes |
| SHA-256 `out/exported.mp4` | `FD37DD11FFF8C63284A4CDF376A8E9C5CCBB979B562DD32584A14DD357B31090` | `083E12A66E5719099BCC668D959B415D343D018B2219201D32CF21F4A4C199D1` |

**Verificación `ffprobe` sobre `out/exported.mp4` (idéntica en ambas corridas):**
- **Contenedor:** `mov,mp4,m4a,3gp,3g2,mj2`, duración `5.013333` s.
- **Stream vídeo:** `h264`, `yuv420p`, `1280x720`, `avg_frame_rate: 30/1`, `r_frame_rate: 30/1`, `nb_frames: 150`, `durationSec: 5`.
- **Stream audio:** `aac`, `48000` Hz, `2` canales (estéreo), `durationSec: 5.013333`.
- **Nota sobre determinismo:** El tamaño del MP4 (`6,431,872` bytes) y todos los parámetros de `ffprobe` se repitieron exactamente, pero el SHA-256 del contenedor `.mp4` cambió entre corridas (metadatos/timestamps de muxing o encoder WebCodecs). Por ello `card.advanced.json` declara `deterministicContainer: "no"` y `deterministicOutput: "unknown"`.

---

## 4. Automatización existente y formato de proyecto en disco

### Qué automatización existe realmente en FreeCut (`5ceeeb3`)
1. **CLI headless oficial (Node + Playwright + harness `dist/headless.html`):**
   - `headless/agent.mjs`: lifecycle completo (`capabilities`, `project create/list/get/save/update/edit`, `media import/list/get/probe`, `render`).
   - `headless/edit.mjs`, `headless/render.mjs`, `headless/frame.mjs`, `headless/layout.mjs`.
   - **Limitación real en Windows sin Chrome:** los entrypoints CLI upstream fijan `channel: 'chrome'` en Playwright. Sin modificar el repo de FreeCut, un wrapper/adaptador que importe `headless/lib/*` (como `freecut-e2e.mjs`) puede usar Edge (`channel: 'msedge'`) o el Chromium local de Playwright.
2. **Servidor HTTP local cálido (`headless/serve.mjs`):**
   - API HTTP en `127.0.0.1:8787` (`/v1/projects`, `/v1/media/import`, `/v1/render`, `/render`, `/edit`, `/frame`, `/layout`, `/health`, `/capabilities`). *(Documentado por lectura de código y 108/108 tests Node; no arrancado en `run.ps1` → `headlessHttpApi: "unknown"` en `card.advanced.json`.)*
3. **Interfaz web interactiva (`npm run dev` / `vp preview`):**
   - Requerida solo para edición visual interactiva en timeline, previsualización manual o funciones de IA local en navegador; **no es necesaria** para importar media, aplicar operaciones de timeline y exportar MP4 de forma automatizada.

### Formato real de proyecto y workspace en disco
Estructura generada en `out/workspace/`:
- `index.json`: índice de proyectos del workspace.
- `media/<mediaId>/<archivo>` + `media/<mediaId>/metadata.json`: blob fuente copiado/enlazado y metadatos (`width`, `height`, `fps`, `duration`, `codec`, `audioCodec`, `audioCodecSupported`, `videoCodecSupported`).
- `projects/<projectId>/media-links.json`: vínculo entre proyecto y `mediaIds`.
- `projects/<projectId>/project.json`: documento JSON plano (`schemaVersion: 15`) con `metadata` (`width`, `height`, `fps`, `backgroundColor`) y `timeline` (`tracks[]`, `items[]`, `currentFrame`, `zoomLevel`, `scrollPosition`, `masterBusDb`).

Ejemplo real completo capturado tras la ejecución: [`sample-project.json`](./sample-project.json) (`3` pistas `V2`/`V1`/`A1` y `3` items `video`/`audio`/`text`, `114` líneas).

---

## 5. Recomendación de adaptador para `FDN-041` y tarjetas

- **Recomendación para `FDN-041`:** **Nivel A (CLI aislado sin shell, compatible con ADR-0011 punto 3)**.
  - **Justificación:** FreeCut expone un ciclo completo programático en `headless/lib/*` + `dist/headless.html` (`createProject`, `probeMedia`, `editProject`, `normalizeProject`, `renderProject`) que se ejecuta de extremo a extremo desde un único proceso `node` invocado con `runIsolated` (sin shell, escribiendo exclusivamente en `ctx.workDir` con `timeoutMs`), sin requerir UI manual ni servidor HTTP persistente.
  - **Requisito de integración (sin forkear FreeCut):** El ejecutor en `runtime/engines/freecut/` o `@fme/adapter-freecut` debe envolver `headless/lib/*` permitiendo configurar el navegador (`msedge` / `chrome` / `executablePath`), evitando el hardcode `channel: 'chrome'` de los scripts CLI upstream.
  - **Limitación conocida (`alpha`):** La exportación por `WebCodecs` + `mediabunny` produce contenedores estándar `yuv420p` (`mp4`/`webm`/`mov`/`mkv`) sin canal alpha (`alpha: "no"` en [`card.advanced.json`](./card.advanced.json)), por lo que capas que exijan transparencia deben enrutarse a `revideo` o `adapter.blender`.
- **Tarjetas actualizadas:** [`card.simple.json`](./card.simple.json) y [`card.advanced.json`](./card.advanced.json) validadas contra el contrato `0.1` (`packages/connectors/src/index.ts`).
