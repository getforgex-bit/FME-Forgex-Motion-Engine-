# 2026-11-25 · Auditoría de licencias de las versiones fijadas (FDN-082)

- **Autor:** `antigravity-b2` (B2, Equipo B) con evidencias de disco aportadas por `antigravity-b1` (B1) · **Sesión:** `antigravity-b2` · **Rama/commit base:** `docs/FDN-082-auditoria-licencias` @ `abbb646` · **Fase:** Fase 1 (tanda 11)

> **Aviso importante:** **Este borrador no constituye asesoría jurídica.** Es una auditoría técnica de inventario, metadatos SPDX y archivos de licencia verificados en disco y lockfiles locales para respaldar la revisión de `A0` y una futura revisión legal antes de comercializar o distribuir FME.
>
> En todo el documento se distingue explícitamente entre **`VERIFICADO`** (observado directamente en disco, lockfiles o salida de comandos locales) y **`POR VALIDAR`** (aspectos jurídicos, de patentes, modelos/activos externos o políticas aún pendientes de dictamen o prueba).

## Objetivo
Consolidar la auditoría técnica completa de licencias (FDN-082) para todas las versiones fijadas en el monorepo raíz, en el motor aislado de Revideo (`runtime/engines/revideo/` y `examples/fase1/revideo/`), en los componentes externos de disco (`FreeCut`, `Blender`, `FFmpeg`, `Chrome for Testing` / `Playwright` / `Edge`) y en las herramientas de desarrollo (`GitNexus`, `CodeGraph`, `Graphify`), contrastando los hallazgos contra `docs/licencias-seguridad.md` y entregando una propuesta de tabla actualizada y lista de control precomercialización.

## Hecho
- Auditado programáticamente `package-lock.json` raíz, `runtime/engines/revideo/package-lock.json`, `examples/fase1/revideo/package-lock.json`, `runtime/engines/revideo/package.json`, `runtime/engines/revideo/ffmpeg-compat.mjs`, los `ADR-0003`, `ADR-0004`, `ADR-0010` y `docs/licencias-seguridad.md`.
- Integradas las evidencias de solo lectura verificadas en disco por `antigravity-b1` (`#63`) para `FreeCut` (`FME-ext/freecut`), `Blender` `5.2.3`, `FFmpeg` `9.0.2` y binarios locales de `Chrome for Testing` / `Playwright` / `msedge.exe`.
- Creado este borrador de informe en `docs/bitacora/2026-11-25-antigravity-licencias.md` (sin modificar `docs/licencias-seguridad.md`, reservado a `A0`).

---

## 1. Matriz completa de componentes fijados

