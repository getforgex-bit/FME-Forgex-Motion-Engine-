# AGENTS.md: Forgex Motion Engine (FME)

> Idioma del proyecto: **español** (los identificadores de código, en inglés).
> Aplica a personas y a agentes IA (Claude Code, Codex, Antigravity, Claude Desktop).

## Qué hay aquí

FME es un motor audiovisual procedural, modular y AI-first que **integra** herramientas existentes (FreeCut, Revideo, Blender…) mediante un proyecto universal con timeline, conectores y un enrutador. Estado: **Fase 0 cerrada; siguiente, la Fase 1** (ver `STATUS.md`).

- Spec (fuente de verdad): `docs/especificacion/FME-Especificacion-Integral-v0.1.pdf`. Versión navegable: `docs/`.
- Roadmap: `docs/roadmap.md` · Contratos: `docs/contratos.md` · Decisiones: `docs/decisiones/`.

## Antes de trabajar
1. Lee `STATUS.md` y la última entrada de `docs/bitacora/`.
2. Busca en la memoria el tema de la tarea (bloque FORGEX Stack más abajo).
3. Comprueba el estado real: `git status`, `git log -5` y `npm run typecheck`.

## Reglas
1. **Alcance congelado (spec v0.1).** No añadas integraciones ni capacidades fuera del catálogo sin un ADR aprobado por el usuario.
2. **Integrar antes que forkear.** Orden ante una carencia: configuración → API/plugin → adaptador → fork (ADR).
3. **Verdad.** No inventes resultados. Distingue *ACORDADO / PROPUESTO / POR VALIDAR / VERIFICADO* y cita el comando ejecutado. Nada se declara construido sin superar su prueba.
4. **Contratos.** Cambiar `packages/project` o `packages/connectors` es un cambio de contrato: requiere ADR, actualizar `docs/contratos.md` y, si cambia el formato persistido, subir `schemaVersion` con su migración.
5. **Proyecto universal independiente:** su esquema no depende de campos internos de FreeCut, Revideo ni Blender.
6. **Seguridad:** nada de ejecutar código del agente con acceso irrestricto. Los adaptadores usan directorios aislados, rutas validadas, timeouts y confirmación para operaciones destructivas. Nunca versiones secretos.
7. **Licencias:** antes de fijar o redistribuir una dependencia, regístrala en `docs/licencias-seguridad.md`. GitNexus es no comercial (ADR-0003).
8. **Ramas:** troncal `develop` (propuesta); `main` solo con aprobación del usuario. Ramas de trabajo `feat/<slug>`, `fix/<slug>`, `docs/<slug>` o las que asigne la sesión. Nada de `--force` ni de reescribir historia publicada.
9. **Commits:** Conventional Commits en español (`feat(project): …`, `docs(roadmap): …`), pequeños y descriptivos.

## Al terminar una tarea (registro común)
- Actualiza `docs/bitacora/AAAA-MM-DD-tema.md` (hecho / verificado / pendiente).
- Si decidiste algo duradero: ADR + entidad `decision` en la memoria + fila en `STATUS.md`.
- Si cambió el comportamiento: `CHANGELOG.md` → `[Unreleased]`.
- Si avanzó una fase: marca ☑ en `docs/roadmap.md` y `docs/pruebas-aceptacion.md` **con evidencia**.
- Detalle: `docs/memoria-y-registro.md`.


<!-- forgex:start -->
## FORGEX Stack: cómo trabajar en este proyecto (agentes IA)

Tienes **un** servidor MCP, `forgex` (pctx en *Code Mode*), con 3 herramientas: `list_functions`, `get_function_details` y `execute_typescript`. Detrás están:
- **`Gitnexus`**: grafo de conocimiento del código (símbolos, llamadas, flujos, impacto).
- **`Memory`**: memoria persistente del proyecto (decisiones, convenciones, tareas), guardada en `.forgex/memory.jsonl`, que se versiona.

### Reglas para ahorrar tokens
1. **No llames a `list_functions` sin filtrar** (unos 12k tokens). Usa esta chuleta y pide solo lo que necesites con `get_function_details({ functions: ["Gitnexus.impact"] })`.
2. Encadena las llamadas en **un solo** `execute_typescript` y devuelve **solo** el resumen que necesitas, no los resultados crudos.
3. El código es TypeScript con `async function run() { … return … }`. Se comprueban los tipos antes de ejecutar.
4. Si tienes terminal, la CLI de GitNexus no cuesta tokens de contexto: `gitnexus query "<concepto>"`, `gitnexus context <símbolo>`, `gitnexus impact <símbolo> --direction upstream`, `gitnexus detect-changes`.

### Chuleta (nombres reales)
- `Gitnexus.query({ search_query, limit?, repo? })`: flujos y símbolos relacionados con un concepto.
- `Gitnexus.context({ name | uid | file_path, repo? })`: vista de 360° de un símbolo (quién lo llama, a quién llama, procesos).
- `Gitnexus.impact({ target, direction: "upstream" | "downstream", maxDepth?, repo? })`: qué se rompe si cambias algo.
- `Gitnexus.detectChanges({ scope?, base_ref?, repo? })`: mapea el diff de git a símbolos y flujos afectados.
- `Gitnexus.trace`, `Gitnexus.cypher` y `Gitnexus.listRepos` también existen (consulta su firma con `get_function_details`).
- `Memory.searchNodes({ query })`, `Memory.openNodes({ names })` y `Memory.readGraph()`: consultar.
- `Memory.createEntities({ entities: [{ name, entityType, observations }] })`, `Memory.addObservations({ observations: [{ entityName, contents }] })` y `Memory.createRelations({ relations: [{ from, to, relationType }] })`: guardar.

### Flujo de trabajo
1. **Al empezar:** `Memory.searchNodes` con el tema de la tarea, para recuperar decisiones y convenciones previas.
2. **Antes de editar:** `Gitnexus.context` y `Gitnexus.impact` sobre los símbolos que vas a tocar.
3. **Antes de hacer commit:** `gitnexus detect-changes` (o `Gitnexus.detectChanges`) para revisar el impacto real del diff.
4. **Al terminar:** guarda en `Memory` las decisiones, convenciones o descubrimientos que valga la pena recordar. Usa entidades con `entityType` `decision`, `convention`, `task` o `gotcha` y observaciones breves y verificables.
5. Si el índice está desactualizado, ejecuta `gitnexus analyze --skip-agents-md --skip-skills` (es incremental).
<!-- forgex:end -->
