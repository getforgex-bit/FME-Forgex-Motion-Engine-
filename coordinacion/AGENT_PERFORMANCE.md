# Rendimiento de agentes (medido)

> A0 lo rellena a partir de los informes REVIEW ([TASK_PROTOCOL.md](TASK_PROTOCOL.md#informe-del-evento-review-cuerpo-del-mensaje)). Solo datos reales; «no medido» cuando no exista el dato.

## Por tarea

| Tarea | Equipo/modelo | Inicio → fin | Duración | Pruebas | Reintentos | Errores | Retrabajo | Conflictos | Consultas CodeGraph/Graphify | Contexto | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|
| FDN-001..003, 006, 020 | A0 Opus 5.5 | 2026-11-22 | una sesión | typecheck ✔, test 7/7 ✔ | 0 | `tsc` ausente (resuelto con `npm install`) | 0 | 0 | 2 / 4 | no medido | Arranque |
| FDN-021 | CL-A2 Sonnet 5.5 | 05:51 → 05:55 UTC | ~4 min | typecheck ✔, test 18/18 ✔ (A0: 30/30 tras integrar) | 0 | — | 0 | 0 | sí / 0 | no medido | Tocó `packages/project/tsconfig.json` fuera de la ficha (justificado y aceptado) |
| FDN-022 | CX-C2 GPT-6.2 Sol | 05:53 → 05:58 UTC | ~5 min | typecheck ✔, test 19/19 ✔ | 2 (herramientas) | GitNexus sin índice del worktree | 0 | 0 | 8 / 0 | no medido | Revisado internamente por C0 |
| FDN-011 | CX-C1 GPT-6.2 Sol | 05:53 → 06:00 UTC | ~7 min | 2 corridas, SHA-256 de píxeles idéntico (A0 lo reprodujo) | 6 de verificación | `run.ps1` incompatible con PS 5.1 (→ FDN-015) | pequeño | 0 | 2 / 0 | no medido | Hallazgo valioso: metadatos volátiles en PNG |
| FDN-010 | CL-A1 Sonnet 5.5 | 05:51 → ~06:02 UTC | ~11 min | `npm run verify` ×2 (la segunda limpia) ✔ | 4 | wasm vacío, fotograma extra, alpha opaco, dependencia faltante (resueltos) | 0 | 0 | 0 / 0 | no medido | Instaló `@revideo/ui` sin confirmación explícita (1,3 MB) → recordatorio |
| FDN-004 | CL-A3 Haiku 5.5 | 05:51 → 05:56 UTC | ~5 min | n/a (documento) | 0 | — | 0 | 0 | 0 / 0 | no medido | Calidad alta; contradijo con fuentes la hipótesis «Sonnet ≥ Opus en terminal» |

## Tiempo de coordinación (A0)

| Fecha | Actividad | Duración aproximada |
|---|---|---|
| 2026-11-23 | Revisión e integración de 5 ramas, reproducción del render de Blender y consolidación | ~15 min |

## Valor de los grafos (se evalúa al cerrar cada tanda)

| Tanda | Consultas | Lecturas evitadas declaradas | Valoración |
|---|---|---|---|
| 1 (parcial) | CodeGraph 10+ (CX), A0 `affected` 1; Graphify 0 | 2 (contrato TS, `index.ts`) | Útil para localizar tests afectados; Graphify aún sin uso real (poco código) |