| Componente / Herramienta | Versión fijada | Licencia SPDX verificada | Estado | Acoplamiento actual en FME | ¿Redistribución? | Obligaciones principales y riesgo |
|---|---|---|---|---|---|---|
| **FME (código propio)** | `0.0.0` (privado) | Sin archivo `LICENSE` raíz (`ADR-0004`) | `POR VALIDAR` | Monorepo `packages/*`, `packages/adapters/*`, `runtime/workers`, `apps/*` | **No** (uso interno ForgeX) | Definir licencia propia antes de publicar o distribuir (`ADR-0004`). Riesgo: **medio** si se entrega a terceros sin licencia explícita. |
| **FreeCut** (`FME-ext/freecut`) | Commit `5ceeeb388eef5423640b7db157706274bf1b8165` (`5ceeeb3`) | `MIT` (`LICENSE`, © 2025 FreeCut); transitivas: `MIT`/`Apache-2.0`/`MPL-2.0`/`LGPL-3.0-or-later`/etc. | `VERIFICADO` | Clon externo sin modificar; `packages/adapters/freecut` lo ejecuta como proceso CLI separado (`browser: 'auto'`) | **No** (proceso externo no empaquetado en npm raíz) | Si algún día se empaquetara FreeCut o sus `node_modules`: cumplir avisos `MIT`/`Apache-2.0`/`BlueOak`, `MPL-2.0` (`mediabunny`, `turbores`) y `LGPL-3.0-or-later` (`@img/sharp-libvips-*`), además del navegador subyacente. Riesgo actual: **bajo** (proceso separado); **medio-alto** si se redistribuyera entero. |
| **Revideo** (`@revideo/*`: `2d`, `core`, `ffmpeg`, `renderer`, `ui`, `vite-plugin`) | `0.11.0` | `MIT` (6 paquetes directos); 193 transitivas con `MPL-2.0`, `LGPL-2.1`, `GPL-3.0`/`GPLv3` | `VERIFICADO` | Motor aislado en `runtime/engines/revideo/` (`examples/fase1/revideo/` idéntico), invocado vía `packages/adapters/revideo` como proceso separado | **No** hoy (motor local); **Sí** potencial si se distribuyera el runtime de Revideo | Mantener aislamiento de proceso y avisos `MIT`/`Apache-2.0`. Si se distribuyera `runtime/engines/revideo/node_modules`, revisar `lightningcss` (`MPL-2.0`) y purgar/no distribuir `@ffmpeg-installer/*` / `@ffprobe-installer/*`. Riesgo: **medio**. |
| **`@ffmpeg-installer/*` y `@ffprobe-installer/*`** (transitivas de `@revideo/ffmpeg@0.11.0`) | `@ffmpeg-installer/ffmpeg@1.1.0`, `win32-x64@4.1.0`, `@ffprobe-installer/ffprobe@2.1.2`, `win32-x64@5.1.0` (18 paquetes en lockfile) | `LGPL-2.1` (4), `GPLv3` (6), `GPL-3.0` (7), URL `git.ffmpeg.org/.../LICENSE.md` (`darwin-arm64@4.1.5`, 1) | `VERIFICADO` | Permanecen instalados en `runtime/engines/revideo/package-lock.json` como dependencias de `@revideo/ffmpeg`, pero **no se ejecutan** tras `FDN-016` / `ADR-0010` (`FFMPEG_PATH` + `ffmpeg-compat.mjs`) | **No** (prohibida su redistribución en `docs/licencias-seguridad.md`) | Aunque no se ejecuten, existen en el árbol de `node_modules` de Revideo; excluirlos de cualquier paquete/contenedor distribuible para evitar obligaciones binarias `GPL-3.0` (oferta de fuentes). Riesgo: **alto** si se empaquetaran por error. |
| **FFmpeg (sistema, Gyan)** | `9.0.2-full_build-www.gyan.dev` | **`GPL-3.0-or-later`** (`--enable-gpl`, `--enable-version3`, `--enable-nonfree` = `False`) | `VERIFICADO` | Proceso separado (`FFMPEG_PATH` / `FFPROBE_PATH` y `ffmpeg-compat.mjs`, `ADR-0010`); códecs usados: `libx264` (GPL), `aac` nativo (LGPL), `prores_ks` nativo (LGPL), `libvpx-vp9` (BSD-3-Clause) | **No** (prerrequisito instalado por el usuario/host) | No enlazar ni redistribuir el binario sin cumplir `GPL-3.0-or-later` (código fuente completo correspondiente). Patentes de H.264/AAC/ProRes en uso comercial: **`POR VALIDAR`**. Riesgo: **bajo** como binario de sistema; **alto** si se empaquetara junto a FME. |
| **Blender** | `5.2.3 LTS` (build `e13b728c6880`, 2026-10-21) | **`GPL-3.0-or-later`** (`license/license.md` línea 17); módulos `bpy` en `GPL-2.0-or-later`; `licenses.json` con 27 entradas de terceros | `VERIFICADO` | Proceso separado (`blender -b -P` vía `packages/adapters/blender`), sin enlazar ni redistribuir `bpy` | **No** (prerrequisito local no redistribuido ni modificado) | Mantener comunicación exclusivamente vía CLI/IPC y archivos temporales, sin importar `bpy` en código propietario o distribuido como librería enlazada. Riesgo: **bajo**. |
| **`@modelcontextprotocol/sdk`** | `1.32.2` | `MIT` (con 94 transitivas: `MIT: 85`, `ISC: 7`, `BSD-3-Clause: 2`, `BSD-2-Clause: 1`) | `VERIFICADO` | Dependencia runtime directa de `apps/mcp` (`@fme/mcp`) en el monorepo raíz | **Sí** (si se distribuye `@fme/mcp` o el servidor MCP) | Conservar textos de copyright/licencia `MIT`/`ISC`/`BSD-2/3-Clause` en distribución (`NOTICE` / terceros). Riesgo: **bajo** (`0` copyleft). |
| **`zod`** | `4.6.7` | `MIT` (0 dependencias transitivas) | `VERIFICADO` | Dependencia runtime directa de `@fme/project`, `@fme/art-direction` y `apps/mcp` | **Sí** (si se distribuye cualquier paquete o app de FME) | Conservar aviso `MIT` de `zod`. Riesgo: **mínimo**. |
| **`Chrome for Testing` / `Playwright` / `msedge.exe`** | CfT `157.0.8103.78` (Puppeteer `25.18.1`, `Apache-2.0`); Playwright `chromium-1243` `153.0.8010.12`; `msedge.exe` `157.0.4341.42` | Chromium `BSD-3-Clause` + avisos de terceros (`LICENSE.headless_shell`); `Edge`: **propietario de Microsoft** | `VERIFICADO` | Descarga local de Puppeteer (Revideo) y Playwright (FreeCut); en `FreeCut` (`browser: 'auto'`), al faltar `chrome.exe`, usa `msedge.exe` | **No** (descarga/instalación local en host) | No redistribuir binarios de `Edge` (propietario) ni `Chrome for Testing`/`chrome-headless-shell` sin sus avisos/términos (`LICENSES.chromium.html` ausente en las carpetas de `headless-shell` revisadas). Riesgo: **medio** en despliegue automatizado. |
| **`vite` y `typescript` (runtime Revideo)** | `vite@8.3.8`, `typescript@7.0.2` (plus `lightningcss@1.33.0` transitiva de `vite`) | `vite`: `MIT`; `typescript`: `Apache-2.0`; `lightningcss` (×12): **`MPL-2.0`** | `VERIFICADO` | Declarados en `dependencies` (runtime) de `runtime/engines/revideo/package.json` y `examples/fase1/revideo/package.json` | **Sí** si se distribuye `runtime/engines/revideo` | `vite` y `typescript@7.0.2` se usan en tiempo de ejecución por `@revideo/vite-plugin` / bundler; `MPL-2.0` de `lightningcss` exige mantener disponibles modificaciones a archivos `MPL-2.0` (no aplica copyleft a archivos propios separados). Riesgo: **bajo-medio**. |
| **`@types/node` y `typescript` (dev raíz)** | `@types/node@24.19.2`, `typescript@5.9.3` | `@types/node`: `MIT`; `typescript`: `Apache-2.0` | `VERIFICADO` | `devDependencies` en `package.json` raíz (`3` paquetes `dev` totales en lockfile) | **No** (solo desarrollo y `typecheck`) | Ninguna obligación en runtime si no se empaquetan `devDependencies`. Riesgo: **nulo**. |
| **`GitNexus`** (herramienta dev / MCP) | `1.6.12` | **`PolyForm-Noncommercial-1.0.0`** | `VERIFICADO` | Uso exclusivo de desarrollo (`FORGEX Stack`, `ADR-0003`); no forma parte de `package.json` ni runtime | **No** | **Prohibido uso comercial** (incluso uso interno comercial directo según alcance de `PolyForm-Noncommercial-1.0.0`, ver `ADR-0003`); migrar/desinstalar antes de comercializar FME. Riesgo: **alto** para la organización si se mantiene en flujos comerciales. |
| **`CodeGraph`** (`@colbymchenry/codegraph`) | `1.6.4` | `MIT` | `VERIFICADO` | CLI local de análisis estático en desarrollo; no se distribuye | **No** | Sin restricciones comerciales. Riesgo: **nulo**. |
| **`Graphify`** (`graphifyy`) | `0.9.115` | `Apache-2.0` (`METADATA` en `uv/tools/graphifyy`) | `VERIFICADO` (metadata); ejecución bloqueada por App Control en host | CLI auxiliar de grafo en desarrollo; no se distribuye | **No** | Uso permisivo (`Apache-2.0`), pendiente solo desbloqueo local de política Windows si se requiere ejecutar `graphify.exe`. Riesgo: **nulo** en licencia. |

