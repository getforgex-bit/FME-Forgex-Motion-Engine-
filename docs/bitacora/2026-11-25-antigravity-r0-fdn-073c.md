# 2026-11-25 · FDN-073c · Relevo y verificación de referencia de regresión Revideo

- **Autor:** `antigravity-relevo` (`revideo-baseline`) · **Sesión:** `antigravity-r0` · **Relevo de:** `codex` (`codex-c1-r9`)
- **Punta origen:** `1cbb1a0` (`fdn/FDN-073c-baseline-revideo`, sobre `c6e845c`)
- **Worktree / Rama:** `C:\Users\bogex\Documents\Forgex\FME-wt\antigravity-relevo-073c` · `fdn/FDN-073c-baseline-revideo-relevo-antigravity-relevo`
- **Base integrada:** `develop` @ `abbb646` (`git merge develop --no-edit`, limpio sin conflictos)
- **Estado:** **VERIFICADO** (pendiente de revisión independiente e integración por A0)

## Objetivo

Completar el relevo de **FDN-073c** verificando sobre `develop` actual que la referencia de regresión de Revideo (`tests/regresion/expected/revideo.json`) contiene exactamente la huella aprobada visualmente por A0 y que la suite completa de regresión audiovisual (`tests/regresion/render.test.ts`) pasa 3/3 con los motores reales (Blender, Revideo y FreeCut) sin omisiones.

## Hecho

- Creación de worktree y rama exclusivos desde la punta del acta de Codex `1cbb1a0` (`c6e845c` evidencia PNG + bitácora de candidato y `1cbb1a0` actualización de `tests/regresion/expected/revideo.json`), sin modificar el checkout principal ni ramas/worktrees de Codex.
- Integración limpia de `develop` (`abbb646`) mediante `git merge develop --no-edit`.
- Comprobación del archivo `tests/regresion/expected/revideo.json`:
  - `engineVersion`: `"0.11.0"`
  - `contentSha256` anterior en `develop`: `7b604063831bf04028568de7312a8d1df71351881331afa37a972d9c3934f359` (fotograma vacío previo a `cb2d404`, evidencia `docs/bitacora/evidencia/fdn-073c/before-frame-0000.png`).
  - `contentSha256` actualizado y aprobado visualmente por A0: `2e8e4a9d68923adb31ef02d05e6e55abe617271be416c3b983631084d260e0a0` (figura naranja sobre fondo azul oscuro de `cb2d404`, evidencia `docs/bitacora/evidencia/fdn-073c/after-frame-0000.png`).
- Preparación local de dependencias ignoradas por git (`node_modules/` en raíz y en `runtime/engines/revideo/`) con `npm.cmd ci --prefer-offline --no-audit --no-fund`, sin alterar `package.json` ni `package-lock.json`.

## Verificado

| Comando | Resultado real |
|---|---|
| `npm.cmd ci --prefer-offline --no-audit --no-fund` (raíz del worktree) | Exit `0` (`added 112 packages in 5s`). |
| `npm.cmd ci --prefer-offline --no-audit --no-fund` (`runtime/engines/revideo`) | Exit `0` (`added 128 packages in 21s`). |
| `npm.cmd run typecheck` (`tsc -b && tsc -p tsconfig.test.json`) | Exit `0` (sin errores). |
| `node --test tests/regresion/render.test.ts` | Exit `0` — `tests 3`, `suites 0`, `pass 3`, `fail 0`, `cancelled 0`, `skipped 0`, `todo 0`, `duration_ms 30423.6758`. |
| `git diff --check develop...HEAD` | Exit `0` (limpio). |
| `git diff --name-only develop...HEAD` | Solo rutas autorizadas: `tests/regresion/expected/revideo.json`, `docs/bitacora/2026-11-25-codex-c1-r9-fdn-073c.md`, `docs/bitacora/evidencia/fdn-073c/{before,after}-frame-0000.png` y esta bitácora. |

Detalle exacto de `node --test tests/regresion/render.test.ts`:

- `✔ Blender · PNG RGBA y un cambio deliberado de cámara rompe el baseline (13450.0423ms)` (`ℹ La órbita de cámara +30° fue rechazada por el comparador.`)
- `✔ Revideo · MP4 de una ilustración SVG fija (9204.4347ms)`
- `✔ FreeCut · MP4 de una pista de vídeo sintético (7329.5045ms)`

## Decisiones tomadas

- Ninguna decisión arquitectónica nueva; se mantiene íntegra la huella visual aprobada previamente por A0 (`2e8e4a9d68923adb31ef02d05e6e55abe617271be416c3b983631084d260e0a0`) y las evidencias heredadas de `c6e845c` / `1cbb1a0`.

## Pendiente / próxima acción

- Revisión independiente por `@verifier` y envío de `REVIEW` / integración en `develop` por coordinación (A0).

## Memoria actualizada

- Sin cambios en `.forgex/memory.jsonl` (fuera de rutas autorizadas de la ficha).
