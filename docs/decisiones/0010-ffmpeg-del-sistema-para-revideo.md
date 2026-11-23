# ADR-0010: Revideo usa el FFmpeg del sistema, no el binario empaquetado

- **Estado:** propuesta (2026-11-23) · **Dueño:** A1 → A0 · **Revisable:** al implementar FDN-032 o antes de cualquier distribución

## Contexto

FDN-010 detectó que `@revideo/ffmpeg` arrastra `@ffmpeg-installer/ffmpeg` y `@ffprobe-installer/ffprobe`, cuyo binario de Windows (`win32-x64` 4.1.0) es **FFmpeg N-92722 de 2018, GPLv3**, además de `fluent-ffmpeg` 2.1.3 (deprecada) y un aviso `npm audit` *high* en `vite 8.1.2`. FDN-016 comprueba si hay alternativa.

## Evidencia (FDN-016, `examples/fase1/revideo`, Windows 11, Node 24.21.0)

- Revideo **admite ruta configurable**: `settings.ffmpeg.{ffmpegPath, ffprobePath}` en `renderVideo`, y las variables de entorno `FFMPEG_PATH` / `FFPROBE_PATH` (`node_modules/@revideo/ffmpeg/dist/settings.js`, `renderer-plugin.js:64-67`).
- Con el FFmpeg del sistema (`ffmpeg 9.0.2-full_build`, gyan.dev vía winget, `Lavf63.1.102`) `npm run verify` da **ACEPTACIÓN OK**: MP4 h264 de 90 fotogramas a 30/1 y MOV ProRes `yuva444p12le` de 90 fotogramas con alpha (0–255). SHA-256 MP4 `9c7690cd1240dadbc58942127f506b811ab870a996f4d00d68663e9c3984cce0`, MOV `0e0e1affc68c6507a4605892f6380d0c47751de448e07f357b1446ce16a8d8a4` (distintos a los de FDN-010 porque cambia el codificador; idénticos en 2 ejecuciones).
- **Incompatibilidad hallada:** con FFmpeg ≥ 7/9, `ffmpeg -formats` añade una 3.ª columna de flags (`d` = dispositivo) y `fluent-ffmpeg` 2.1.3 ya no reconoce `lavfi`; el render falla al crear el audio silencioso (`Input format lavfi is not available`). Solución en el repo: `ffmpeg-compat.mjs` sustituye `availableFormats` por un parser de 3 flags (acepta también la salida antigua de 2). Sin el parche, no funciona.
- **Licencia del binario del sistema:** `ffmpeg -version` muestra `--enable-gpl --enable-version3` (+ libx264, libx265): **también GPLv3**. El cambio no elimina la licencia GPL: cambia **quién distribuye el binario** (el usuario lo instala; FME no lo redistribuye) y sustituye un binario de 2018 por uno de 2026.
- `vite 8.3.8` (instalado con confirmación del usuario) deja `npm audit` en **0 vulnerabilidades** y el render sigue en verde.
- Los paquetes `@ffmpeg-installer/*` siguen instalándose (son dependencias duras de `@revideo/ffmpeg`) pero **ya no se ejecutan**. Quitarlos del árbol requeriría `overrides` y no se probó.

## Decisión (propuesta)

1. El adaptador Revideo (FDN-032) **debe** pasar `ffmpegPath`/`ffprobePath` explícitos de un FFmpeg del sistema o de una ruta configurada por FME, y **fallar con un diagnóstico claro** si no existe. Nunca recurrir al binario de `@ffmpeg-installer`.
2. FME **no empaqueta ni redistribuye** FFmpeg. Si algún día se distribuye un instalador, se decide entonces entre un build LGPL (sin `--enable-gpl`; no probado con Revideo, necesitaría H.264 por otra vía) o cumplir GPL; requiere ADR y auditoría (`docs/licencias-seguridad.md`).
3. El parche `ffmpeg-compat.mjs` pasa a ser parte del adaptador mientras Revideo use `fluent-ffmpeg` 2.1.3.
4. `vite` se fija en 8.3.8 (exacta) o superior.

## Alternativas descartadas
- Mantener el binario de 2018: GPLv3, obsoleto, y no resuelve la redistribución.
- Esperar a que `@revideo/ffmpeg` lo arregle: `fluent-ffmpeg` no tiene mantenedor.

## Consecuencias / riesgos abiertos
- Dependencia de la instalación de FFmpeg de la máquina; se mitiga verificando versión y capacidades al registrar el conector.
- Probado solo con ffmpeg 9.0.2 gyan «full»; **no probado** un build LGPL ni versiones 6/7.
- El parche accede a `fluent-ffmpeg` como dependencia hoisted: es frágil ante cambios de `@revideo/ffmpeg`.
