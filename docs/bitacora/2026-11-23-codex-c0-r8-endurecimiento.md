# FDN-073b · Endurecimiento de rutas

Sesión `codex-c0-r8` con dos trabajadores GPT-6.2 Sol. Iniciada el 23 y verificada el 25 de noviembre de 2026. Rama `fdn/FDN-073b-endurecimiento`, base `dccf7cf`.

## Hecho

- C1 incorporó `--root` optativo a la CLI. Reutiliza la resolución de MCP y valida rutas de proyectos, activos consumidos por la exportación y destinos. Resuelve destinos nuevos a partir de su ancestro existente.
- C2 incorporó `allowedRoots` en Revideo y FreeCut para llamadas directas. Se valida proyecto y `workDir` antes de preparar el job. FreeCut también valida los medios de `edit.compose`, incluidas las entradas por capa, pistas de audio y prefijos de secuencia.
- C0 convirtió los tres TODO de FDN-073a en pruebas con archivos temporales. Hay controles positivos, rutas vecinas y enlaces de directorio.
- La base incluye el reintento FDN-074b. Antigravity confirmó la liberación de `adapter.ts` antes de editar.

## Verificado

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | Correcto |
| `node --test tests/seguridad/limits.test.ts` | 10 pasaron, 0 fallos, 0 TODO |
| `npm test` | 230 pasaron, 15 omitidas, 0 fallos, 0 TODO. Ejecutó Blender y FreeCut reales. El entorno de esta corrida carecía de Revideo en su ruta predeterminada. |
| `codegraph sync` y `codegraph affected` | Índice al día. Se identificaron 26 archivos afectados. |
| `git diff --check` | Correcto |

## Pendiente

- Integración por A0. El baseline de Revideo se gestiona en FDN-073c.
- La raíz configurable presupone directorios controlados por el anfitrión. La sonda de versión de Blender durante `project export` usa el directorio temporal del sistema.
- Windows bloqueó el ejecutable de Graphify mediante Control de aplicaciones. El repositorio consta en CodeGraph y carece de índice registrado en GitNexus.
