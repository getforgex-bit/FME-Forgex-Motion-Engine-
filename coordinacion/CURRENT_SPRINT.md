# Tanda actual: Tanda 11 (después del hito 8/8)

> Dueño: A0. _Actualizado el 2026-11-25 (integración 10)._ **Prueba híbrida de 10 s superada: 8/8** (A0, `node scripts/prueba-hibrida.mjs --estricto`). Fases 0–7 cerradas; queda la aprobación formal de la spec (FDN-005).
> **Paso 0:** `coord.mjs usuario --presente`. **Turnos:** `coord.mjs turno --equipo antigravity|codex` (ADR-0017).

| Equipo | Tarea | Notas |
|---|---|---|
| **Codex** | **CAÍDO** (sin cuota, declarado por el usuario el 2026-11-25 08:01 UTC; acta en `FME-ops/relevos/`) | Sol y Astra sin cuota |
| **Antigravity-relevo** (sesión aparte, id `antigravity-r0`) | FDN-070c (el fix de Codex ya está integrado; falta el intermitente «rechaza un enlace de directorio») y FDN-063b. FDN-073c DONE | prompt: `FME-ops/relevos/PROMPT-antigravity-relevo.md`; ramas `<origen>-relevo-antigravity-relevo` |
| **Claude A1** | FDN-063c `3d-with-2d` en el pipeline | — |
| **Claude A3 + A0** | ~~FDN-092~~ **DONE**: `PROGRESO.md` generado (v0.1 en el 82 %). Trazabilidad por hitos (ADR-0019, `scripts/progreso.mjs`, PROGRESO.md versionado; `--check` bloquea solo la integración de A0) | decidido por el usuario: después de la prueba híbrida |
| **Antigravity** | Libre: FDN-082 (auditoría de licencias de las versiones fijadas) o lo que proponga | `turno` decide entre Neon y Carbon |
| **Claude A2** | En reposo hasta la siguiente tanda | — |

## Decisiones del usuario pendientes
- **FDN-005:** aprobación formal de la spec v0.1 (cierra la Fase 0).
- ~~¿Llevar `develop` a `main`?~~ **Hecho** con la aprobación del usuario: `main` = `6ff846f` (hito v0.1). No se ha hecho push al remoto.
- **FDN-070c es prioritaria:** el intermitente de la caché falló 2 de 3 veces al verificar `main`.
- Largo plazo (Fase 8+): solo se activa una línea cuando se cumple su disparador y hay un ADR.
