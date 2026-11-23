# «Continúa»: procedimiento de reanudación

> Cuando el usuario escribe solo **«Continúa»**, haz esto, en este orden, sin pedirle más contexto. **No** reconstruyas el plan, **no** reinvestigues decisiones con ADR y **no** repitas trabajo DONE.

## Para cualquier equipo (A0, B0 Neon, C0 Sol y trabajadores)

1. **Ubícate.** Tu worktree es el de [MASTER_PLAN.md](MASTER_PLAN.md#rutas-reales). `cd` a él.
2. **Git:** `git status`, `git branch --show-current` y `git log --oneline -3`. Si hay cambios sin confirmar, son tuyos: termínalos o anótalos.
3. Lee **este archivo** (ya lo estás haciendo).
4. Lee tu estado vivo: `C:\Users\bogex\Documents\Forgex\FME-ops\estado\<claude|antigravity|codex>.md`. Si no existe, créalo con la plantilla de abajo.
5. Lee [CURRENT_SPRINT.md](CURRENT_SPRINT.md) **de `develop`**: `git show develop:coordinacion/CURRENT_SPRINT.md` (tu rama puede tener una copia antigua). Si hace falta una ficha: `git show develop:coordinacion/BACKLOG.md`.
6. Mensajes: `$env:FME_SESION="<tu id>"; node scripts/coord.mjs buzon` y `node scripts/coord.mjs estado`.
7. Solo si la siguiente acción toca código: CodeGraph o Graphify según [GRAPH_TOOLS.md](GRAPH_TOOLS.md).
8. **Elige la siguiente acción útil**, por prioridad:
   1. responder a un mensaje bloqueante;
   2. terminar lo que está IN_PROGRESS;
   3. corregir una tarea devuelta por A0;
   4. tomar una tarea READY de tu equipo;
   5. tomar una READY sin asignar (con evento TOMADA; A0 la confirma).
9. **Ejecuta** o delega en tus trabajadores. Si hay varias tareas READY independientes, en paralelo.
10. **Verifica** con las pruebas de la ficha y cita el comando y el resultado.
11. **Registra:** evento a `claude-code-a0` (TOMADA, REVIEW o BLOQUEO), bitácora y `avance`.
12. **Prepara el siguiente «Continúa»:** actualiza `FME-ops/estado/<equipo>.md` con el siguiente paso **exacto**.

Encadena tareas mientras haya permisos, tiempo y cuota. Detente solo si:
- necesitas al usuario (descarga, acción destructiva, decisión de alcance);
- falta información;
- hay un riesgo importante;
- alcanzas un límite.

Si todo está bloqueado, informa **qué dependencia** lo impide.

## Pasos adicionales de A0 (director e integrador)

- A. Integra cada rama con evento REVIEW, según [INTEGRATION.md](INTEGRATION.md#revisión-de-a0-por-cada-evento-review).
- B. Consolida en `develop`: BACKLOG, CURRENT_SPRINT, TEAM_STATUS y AGENT_PERFORMANCE. Recalcula qué pasa a READY ([DEPENDENCY_GRAPH.md](DEPENDENCY_GRAPH.md)) y asígnalo.
- C. Sesiones Claude: consulta las sesiones vinculadas (A1, A2 y A3) y reanúdalas con un `SendMessage` corto (ID de tarea + «lee tu ficha»), o crea una nueva si la anterior terminó.
- D. Al cerrar una fase: STATUS, roadmap, pruebas de aceptación y CHANGELOG, con evidencia.
- E. Deja `FME-ops/estado/claude.md` con el siguiente paso exacto.

## Plantilla de `FME-ops/estado/<equipo>.md`

```
---
equipo: codex
actualizado: <ISO>
---
## En curso
- FDN-xxx · worktree … · rama … · paso actual: …
## Siguiente paso exacto
- …
## Bloqueos
- (ninguno)
## Esperando de otros
- …
```
