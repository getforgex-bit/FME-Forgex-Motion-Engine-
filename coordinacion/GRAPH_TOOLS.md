# Graphify y CodeGraph

> Verificado el 2026-11-22: **Graphify 0.9.115** (`C:\Users\bogex\.local\bin\graphify`) y **CodeGraph 1.6.4** (`C:\Users\bogex\AppData\Local\codegraph\current\bin\codegraph`), ambos en el PATH.
> Las respuestas de los grafos son **ayudas de navegación, no pruebas**: contrasta lo importante con el código y los tests.

## Cuál usar

| Pregunta | Herramienta | Comando |
|---|---|---|
| ¿Dónde está X? ¿Qué hace? (símbolo) | CodeGraph | `codegraph explore "X"` · `codegraph node X` |
| ¿Quién llama a X? | CodeGraph | `codegraph callers X` |
| ¿Qué rompo si cambio X? | CodeGraph | `codegraph impact X` |
| ¿Qué tests afecta mi diff? | CodeGraph | `codegraph affected <archivos>` |
| Contexto para empezar una tarea | CodeGraph | `codegraph context "FDN-xxx: <descripción>"` |
| ¿Cuáles son los subsistemas? ¿Qué está acoplado? | Graphify | `graphify query "<pregunta>"` · `graphify god-nodes` |
| ¿Cómo se relaciona A con B? | Graphify | `graphify path "A" "B"` |
| Explicación de un nodo y sus vecinos | Graphify | `graphify explain "X"` |
| ¿Qué se ve afectado (a nivel arquitectónico)? | Graphify | `graphify affected "X"` |
| Leer una sección de un `.md` | Graphify | `graphify section "docs/arquitectura.md#3. Enrutador inteligente"` (si el nodo existe) o leer el archivo directamente |

En tareas triviales no consultes ninguna de las dos. Hoy el código es pequeño (tipos y `coord.mjs`), así que su valor es bajo; crecerá desde la Fase 2.

Diferencias con la referencia del prompt maestro: en Graphify 0.9.115, `extract` usa LLM (no tiene `--code-only`); la extracción local sin LLM es `graphify update .`.

## Protocolo antes de modificar código

1. Objetivo técnico en una frase.
2. `codegraph context` o `explore` para localizar el código.
3. Graphify solo si necesitas relaciones amplias.
4. Leer **solo** los archivos necesarios.
5. Comprobar contratos (`docs/contratos.md`) y dependencias.
6. Planificar un cambio acotado a las rutas de la ficha.
7. Implementar.
8. `npm run typecheck` y `npm test`, más las pruebas de la ficha.
9. Después: `codegraph affected` sobre tus archivos.
10. `codegraph sync` y, si cambió la estructura, `graphify update .`.

## Política de índices

- **Un índice por worktree.** `.codegraph/` y `graphify-out/` están en `.gitignore`. No se versionan, no se copian entre worktrees y no se mezclan ramas.
- **CodeGraph:** en un worktree nuevo, `codegraph init` (una vez). Después, `codegraph sync`, que es incremental. `codegraph index` (reconstrucción completa) solo si `status` avisa de un motor antiguo o el índice está corrupto. Antes de `init`, comprueba `codegraph status`: si hay un índice válido, no ejecutes `init`.
- **Graphify:** `graphify update .` (AST, sin LLM ni API de pago). **No** uses `extract` ni `label` salvo un ADR (necesitan un LLM o una clave). No hagas una reconstrucción completa sin necesidad: `update` usa caché.
- **Contexto:** nunca cargues `graph.json` ni `graph.html` en el contexto del agente; usa solo las salidas de `query`, `explain`, `path` o `affected`. Para respuestas largas, `--budget` (Graphify).
- **Caché de contexto:** los índices no se versionan, así que regenerarlos no cambia los archivos que leen los agentes.
- Los hooks automáticos (`graphify hook install`, `graphify claude install`…) **no** se instalan sin un ADR: duplicarían instrucciones en AGENTS.md o CLAUDE.md.

## Recuperación

| Síntoma | Acción |
|---|---|
| `graphify: command not found` | `uv tool update-shell`, reabrir la terminal y comprobar `uv tool list`. Solo si falta: `uv tool install graphifyy` |
| `codegraph` no responde o está bloqueado | `codegraph unlock`, después `codegraph status` |
| Índice de CodeGraph de otro motor | `codegraph index` en ese worktree |
| Graphify sin PDF | Falta `pypdf`; no es necesario (`docs/` es la versión navegable de la spec) |

## Medición

Cada informe REVIEW anota el número de consultas de cada herramienta y una estimación de las lecturas evitadas. A0 lo agrega en [AGENT_PERFORMANCE.md](AGENT_PERFORMANCE.md). **No se afirma ningún porcentaje de ahorro sin medirlo.** `graphify benchmark` puede dar una estimación de tokens del grafo frente al corpus.
