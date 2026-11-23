# 2026-11-23 · FDN-031 · Ejecución aislada de procesos

- **Sesión:** `codex-c1-r2` (GPT-6.2 Sol).
- **Rama:** `fdn/FDN-031-workers`.

## Hecho

- Añadí `@fme/runtime-workers`, su referencia de TypeScript y `runIsolated`, con un directorio por trabajo, entorno explícito, ejecución sin shell y archivos separados para stdout y stderr.
- El worker comprueba rutas declaradas contra la lista de rutas canónicas, rechaza traversal y enlaces y registra el resultado en `.fme-worker/worker.json`. En Windows usa `taskkill /PID /T /F` cuando vence el timeout. Un fallo al lanzar o terminar se registra en el diagnóstico.
- Documenté el formato de los argumentos y el alcance en el [README](../../runtime/workers/README.md). El adaptador decide qué código, herramienta y opciones son de confianza y el proceso conserva los permisos de la cuenta anfitriona.

## Verificado

| Comando | Resultado |
|---|---|
| `npm run typecheck` | Compilación correcta, incluido el workspace del worker. |
| `npm test` | 30/30 pruebas de la raíz. |
| `npm --workspace @fme/runtime-workers test` | 5/5 pruebas con Node 24.21.0 en Windows 11. Código 7 conservado, `&` literal, entorno del padre ausente, salida y logs separados, rutas y junctions rechazadas, y fallo de spawn registrado. |
| Prueba de timeout de la suite del worker | Con 2500 ms de timeout se crearon tres procesos reales. Los tres PID dejaron de existir tras la terminación. |
| `codegraph sync` y `codegraph affected` | Índice al día. Detectó `runtime/workers/test/worker.test.ts`. |
| `git diff --check` | Correcto. |
| `gitnexus detect-changes --repo <worktree> --scope all` | FME no está en el índice local de GitNexus. |

La consulta inicial de CodeGraph devolvió el contrato de conectores y confirmó que `runIsolated` era nuevo. La implementación pertenece al runtime y conserva el contrato de conectores. Graphify no se usó porque los adaptadores todavía no dependen del worker.

## Pendiente

- A0 debe regenerar `package-lock.json` al integrar la nueva declaración de workspace. La ficha asigna `package.json` y `tsconfig.json` en la raíz. C0 comprobó en un temporal que `npm ci --dry-run --offline --ignore-scripts` requiere la entrada y pasa con el lock regenerado.
- FDN-032 y FDN-040 pueden consumir el worker tras su integración, cuando sus demás dependencias estén disponibles.