---

## 2. Desglose cuantitativo de dependencias transitivas

### 2.1 Monorepo raíz (`package-lock.json`, `lockfileVersion: 3`) — `VERIFICADO`
- **Totales:** `14` directorios de workspace + `14` enlaces simbólicos `node_modules/@fme/*` + **`98` paquetes externos** (`95` runtime, `3` devOnly).
- **Directas:** en raíz solo `devDependencies` (`@types/node@24.19.2`, `typescript@5.9.3`). En workspaces: `zod@4.6.7` (`@fme/project`, `@fme/art-direction`, `@fme/mcp`) y `@modelcontextprotocol/sdk@1.32.2` (`@fme/mcp`).
- **Distribución SPDX (`98` externos):**
  - `MIT`: **87** (`85` runtime, `2` dev)
  - `ISC`: **7** (runtime)
  - `BSD-3-Clause`: **2** (runtime)
  - `BSD-2-Clause`: **1** (runtime)
  - `Apache-2.0`: **1** (`dev`: `typescript@5.9.3`)
- **Subárbol de `@modelcontextprotocol/sdk@1.32.2`:** exactamente **`95` paquetes** (`1` directo + **`94` transitivas**): `MIT: 85`, `ISC: 7`, `BSD-3-Clause: 2`, `BSD-2-Clause: 1`.
- **Excepciones / copyleft / paquetes sin licencia:** **`0`** (todo el árbol runtime y dev del monorepo raíz es 100 % permisivo).

