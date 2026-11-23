# 2026-11-23 · FDN-073a · Seguridad y regresión

- **Sesión** `codex-c0-r7` · **Rama** `fdn/FDN-073a-seguridad-regresion`
- **Base** `69a1f44` · **C1** `d224793` (controles defensivos) · **C2** `6aff255` (referencias de contenido)

## Hecho

- Añadimos siete pruebas defensivas para el worker, los adaptadores y MCP. Los casos usan archivos temporales e inputs inocuos.
- Registramos referencias de contenido de trabajos fijos de Blender, Revideo y FreeCut. La prueba usa `contentSha256` del adaptador cuando está disponible. Revideo compara el SHA-256 de su vídeo decodificado a YUV420p mediante FFmpeg.
- La regeneración documentada imprime candidatos para revisión. Las referencias versionadas se actualizan tras revisión de A0.

## Verificado

| Comando | Resultado |
|---|---|
| `npm run typecheck` | OK. Los enlaces del worktree se restauraron offline. |
| `tsc --noEmit --target ES2022 --module NodeNext --strict --exactOptionalPropertyTypes --noUncheckedIndexedAccess --allowImportingTsExtensions --types node --skipLibCheck tests/seguridad/limits.test.ts tests/regresion/render.test.ts` | OK. |
| `node --test "tests/seguridad/*.test.ts" "tests/regresion/*.test.ts"` | 10 pasan, 0 fallos, 0 skips, 3 TODO. Se ejecutaron los tres motores locales. Revideo se configuró con las rutas del motor y caché de Chromium ya instalados en el worktree de A1. |
| Cambio de cámara en Blender | La órbita +30° con las demás entradas fijas produjo `contentSha256 cambió`. El test comprueba el rechazo del resultado. |
| Regresión sin motores | C2 configuró rutas inexistentes y obtuvo tres skips con motivo, 0 fallos. |
| `git diff --check` | Correcto. |

CodeGraph identificó las entradas de pruebas y sus controles de proyecto. Graphify mostró la conexión entre el adaptador Blender y `runIsolated`, además del nodo de procedencia.

## Pendiente

- A0 incorpora los globs de las suites a `npm test`.
- Los tres TODO de la suite de seguridad documentan ámbitos pendientes de producción: raíz configurable de CLI, raíz de anfitrión para llamadas directas a Revideo y FreeCut, y raíces permitidas de `edit.compose` para entradas absolutas. C0 solicitó a A0 que defina el alcance de esos controles.
