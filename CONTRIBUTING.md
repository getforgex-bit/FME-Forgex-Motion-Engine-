# Contribuir a FME

## Flujo de trabajo

1. Elige una tarea del [roadmap](docs/roadmap.md) (fase actual en [`STATUS.md`](STATUS.md)).
2. Crea una rama desde `develop`: `feat/<slug>`, `fix/<slug>` o `docs/<slug>`.
3. Trabaja siguiendo [`AGENTS.md`](AGENTS.md) (sirve para personas y agentes IA).
4. Verifica: `npm run typecheck` (y los tests cuando existan).
5. Registra (ver [`docs/memoria-y-registro.md`](docs/memoria-y-registro.md)): bitácora, ADR si hay una decisión, memoria, `CHANGELOG.md` y `STATUS.md`.
6. Abre un PR hacia `develop` con la plantilla. La fusión a `main` requiere la aprobación del responsable del proyecto.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/) en español:

| Tipo | Uso |
|---|---|
| `feat(<ámbito>)` | Funcionalidad nueva |
| `fix(<ámbito>)` | Corrección |
| `docs(<ámbito>)` | Documentación |
| `test`, `refactor`, `chore`, `ci`, `perf` | Lo habitual |

Ámbitos: `project`, `connectors`, `router`, `art-direction`, `adapters/<nombre>`, `runtime`, `apps/<nombre>`, `docs`, `memoria`.

## Definition of Done

- [ ] Compila (`npm run typecheck`) y los tests propios pasan.
- [ ] La documentación afectada está actualizada (incluido `docs/contratos.md` si tocas contratos).
- [ ] La verificación es **real**: comandos ejecutados y resultados en el PR o en la bitácora. Lo no verificado se declara.
- [ ] Sin secretos ni rutas personales en los archivos versionados.
- [ ] Dependencia nueva → justificada (ADR si es de runtime o pesada) y licencia registrada.

## Instalar la memoria para agentes

Ver [`docs/memoria-y-registro.md`](docs/memoria-y-registro.md#instalación-cada-persona-en-su-máquina).