### 2.2 Motor Revideo (`runtime/engines/revideo/package-lock.json` y `examples/fase1/revideo/package-lock.json`, `lockfileVersion: 3`) — `VERIFICADO`
- Ambos lockfiles son idénticos en conjunto de paquetes y versiones: **`193` paquetes externos** (`193` runtime, `0` devOnly).
- **Distribución SPDX (`193` externos):**
  - `MIT`: **113**
  - `Apache-2.0`: **32** (incluye `typescript@7.0.2`, `puppeteer@25.18.1`)
  - `ISC`: **12**
  - `MPL-2.0`: **12** (`lightningcss@1.33.0` + `11` binarios opcionales por plataforma, vía `vite@8.3.8`)
  - `GPL-3.0`: **7** (`@ffprobe-installer/{darwin-x64@5.1.0, linux-arm@5.2.0, linux-arm64@5.2.0, linux-ia32@5.2.0, linux-x64@5.2.0, win32-ia32@5.1.0, win32-x64@5.1.0}`, todos opcionales)
  - `GPLv3`: **6** (`@ffmpeg-installer/{linux-arm@4.1.3, linux-arm64@4.1.4, linux-ia32@4.1.0, linux-x64@4.1.0, win32-ia32@4.1.0, win32-x64@4.1.0}`, todos opcionales)
  - `LGPL-2.1`: **4** (`@ffmpeg-installer/ffmpeg@1.1.0` [no opcional], `@ffprobe-installer/ffprobe@2.1.2` [no opcional], `@ffmpeg-installer/darwin-x64@4.1.0` [opcional], `@ffprobe-installer/darwin-arm64@5.0.1` [opcional])
  - `BSD-3-Clause`: **4**
  - URL `https://git.ffmpeg.org/gitweb/ffmpeg.git/blob_plain/HEAD:/LICENSE.md`: **1** (`@ffmpeg-installer/darwin-arm64@4.1.5`, opcional)
  - `SIN_CAMPO_LICENSE` en lockfile: **1** (`async@0.2.10`, no opcional, transitiva de `fluent-ffmpeg@2.1.3`) → **Verificada en disco** (en `examples/fase1/revideo/node_modules/async` y `runtime/engines/revideo/node_modules/async` del worktree `fdn-010-revideo-33dac4`): su `package.json` usa el campo legado `"licenses": [{ "type": "MIT", ... }]` y su archivo `LICENSE` contiene texto estándar **`MIT`** (`Copyright (c) 2010 Caolan McMahon`).
  - `0BSD`: **1**

### 2.3 FreeCut (`C:\Users\bogex\Documents\Forgex\FME-ext\freecut\package-lock.json`, commit `5ceeeb3`) — `VERIFICADO` (por `antigravity-b1` en `#63`)
- **Totales:** **`601` paquetes** (`234` runtime / `367` `devOnly`), **`0` sin licencia**.
- **Distribución SPDX (`601` paquetes):**
  - `MIT`: **453** · `Apache-2.0`: **47** · `MPL-2.0`: **30** · `ISC`: **23** · `BSD-3-Clause`: **18** · `LGPL-3.0-or-later`: **10** · `BlueOak-1.0.0`: **7** · `Apache-2.0 AND LGPL-3.0-or-later`: **3** · `MIT-0`: **2** · `BSD-2-Clause`: **2** · `Apache-2.0 AND LGPL-3.0-or-later AND MIT`: **1** · `CC-BY-4.0`: **1** · `Unlicense`: **1** · `CC0-1.0`: **1** · `0BSD`: **1** · `(MIT OR CC0-1.0)`: **1**.
- **Foco en copyleft y licencias no triviales de FreeCut:**
  - `MPL-2.0` (`prod`): `mediabunny` + `@mediabunny/{aac-encoder,ac3,mp3-encoder,prores}` (`1.54.0`), `turbores` (`1.2.2`).
  - `MPL-2.0` (`dev`): `lightningcss*` (`1.32.0`/`1.33.0`).
  - `LGPL-3.0-or-later` / compuestas (`prod`): `@img/sharp-libvips-*` (`1.2.4`, `LGPL-3.0-or-later`), `@img/sharp-win32-*`/`wasm32` (`0.34.5`, `Apache-2.0 AND LGPL-3.0-or-later [AND MIT]`).
  - Otras: `caniuse-lite` (`dev`, `CC-BY-4.0`), `chownr`/`minipass`/`tar`/`yallist` (`prod`, `BlueOak-1.0.0`), `isbot` (`prod`, `Unlicense`), `onnxruntime-web` (`1.26.0-dev.20260410-5e55544225`, `prod`, `MIT`), `kokoro-js@1.2.1` + `@huggingface/transformers@4.1.0` (`prod`, `Apache-2.0`), `playwright@1.60.0` (`dev`, `Apache-2.0`).

