# Tanda actual: Tanda 10 (último criterio y prueba final)

> Dueño: A0. _Actualizado el 2026-11-23 (integración 9)._ **Criterios 7/8**: falta el #7 (sincronía A/V sobre la exportación híbrida). Fases 0–5 cerradas. Fichas en [BACKLOG.md](BACKLOG.md#fichas-de-la-tanda-10-ready-desde-el-2026-11-23-integración-9-último-criterio-y-prueba-final).
> `develop`: `npm test` 226 pass + 15 skip + 3 TODO. Intermitente conocido: test de concurrencia de la caché en carga (→ FDN-070c).
> **Paso 0 obligatorio:** `coord.mjs usuario --presente` en cada mensaje del usuario (ADR-0014).

| Equipo | Tarea | Criterio | Rama (nueva desde `develop`) |
|---|---|---|---|
| **Antigravity** | FDN-074 Exportación híbrida con sincronía medida | **#7** | `fdn/FDN-074-av-sync-hibrida` |
| **Claude A2** | FDN-075 Prueba híbrida final (informe de los 8 criterios) | todos | `fdn/FDN-075-prueba-final` |
| **Claude A1** | FDN-063 Técnicas compuestas → cierre de la F6 | — | `fdn/FDN-063-tecnicas` |
| **Codex** | FDN-073b (en curso), después FDN-070c y FDN-073c | — | sus ramas |
| **Claude A3** | — (reservado para FDN-092 tras la prueba híbrida) | — | — |

## Decisiones del usuario pendientes de aplicar
- **FDN-092 (trazabilidad por hitos):** después de la prueba híbrida; `PROGRESO.md` versionado; `--check` bloquea solo la integración de A0.

## Bloqueos conocidos
- FDN-005 (aprobación de la spec): solo el usuario.
