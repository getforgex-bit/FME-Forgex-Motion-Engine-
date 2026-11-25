# Tanda actual: Tanda 11 (después del hito 8/8)

> Dueño: A0. _Actualizado el 2026-11-25 (integración 10)._ **Prueba híbrida de 10 s superada: 8/8** (A0, `node scripts/prueba-hibrida.mjs --estricto`). Fases 0–7 cerradas; queda la aprobación formal de la spec (FDN-005).
> **Paso 0:** `coord.mjs usuario --presente`. **Turnos:** `coord.mjs turno --equipo antigravity|codex` (ADR-0017).

| Equipo | Tarea | Notas |
|---|---|---|
| **Codex** | FDN-073c (referencia de Revideo, candidato aprobado), FDN-070c (intermitente de la caché) y FDN-063b (`camera.json` de Blender) | `turno` decide entre Sol y Astra |
| **Claude A1** | FDN-063c `3d-with-2d` en el pipeline | — |
| **Claude A3 + A0** | FDN-092 Trazabilidad por hitos (ADR-0018, `scripts/progreso.mjs`, PROGRESO.md versionado; `--check` bloquea solo la integración de A0) | decidido por el usuario: después de la prueba híbrida |
| **Antigravity** | Libre: FDN-082 (auditoría de licencias de las versiones fijadas) o lo que proponga | `turno` decide entre Neon y Carbon |
| **Claude A2** | En reposo hasta la siguiente tanda | — |

## Decisiones del usuario pendientes
- **FDN-005:** aprobación formal de la spec v0.1 (cierra la Fase 0).
- **¿Llevar `develop` a `main`?** El hito v0.1 del mediano plazo está verificado; fusionar en `main` requiere tu aprobación (AGENTS.md, regla 8).
- Largo plazo (Fase 8+): solo se activa una línea cuando se cumple su disparador y hay un ADR.
