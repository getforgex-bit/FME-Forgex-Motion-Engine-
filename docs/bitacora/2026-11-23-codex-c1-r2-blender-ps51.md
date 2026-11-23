# 2026-11-23 · FDN-015 · Blender en Windows PowerShell 5.1

- **Sesión:** `codex-c1-r2`.
- **Rama:** `fdn/FDN-015-ps51`.

## Hecho

- La expresión de RAM en el hashtable del informe usa `$(if ...)`, compatible con Windows PowerShell 5.1.
- El lanzador conserva el identificador de Blender antes de esperar su salida. Al probar únicamente el cambio de sintaxis, PowerShell 5.1 produjo 90 PNG pero devolvió un `ExitCode` vacío. Una prueba aislada que salió con código 7 confirmó que conservar el identificador mantiene disponible el código real.
- Actualicé los comandos en [RESULTADOS](../../examples/fase1/blender/RESULTADOS.md) para las dos versiones de PowerShell.

## Verificado

| Comando | Resultado |
|---|---|
| `powershell -NoProfile -ExecutionPolicy Bypass -File examples/fase1/blender/run.ps1 -RunName fdn015-ps51-final` | Windows PowerShell 5.1.26100.9711, código 0, 90 PNG RGBA 960 × 540 y alpha 0/255. |
| `pwsh -NoProfile -File examples/fase1/blender/run.ps1 -RunName fdn015-ps7-final` | PowerShell 7.6.9, código 0, mismos formato, dimensiones y transparencia. |
| `ffmpeg -c:v rawvideo -pix_fmt rgba -f hash -hash sha256` | Ambas corridas conservaron el SHA-256 de píxeles de FDN-011, `c9706f102905154468b84ca85189eb339e4128eebcce7946e64d61cfa96c450b`. |
| `npm run typecheck` y `npm test` | Tipos correctos y 30/30 pruebas tras restaurar Zod 4.6.7 desde la caché local, sin modificar el lock. |
| `codegraph sync` y `codegraph affected examples/fase1/blender/run.ps1` | Índice al día. Ninguna prueba del repo aparece afectada. |

## Pendiente

- Revisión e integración de A0. El equipo Codex retoma FDN-031 en su rama.