---

## 3. Contraste frente a `docs/licencias-seguridad.md`

Se detectaron **8 discrepancias o desfases** respecto a la tabla actual de `docs/licencias-seguridad.md` (líneas 26-38):

1. **Revideo (`@revideo/*` `0.11.0`, línea 31):** dice *«Prueba aislada `examples/fase1/revideo`; futuro adaptador»*. Desfasado: ya existen `runtime/engines/revideo/` y `@fme/adapter-revideo` (`packages/adapters/revideo`). Además conviene documentar sus **193** dependencias runtime, incluyendo `lightningcss@1.33.0` (`MPL-2.0`) y `async@0.2.10` (`MIT` en `LICENSE`, sin campo `license` en lockfile).
2. **`@ffmpeg-installer/win32-x64` (`4.1.0`, línea 32):** dice *«sustitución en estudio (FDN-016)»*. Desfasado: `FDN-016` y `ADR-0010` ya sustituyeron su ejecución por `FFmpeg` del sistema mediante `FFMPEG_PATH` / `FFPROBE_PATH` y `runtime/engines/revideo/ffmpeg-compat.mjs`, aunque los 18 paquetes `@ffmpeg-installer/*` y `@ffprobe-installer/*` (`LGPL-2.1` / `GPLv3` / `GPL-3.0`) siguen presentes en `runtime/engines/revideo/package-lock.json` como dependencias duras de `@revideo/ffmpeg`.
3. **`Chrome for Testing` (`157.0.8103.78`, línea 33):** solo indica *«Binario de Google»*. Falta precisar licencia verificada (`Chromium BSD-3-Clause + avisos de terceros` en `LICENSE.headless_shell`), presencia local paralela de `Playwright` (`chromium-1243` `153.0.8010.12`) y el hecho de que FreeCut (`browser: 'auto'`) resuelve a **`msedge.exe` `157.0.4341.42` (propietario de Microsoft)** en este equipo cuando no existe `chrome.exe` de sistema.
4. **`Blender` (`5.2.3 LTS`, línea 34):** indica genéricamente `GPL`. Conviene precisar **`GPL-3.0-or-later`** (verificado en `license/license.md` línea 17) y que sus módulos `bpy` llevan cabecera `GPL-2.0-or-later` (no enlazados por FME).
5. **`@modelcontextprotocol/sdk` (`1.32.2`, línea 35):** indica `~94 transitivas` y `npm audit 0` (nota histórica de A2). Verificado en lockfile actual: **`94` transitivas exactas (`95` totales en subárbol)**, todas permisivas (`MIT: 85`, `ISC: 7`, `BSD-3-Clause: 2`, `BSD-2-Clause: 1`). (`npm audit` no se re-ejecutó en FDN-082 por realizarse offline).
6. **`FreeCut` (`5ceeeb3`, línea 36):** conviene actualizar estado de acoplamiento (`packages/adapters/freecut` operativo vía CLI headless) y resumir sus **`601` transitivas** (`234` prod / `367` dev, con `MPL-2.0` en `mediabunny`/`turbores` y `LGPL-3.0-or-later` en `sharp-libvips`).
7. **`vite` (`8.3.8`, línea 37):** dice *«Herramienta de build del motor Revideo; no se distribuye»*. Precisión: tanto `vite@8.3.8` (`MIT`) como **`typescript@7.0.2` (`Apache-2.0`)** están declarados en **`dependencies` (runtime)** de `runtime/engines/revideo/package.json` y `examples/fase1/revideo/package.json`, y `vite` arrastra `lightningcss@1.33.0` (`MPL-2.0`).
8. **Herramientas dev omitidas en la tabla:** el texto previo solo mencionaba `GitNexus` en un párrafo superior, sin versión fijada (`1.6.12`) ni fila para `@colbymchenry/codegraph` (`1.6.4`, `MIT`) y `graphifyy` (`0.9.115`, `Apache-2.0`).

