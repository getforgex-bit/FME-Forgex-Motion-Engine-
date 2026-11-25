# Integración: ramas, worktrees y revisión

## Ramas

| Rama | Uso | Quién escribe |
|---|---|---|
| `main` | Protegida. Solo con aprobación explícita del usuario | Nadie, por ahora |
| `develop` | Troncal de integración (local) | **Solo A0**, mediante `merge --no-ff` |
| `fdn/FDN-xxx-slug` | Una por tarea, creada desde `develop` | El equipo de la tarea |

Los worktrees comparten el mismo `.git`: una rama confirmada en cualquier worktree se ve al momento en todos, **sin push**. **No se hace push al remoto** sin autorización del usuario.

## Empezar una tarea en un worktree existente

```powershell
cd C:\Users\bogex\Documents\Forgex\FME-wt\codex
git status                      # debe estar limpio
git switch -c fdn/FDN-031-workers develop
```

Si el worktree tiene trabajo sin confirmar de otra tarea, no cambies de rama: usa el otro worktree del equipo o crea uno nuevo con `git worktree add C:\Users\bogex\Documents\Forgex\FME-wt\<equipo>-<n> -b fdn/FDN-xxx-slug develop` y avisa a A0 con un evento.

## Revisión de A0 (por cada evento REVIEW)

1. `git log develop..fdn/FDN-xxx --oneline` y `git diff develop...fdn/FDN-xxx --stat`: solo rutas autorizadas.
2. Impacto: `codegraph affected <archivos>` e `impact <símbolo>` en el worktree de integración; `graphify path` o `affected` si cambian relaciones entre paquetes.
3. `git merge --no-ff --no-commit fdn/FDN-xxx` en `develop` → `npm ci` (si cambió el lockfile) → `npm run typecheck` → `npm test` → pruebas propias de la ficha.
4. Si todo está en verde: commit de fusión `merge: FDN-xxx <título>`; re-exportaciones en `index.ts` si aplica; actualizar BACKLOG, CURRENT_SPRINT, TEAM_STATUS y AGENT_PERFORMANCE; mensaje `respuesta` al equipo.
5. Si algo falla: `git merge --abort` y mensaje `respuesta` con el fallo exacto (comando y salida). La tarea vuelve a IN_PROGRESS.

## Después de cada integración

Los equipos incorporan `develop` en su siguiente rama (la crean desde `develop`) o, si siguen en una tarea larga, hacen `git merge develop` en ella. Nunca rebase de ramas que otro equipo ya ha visto.

## Archivos compartidos (solo A0)

`STATUS.md`, `CHANGELOG.md`, `docs/roadmap.md`, `docs/pruebas-aceptacion.md`, `docs/catalogo-integraciones.md`, `docs/licencias-seguridad.md`, `docs/bitacora/README.md`, `coordinacion/*.md` (salvo BENCHMARKS en la rama de FDN-004), y los `index.ts` de `packages/project` y `packages/connectors`.

## Integrador suplente (ADR-0013)

Si A0 se queda sin cuota:
1. La integración en `develop` se **pausa**. Nadie fusiona; los equipos siguen en sus ramas y envían sus REVIEW a `claude-code-a0` como siempre.
2. Solo el **usuario** puede nombrar un suplente: una sesión Sol, una Neon o Astra en Codex. Esta última es una excepción explícita del usuario, válida solo para este rol.
3. El suplente se registra como `<herramienta>-integrador-suplente`, lee el buzón de `claude-code-a0` con `buzon --sesion claude-code-a0 --sinmarcar` (sin marcarlo como leído) y aplica la sección «Revisión de A0» de este documento sin saltarse pasos.
4. Anota cada fusión en su bitácora (`docs/bitacora/AAAA-MM-DD-<id>-integracion.md`) con el comando y el resultado. Puede actualizar BACKLOG, CURRENT_SPRINT y TEAM_STATUS, pero **no** cambia contratos ni ADR.
5. Cuando A0 vuelve, revisa todas las fusiones del suplente (`git log --first-parent develop` desde la caída) antes de seguir.
