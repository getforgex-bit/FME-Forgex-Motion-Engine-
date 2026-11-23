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

| Herramienta | Versión fijada | Licencia verificada | Forma de acoplamiento | Fecha | Revisor |
|---|---|---|---|---|---|
| @types/node (dev) | 24.19.2 | MIT (DefinitelyTyped) | Solo desarrollo, no se distribuye | 2026-11-22 | A0 |
| typescript (dev) | 5.9.3 | Apache-2.0 | Solo desarrollo, no se distribuye | 2026-11-22 | A0 |
| zod | 4.6.7 | MIT | Dependencia de runtime de `@fme/project` (se distribuiría) | 2026-11-23 | A2 → A0 |
| Revideo (`@revideo/*`) | 0.11.0 | MIT | Prueba aislada `examples/fase1/revideo`; futuro adaptador | 2026-11-23 | A1 → A0 |
| @ffmpeg-installer/win32-x64 (transitiva de Revideo) | 4.1.0 (FFmpeg N-92722, 2018) | **Binario GPLv3** | Proceso separado; **no redistribuir**; sustitución en estudio (FDN-016) | 2026-11-23 | A1 → A0 |
| Chrome for Testing (Puppeteer, Revideo) | 157.0.8103.78 | Binario de Google | Descarga local; no se redistribuye | 2026-11-23 | A1 → A0 |
| Blender | 5.2.3 LTS (build e13b728c6880) | GPL | Proceso separado (`blender -b -P`); no se redistribuye ni se modifica | 2026-11-23 | C1 → A0 |
| FFmpeg (sistema, winget Gyan) | 9.0.2 full_build | GPL (build *full* con `--enable-gpl`; POR VALIDAR en FDN-016) | Proceso separado; no se redistribuye | 2026-11-23 | A0 |

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