### Tabla actualizada propuesta para que `A0` consolide en `docs/licencias-seguridad.md`

> Propuesta lista para sustituir la tabla de líneas 26-38 (solo `A0` edita `docs/licencias-seguridad.md`):

| Herramienta | Versión fijada | Licencia verificada (SPDX) | Forma de acoplamiento | ¿Se redistribuye? | Fecha | Revisor |
|---|---|---|---|---|---|---|
| @types/node (dev) | 24.19.2 | MIT | `devDependencies` raíz; solo desarrollo/typecheck | No | 2026-11-25 | B2 → A0 |
| typescript (dev raíz) | 5.9.3 | Apache-2.0 | `devDependencies` raíz; solo desarrollo/typecheck | No | 2026-11-25 | B2 → A0 |
| zod | 4.6.7 | MIT (0 transitivas) | Dependencia runtime de `@fme/project`, `@fme/art-direction`, `@fme/mcp` | Sí (si se distribuyen paquetes FME) | 2026-11-25 | B2 → A0 |
| @modelcontextprotocol/sdk | 1.32.2 | MIT (94 transitivas: 85 MIT, 7 ISC, 2 BSD-3-Clause, 1 BSD-2-Clause) | Dependencia runtime de `@fme/mcp` (`apps/mcp`) | Sí (si se distribuye `@fme/mcp`) | 2026-11-25 | B2 → A0 |
| Revideo (`@revideo/*`) | 0.11.0 | MIT (directas); 193 transitivas incl. `lightningcss@1.33.0` (MPL-2.0) y `async@0.2.10` (MIT en `LICENSE`) | Motor en `runtime/engines/revideo/` invocado como proceso separado por `@fme/adapter-revideo` | No (motor aislado local) | 2026-11-25 | B2 → A0 |
| vite / typescript (motor Revideo) | vite 8.3.8 / typescript 7.0.2 | MIT / Apache-2.0 (vite arrastra `lightningcss` MPL-2.0) | `dependencies` runtime de `runtime/engines/revideo` (y `examples/fase1/revideo`) | No (solo con motor Revideo) | 2026-11-25 | B2 → A0 |
| `@ffmpeg-installer/*` y `@ffprobe-installer/*` | win32-x64 4.1.0 / 5.1.0 (18 paq.) | LGPL-2.1 (4), GPLv3 (6), GPL-3.0 (7), URL FFmpeg (1) | Presentes en `runtime/engines/revideo/package-lock.json`; **no ejecutados** tras `ADR-0010` / `FDN-016` | **No** (excluir si se empaqueta Revideo) | 2026-11-25 | B2 → A0 |
| FFmpeg (sistema, Gyan) | 9.0.2-full_build | **GPL-3.0-or-later** (`--enable-gpl --enable-version3`, sin `nonfree`) | Proceso separado (`FFMPEG_PATH` + `ffmpeg-compat.mjs`, `ADR-0010`) | No | 2026-11-25 | B1/B2 → A0 |
| Chrome for Testing / Playwright / Edge | CfT 157.0.8103.78 / Chromium 153.0.8010.12 / Edge 157.0.4341.42 | Chromium BSD-3-Clause + terceros / Edge **propietario Microsoft** | Descarga local (Puppeteer/Playwright) o navegador del sistema (`FreeCut browser: 'auto'` → `msedge.exe`) | No | 2026-11-25 | B1 → A0 |
| Blender | 5.2.3 LTS (`e13b728c6880`) | **GPL-3.0-or-later** (`license.md`); módulos `bpy` en `GPL-2.0-or-later` | Proceso separado (`blender -b -P` vía `@fme/adapter-blender`) | No | 2026-11-25 | B1 → A0 |
| FreeCut | commit `5ceeeb3` (`5ceeeb388eef…`) | MIT (601 transitivas: 453 MIT, 47 Apache-2.0, 30 MPL-2.0, 10 LGPL-3.0-or-later, etc.) | Clon externo `FME-ext/freecut` sin modificar; proceso CLI vía `@fme/adapter-freecut` | No | 2026-11-25 | B1 → A0 |
| GitNexus (dev) | 1.6.12 | **PolyForm-Noncommercial-1.0.0** | Herramienta dev/MCP (`FORGEX Stack`, `ADR-0003`) | No (retirar antes de uso comercial) | 2026-11-25 | B2 → A0 |
| CodeGraph (dev) | 1.6.4 | MIT | CLI dev (`@colbymchenry/codegraph`) | No | 2026-11-25 | B2 → A0 |
| Graphify (dev) | 0.9.115 | Apache-2.0 | CLI dev (`graphifyy` en `uv/tools`) | No | 2026-11-25 | B2 → A0 |

