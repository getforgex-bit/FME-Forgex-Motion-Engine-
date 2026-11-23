# «Continúa»: procedimiento de reanudación

> Cuando el usuario escribe solo **«Continúa»**, haz esto, en este orden, sin pedirle más contexto. **No** reconstruyas el plan, **no** reinvestigues decisiones con ADR y **no** repitas trabajo DONE.

## Para cualquier equipo (A0, B0 Neon, C0 Sol y trabajadores)

1. **Ubícate.** Tu worktree es el de [MASTER_PLAN.md](MASTER_PLAN.md#rutas-reales). `cd` a él.
2. **Git:** `git status`, `git branch --show-current` y `git log --oneline -3`. Si hay cambios sin confirmar, son tuyos: termínalos o anótalos.
3. Lee **este archivo** (ya lo estás haciendo).
4. Lee tu estado vivo: `C:\Users\bogex\Documents\Forgex\FME-ops\estado\<claude|antigravity|codex>.md`. Si no existe, créalo con la plantilla de abajo.
5. Lee [CURRENT_SPRINT.md](CURRENT_SPRINT.md) **de `develop`**: `git show develop:coordinacion/CURRENT_SPRINT.md` (tu rama puede tener una copia antigua). Si hace falta una ficha: `git show develop:coordinacion/BACKLOG.md`.
6. Mensajes: `$env:FME_SESION="<tu id>"; node scripts/coord.mjs buzon` y `node scripts/coord.mjs estado` (incluye la tabla de **equipos**: activo, sospechoso o caído).
   - **Si vuelves después de quedarte sin cuota** (o hay un `traspaso` «Reincorporación» o «RELEVO» para tu equipo): sigue primero [§Relevo](#relevo-si-un-equipo-se-queda-sin-cuota-adr-0013).
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

## Relevo: si un equipo se queda sin cuota (ADR-0013)

- **Detección:** `node scripts/coord.mjs equipos` marca **sospechoso** a un equipo con trabajo activo y sin latido en 60 min. Es solo un aviso: **solo el usuario** declara un equipo caído.
- **Equipo caído (A0, con la cita literal del usuario):**
  1. `caida --equipo <x> --cita "<…>"` guarda el acta en `FME-ops/relevos/` (puntas de rama, worktrees, cambios sin commit con su `.patch`, reclamos). No toca nada del caído.
  2. A0 **propone** al usuario qué equipo releva cada tarea.
  3. Con su «sí»: `relevar --tarea FDN-xxx --de <x> --a <y> --cita "<…>"`. Libera los reclamos de esa tarea y envía un `traspaso` al relevista.
- **Relevista:**
  - `git switch -c <rama-del-caído>-relevo-<tu equipo> <punta del acta>` (nunca su rama ni su worktree);
  - aplica el `.patch` del acta si lo hay;
  - reclama las rutas y **termina la tarea hasta DONE**.
- **Reincorporación** (cuando el usuario indica que el equipo tiene cuota otra vez):
  1. A0 ejecuta `reincorporar --equipo <x>`.
  2. El equipo que vuelve lee la nota (`FME-ops/relevos/*-reincorporacion.md`).
  3. Compara su worktree con el acta (punta y cambios sin commit). Si difiere, avisa a A0 antes de tocar nada.
  4. **No continúa** las tareas relevadas; envía al relevista lo que tuviera sin commit sobre ellas.
  5. Hace `git merge develop` en sus ramas no relevadas y toma tareas READY.
- **Si se queda sin cuota A0:**
  - la integración en `develop` se **pausa**;
  - los demás siguen en sus ramas y acumulan REVIEW;
  - el **usuario elige** un integrador suplente (una sesión Sol, Neon o Astra en Codex), que se registra como `<herramienta>-integrador-suplente` y sigue [INTEGRATION.md](INTEGRATION.md#integrador-suplente-adr-0013);
  - cuando A0 vuelve, revisa todas las fusiones del suplente.

## Pasos adicionales de A0 (director e integrador)

- 0. `node scripts/coord.mjs equipos`. Si un equipo sale **sospechoso**, avisa al usuario y pregúntale si está caído; no lo declares por tu cuenta.
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
