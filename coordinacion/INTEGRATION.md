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