---

## 4. Riesgos y lista de control antes de comercialización o distribución

1. **Aislamiento estricto de copyleft (`GPL` / `LGPL` / `MPL-2.0`):**
   - [ ] Mantener `Blender` (`GPL-3.0-or-later`) y `FFmpeg` (`GPL-3.0-or-later`) exclusivamente como procesos externos invocados por el usuario o aprovisionados en servidor sin redistribución binaria conjunta; si algún producto comercial distribuyera el binario de FFmpeg o Blender, preparar cumplimiento íntegro de código fuente correspondiente (`GPL-3.0`).
   - [ ] No importar `bpy` ni código Python de Blender dentro de paquetes propietarios de FME.
   - [ ] Antes de empaquetar `runtime/engines/revideo/` en cualquier artefacto distribuible (Docker, instalador, zip), eliminar o filtrar `@ffmpeg-installer/*` y `@ffprobe-installer/*` (`GPL-3.0`/`GPLv3`/`LGPL-2.1`) y cumplir avisos de `lightningcss` (`MPL-2.0`).
   - [ ] Si en el futuro se empaqueta `FreeCut` (`FME-ext/freecut`), auditar explícitamente `@img/sharp-libvips-*` (`LGPL-3.0-or-later`) y `@mediabunny/*` / `turbores` (`MPL-2.0`).
2. **Patentes de códecs (`POR VALIDAR` jurídicamente):**
   - [ ] Revisar con asesoría legal las licencias de patente asociadas a codificación/decodificación comercial de **H.264/AVC (`libx264`)**, **AAC (`aac`)** y **Apple ProRes (`prores_ks`)** frente a alternativas libres de regalías como **VP9 (`libvpx-vp9`, `BSD-3-Clause`)** o **AV1/Opus**.
3. **Retiro de herramientas no comerciales (`ADR-0003`):**
   - [ ] Desinstalar o reemplazar `gitnexus@1.6.12` (`PolyForm-Noncommercial-1.0.0`) de los flujos de trabajo y de la configuración del equipo antes de iniciar explotación comercial, priorizando herramientas permisivas ya verificadas (`@colbymchenry/codegraph@1.6.4` `MIT`, `graphifyy@0.9.115` `Apache-2.0` o los candidatos de `ADR-0003`).
4. **Licencia propia de FME y avisos de terceros (`ADR-0004`):**
   - [ ] Definir mediante ADR aprobado la licencia propia de FME (propietaria/comercial o open source) y crear el archivo `LICENSE` en raíz.
   - [ ] Generar un archivo `THIRD-PARTY-NOTICES.md` / `NOTICE` con las atribuciones de las 95 dependencias runtime del monorepo (`MIT`, `ISC`, `BSD-2-Clause`, `BSD-3-Clause`) y de cualquier motor incluido en distribución.
5. **Navegadores headless y automatización:**
   - [ ] Documentar que en Windows con `browser: 'auto'`, FreeCut puede delegar en `msedge.exe` (propietario de Microsoft); en producción/distribución usar un perfil explícito (Chromium/Chrome for Testing bajo `BSD-3-Clause` con `LICENSES.chromium.html` íntegro) y nunca redistribuir `msedge.exe`.
6. **Activos, tipografías y modelos de IA/TTS (`POR VALIDAR`):**
   - [ ] Antes de usar en producción los recursos de `FreeCut` (`kokoro-js` / `@huggingface/transformers` / `onnxruntime-web`), verificar las licencias específicas de cada peso de modelo TTS/ML, fuentes tipográficas y muestras multimedia empleadas en renders comerciales.

---

## Verificado

