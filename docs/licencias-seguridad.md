# Licencias, comercialización y seguridad

> Fuente: especificación v0.1, §18. **Este documento no es asesoría jurídica.**

## 1. Política comercial

FME busca comercializarse más adelante. El diseño puede combinar componentes permisivos con programas copyleft, pero **antes de distribuir** hay que auditar: formas de acoplamiento, binarios redistribuidos, modificaciones, avisos, código fuente requerido, licencias de dependencias y códecs. Ejecutar un componente GPL como proceso separado puede reducir el acoplamiento, pero **no garantiza automáticamente** que cualquier esquema de distribución sea conforme.

| Categoría | Tratamiento |
|---|---|
| MIT / BSD / Apache / ISC | En general permiten uso comercial conservando avisos y condiciones |
| GPL / LGPL | Obligaciones específicas según distribución, modificación y enlace |
| FFmpeg | La licencia efectiva depende de los flags de compilación y de las bibliotecas incluidas [S5] |
| Blender | La redistribución de versiones modificadas se rige por la GPL [S3] |
| Assets, fuentes, pesos de IA, códecs | Auditoría independiente del programa; revisar derechos comerciales y atribuciones |

### Estado de las licencias
La revisión de la spec corroboró fuentes primarias de FreeCut, Revideo, Blender, OpenToonz, libmypaint, ThorVG, Natron, OpenFX, OpenColorIO, FFmpeg y el SDK MCP. Las demás licencias del catálogo están **pendientes de auditoría completa** de versión y dependencias.

### Herramientas internas de desarrollo
- **GitNexus** (grafo de código de FORGEX Stack, usado por los agentes en este repo) tiene licencia **PolyForm Noncommercial 1.0.0**. Es una herramienta de desarrollo y **no se distribuye** con FME, pero su uso en trabajo comercial requiere una licencia de sus autores. Decisión heredada del Segundo Cerebro: usarlo ahora y **migrar antes de cualquier uso comercial** (candidatos: CodeGraphContext, Serena). Ver [ADR-0003](decisiones/0003-forgex-stack-como-memoria.md).

### Registro de auditoría
Cuando se fije una versión de una herramienta, añade una fila aquí:

> **Auditoría FDN-082 (2026-11-25):** hecha por Antigravity (B2, con B1), consolidada por A0. Detalle (transitivas por licencia, comandos y riesgos): [bitácora](bitacora/2026-11-25-antigravity-licencias.md).

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

**Lista de control antes de distribuir o comercializar** (completa en la bitácora §4):
- [ ] Blender y FFmpeg (GPL-3.0-or-later) solo como procesos externos, sin redistribución binaria conjunta.
- [ ] Antes de empaquetar `runtime/engines/revideo`, quitar `@ffmpeg-installer/*` y `@ffprobe-installer/*` (GPL/LGPL; ya no se ejecutan, ADR-0010).
- [ ] Si se empaqueta FreeCut: auditar `@img/sharp-libvips-*` (LGPL-3.0-or-later) y los módulos MPL-2.0.
- [ ] En Windows, FreeCut puede usar `msedge.exe` (propietario): en distribución, fijar Chromium o Chrome for Testing.
- [ ] Retirar GitNexus (PolyForm Noncommercial) antes de cualquier uso comercial (ADR-0003).
- [ ] Definir la licencia propia de FME (ADR-0004, pendiente).

## 2. Seguridad del enrutador y de los adaptadores

- No ejecutar scripts aportados por el agente con acceso irrestricto a todo el equipo.
- Aislar los directorios de trabajo y de artefactos, validar rutas y restringir el acceso a red cuando proceda.
- Registrar permisos, operaciones destructivas, timeouts, consumo máximo de recursos y resultados.
- Auditar los puentes MCP de terceros y evitar servidores expuestos sin autenticación.
- Verificar checksums y versiones de las dependencias antes de distribuirlas.
- Ejecución de Python en Blender y de comandos de sistema: sandbox o proceso aislado cuando sea posible, rutas permitidas, tiempo máximo, lista de acciones, permisos de escritura/red y **confirmación para operaciones destructivas**.

## 3. Secretos

- Nunca se versionan credenciales, tokens ni claves. `.env*` está en `.gitignore`.
- Los archivos generados por FORGEX Stack con rutas locales (`pctx.json`, `.mcp.json`, `.agents/`, `.codex/`) **no se versionan**.
- La memoria del proyecto (`.forgex/memory.jsonl`) **sí se versiona**: no guardes en ella datos sensibles ni secretos.