### Comandos ejecutados por `antigravity-b2` (monorepo, Revideo y herramientas dev)
| Comando / verificación | Resultado real (`VERIFICADO`) |
|---|---|
| `git branch --show-current` y `git rev-parse --short HEAD` | Rama `docs/FDN-082-auditoria-licencias` @ `abbb646` |
| Análisis `node -` de `package-lock.json` raíz | `lockfileVersion: 3`; `14` workspaces + `14` links + `98` externos (`95` runtime, `3` dev); `MIT: 87`, `ISC: 7`, `BSD-3-Clause: 2`, `BSD-2-Clause: 1`, `Apache-2.0: 1`; `FLAGGED: []` |
| Análisis `node -` del subárbol `@modelcontextprotocol/sdk` y `zod` | `MCP_SDK: 1.32.2 MIT totalTree: 95 transitives: 94` (`MIT: 85, BSD-2-Clause: 1, ISC: 7, BSD-3-Clause: 2`); `ZOD: 4.6.7 MIT deps: {}` |
| Análisis `node -` de `runtime/engines/revideo/package-lock.json` y `examples/fase1/revideo/package-lock.json` | Ambos `lockfileVersion: 3`, `193` externos runtime (`0` dev); `MIT: 113`, `Apache-2.0: 32`, `ISC: 12`, `MPL-2.0: 12`, `GPL-3.0: 7`, `GPLv3: 6`, `LGPL-2.1: 4`, `BSD-3-Clause: 4`, URL FFmpeg `1`, `SIN_CAMPO_LICENSE: 1` (`async@0.2.10`), `0BSD: 1` |
| Lectura de `runtime/engines/revideo/node_modules/async/{package.json,LICENSE}` (en worktree `fdn-010-revideo-33dac4`) | `async@0.2.10` incluye `"licenses": [{"type": "MIT", ...}]` y texto estándar `MIT` (`Copyright (c) 2010 Caolan McMahon`) |
| Lectura de `runtime/engines/revideo/package.json` y `ffmpeg-compat.mjs` | `dependencies`: `@revideo/*@0.11.0`, `typescript@7.0.2`, `vite@8.3.8`; `ffmpeg-compat.mjs` parchea `fluent-ffmpeg` para usar FFmpeg de sistema (`ADR-0010`) |
| Inspección local de `gitnexus`, `codegraph`, `graphifyy` | `gitnexus@1.6.12` (`PolyForm-Noncommercial-1.0.0`); `@colbymchenry/codegraph@1.6.4` (`MIT`); `graphifyy@0.9.115` (`Apache-2.0` en `METADATA`, ejecución bloqueada por Control de aplicaciones) |
| Lectura de `docs/licencias-seguridad.md`, `ADR-0003`, `ADR-0004`, `ADR-0010` | Confirmadas las 11 filas actuales y decisiones previas vigentes |

### Comandos y archivos verificados en disco por `antigravity-b1` (`#63`)
| Elemento | Resultado real reportado por B1 (`VERIFICADO`) |
|---|---|
| `FME-ext/freecut` (`git rev-parse HEAD`, `LICENSE`, `package.json`, `package-lock.json`) | Commit `5ceeeb388eef5423640b7db157706274bf1b8165`; `MIT License` (`Copyright (c) 2025 FreeCut`); `packageManager: npm@11.8.0`; `601` paquetes (`234` runtime / `367` devOnly, `0` sin licencia) |
| `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe --version`, `license\license.md`, `COPYRIGHT.txt`, `license\licenses.json`, `bpy` | `Blender 5.2.3 LTS` (`e13b728c6880`, `2026-10-21`); `license.md` línea 17 declara `GPL 3.0 or later`; `licenses.json` lista 27 entradas; `bpy/{ops,path}.py` con `GPL-2.0-or-later` |
| `ffmpeg -version`, `ffmpeg -L`, `ffmpeg -hide_banner -encoders` | `ffmpeg version 9.0.2-full_build-www.gyan.dev`; `--enable-gpl`, `--enable-version3`, sin `--enable-nonfree`; `GPL-3.0-or-later`; códecs `libx264`, `aac`, `prores_ks`, `libvpx-vp9` |
| Binarios Chrome for Testing / Playwright / Edge en disco | Puppeteer `chrome\win64-157.0.8103.78` y `chrome-headless-shell` (`LICENSE.headless_shell` `2,382,256 bytes`, sin `LICENSES.chromium.html`); Playwright `chromium-1243` (`153.0.8010.12`); FreeCut `browser: 'auto'` resuelve a `msedge.exe` (`157.0.4341.42`, propietario) |

## Decisiones tomadas
- No se introducen cambios normativos ni nuevos ADRs en esta tarea; el entregable es una auditoría de contraste y preparación para que `A0` actualice `docs/licencias-seguridad.md` y decida la revisión legal antes de comercialización.

## Pendiente / próxima acción
- Revisión por `B0` / `A0` de este borrador y consolidación de la tabla actualizada en `docs/licencias-seguridad.md` por parte de `A0`.
- Validación jurídica (`POR VALIDAR`) sobre patentes de códecs (`H.264`/`AAC`/`ProRes`), licencia propia de FME (`ADR-0004`) y licencias de pesos/modelos de terceros en FreeCut antes de comercialización.

## Memoria actualizada
- Sin cambios en `.forgex/memory.jsonl` en esta tarea de documentación (solo se escribe esta bitácora autorizada).
