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
| FDN-030 | AG-B2 Gemini 4 Hydrogen | 05:56 → 06:07 UTC | ~11 min | typecheck ✔, test 16/16 ✔ | 0 | — | 0 | 0 | 4 / 1 | no medido | ADR-0009 sólido; semántica `unknown` correcta |
| FDN-060 | AG-B1+B2 Hydrogen | 06:16 → 06:20 UTC | ~4 min | test 37/37 ✔ | 0 | — | 0 | 0 | 2 / 1 | no medido | Respetó el reclamo de `tsconfig.json` de Codex; determinista |
| FDN-024 | CX-C2 Sol | 06:08 → 06:12 UTC | ~4 min | test 34/34 ✔ | 2 | Zod ausente en el worktree (restaurado offline) | 0 | 0 | 4 / 0 | no medido | — |
| FDN-015 | CX-C1 Sol | 06:09 → 06:12 UTC | ~3 min | PS 5.1 y PS 7 ✔; hash igual (A0 lo reprodujo) | 1 | Se perdía el ExitCode en PS 5.1 (resuelto) | — | 0 | 2 / 0 | no medido | — |
| FDN-031 | CX-C1 Sol | 06:07 → 06:21 UTC | ~14 min (con pausa) | 5/5; kill del árbol raíz/hijo/nieto | 1 | spawn UNKNOWN síncrono (resuelto) | 0 | 0 | 2 / 0 | no medido | Pidió regenerar el lockfile en lugar de tocarlo (correcto) |
| FDN-023 | CL-A2 Sonnet 5.5 | ~06:09 → 06:10 UTC | ~2 min + arreglo | test 36/36 ✔ | 1 | Un `sed` rompió un test (lo corrigió antes del REVIEW final) | pequeño | 0 | — | no medido | Tolerancia a CRLF añadida |
| FDN-013 | CL-A3 Haiku 5.5 | ~06:09 → 06:10 UTC | ~2 min | 7/7, total 37/37 ✔ | 1 | ProRes 12 bits | 0 | 0 | 0 / 0 | no medido | Bien acotada para Haiku |
| FDN-016 | CL-A1 Sonnet 5.5 | 06:09 → 06:16 UTC | ~7 min | verify ✔, `npm audit` 0 | 0 | fluent-ffmpeg y lavfi con FFmpeg ≥ 7 (parche) | 0 | 0 | 0 / 0 | no medido | Pidió confirmación de la descarga (corregido respecto a FDN-010) |
| FDN-026 | CL-A2 Sonnet 5.5 | 06:31 → 06:32 UTC | ~1 min | test 73/73 ✔ | 0 | — | 0 | 0 | 1 (impact) / 0 | no medido | Pequeña y precisa |
| FDN-032 | CL-A1 Sonnet 5.5 | 06:31 → 06:38 UTC | ~7 min | 86/86, 6 con el motor real (A0: 6/6 en 28 s) | 0 | — | 0 | 0 | — | no medido | Interpretaciones de contrato bien señaladas (`text`, `easing`) |
| FDN-070 | CX-C2 Sol | 06:32 → 06:39 UTC | ~7 min | 79/79 ✔ | 1 (índice desactualizado) | — | 0 | 0 | 6 / 0 | no medido | Pidió el validador compartido en vez de importar código interno (correcto) |
| FDN-028 | CL-A2 Sonnet 5.5 | 06:45 → 06:47 UTC | ~2 min | 101 pass ✔ | 0 | — | 0 | 0 | 2 (impact) / 0 | no medido | Cambio de contrato bien gestionado (solicitud con el diff exacto) |
| FDN-033 | CL-A1 Sonnet 5.5 | 06:45 → 06:49 UTC | ~4 min | E2E 1/1 con motor (A0: 8/8 en serie) | 0 | No identificó el fallo intermitente (A0: aislamiento entre tests) | 0 | 0 | — | no medido | — |
| FDN-034 | CL-A1 Sonnet 5.5 | 06:49 → 06:50 UTC | ~1 min | 1/1; el test detecta la regresión con el arreglo revertido | 0 | — | 0 | 0 | — | no medido | Buena prueba de regresión |
| FDN-040 | CX-C0+C1 Sol | 06:32 → 06:41 UTC | ~9 min | 5/5 con Blender real | 1 | — | **sí: no compatible con v2 (FDN-028 en paralelo)** | 1 semántico | 5 / 0 | no medido | Primer conflicto entre equipos: contrato cambiado en paralelo |
| FDN-050 | AG-B2 Hydrogen | 06:37 → 06:42 UTC | ~5 min | 78/78 ✔ | 0 | — | 0 | 0 | 2 / 1 | no medido | Métricas de tarjetas ya instrumentadas |
| FDN-012 | AG-B1 Hydrogen (+B0) | 05:56 → 06:47 UTC | ~51 min (con espera de autorización) | 4 corridas desde cero ✔ (A0 la reprodujo) | 1 | Upstream `probe.mjs` exige Chrome (resuelto sin fork) | pequeño | 0 | 1 / 0 | no medido | Recomendación de nivel A bien fundada |
| FDN-051 | CL-A3 Haiku 5.5 | ~07:04 → 07:05 UTC | ~1 min | 5/5 ✔ | 1 (choque de reclamo) | — | 0 | 0 | 1 / 0 | proxy caracteres/4 | Tabla útil: 222 tok fijos en tarjetas simples; avanzadas, 0–197 tok según la tarea, frente a 503 tok si se leyeran todas |
| FDN-080 | CL-A2 Sonnet 5.5 | ~07:04 → 07:08 UTC | ~4 min | 11 pass (cliente del SDK) | 0 | — | 0 | 0 | — | no medido | No tocó la raíz; dejó listas las instrucciones para A0 |
| FDN-032b/034b | CL-A1 Sonnet 5.5 | 07:04 → 07:09 UTC | ~5 min | 8/8 en paralelo ×3 (A0 lo reprodujo) | 1 | — | 0 | 0 | — | no medido | — |
| FDN-040 (arreglo v2) | CX-C0 Sol | ~06:57 UTC | — | A0: Blender real 6/6 | 0 | — | — | — | — | — | Hizo el arreglo pero se quedó sin cuota antes de enviar el REVIEW |
| FDN-041 | AG-B1 Hydrogen (+B0) | 16:45 → 16:55 UTC | ~10 min | 7/7 con FreeCut real (A0: mismo contentSha256) | 0 | — | 0 | 0 | 1 / 1 | no medido | — |
| FDN-072 | AG-B2 Hydrogen | 16:45 → 16:52 UTC | ~7 min | 8/8 ✔ | 1 | — | 0 | 0 | 2 / 1 | no medido | Tomó una tarea libre (correcto) |
| FDN-070b | CX-C1 Sol | 16:46 → 16:52 UTC | ~6 min | 50/50 focales + 5 suites (A0: 6/6) | 1 | — | 0 | 0 | 3 / 0 | no medido | Reprodujo el EPERM antes de arreglarlo |
| FDN-071 | CX-C1+C2 Sol | 06:54 → 16:48 UTC | ~10 h (incluida la pausa sin cuota) | 12/12 ✔ | 1 | — | 0 | 0 | 6 / 0 | no medido | Primera tarea que sobrevivió a la falta de cuota |
| FDN-061 | CL-A1 Sonnet 5.5 | 16:49 → 16:55 UTC | ~6 min | motor real: métrica monótona (A0: 9/9) | 0 | — | 0 | 0 | — | no medido | Cambios fuera de ficha, aditivos y declarados |
| FDN-081 | CL-A2 Sonnet 5.5 | ~16:47 → 16:52 UTC | ~5 min | 8 + 1 skip (A0 con motor: 9/9) | 0 | — | 0 | 0 | — | no medido | — |
| FDN-042b | CL-A2 Sonnet 5.5 | ~17:25 → 17:30 UTC | ~5 min | 184 pass ✔ | 0 | — | 0 | 0 | 2 (impact) / 0 | no medido | Arregló consumidores ajenos para mantener el verde y los declaró |
| FDN-061b | CX-C0+C1+C2 Sol | 17:25 → 17:33 UTC | ~8 min | Blender real (A0: 7/7) | 0 | — | 0 | 0 | sí / 1 | no medido | Primera tarea con los tres Sol a la vez |
| FDN-042a | AG-B0+B1+B2 | 17:31 → 17:45 UTC | ~14 min | FreeCut real 14/14 (A0 lo reprodujo) | 0 | — | 0 | 0 | 3 / 1 | no medido | Hallazgo empírico valioso: alpha por formato en FreeCut |
| FDN-042c | CL-A1 Sonnet 5.5 | 17:54 → 18:16 UTC | ~22 min | pipeline 3 motores ×3 (A0 lo reprodujo, 87 s) | 0 | encontró un bug propio (SVG vacío en FDN-032) | sí (FDN-032) | 0 | — | no medido | La métrica de píxeles destapó un bug que el recuento de fotogramas no veía |
| FDN-074a | AG-B0+B1+B2 | 17:55 → 18:11 UTC | ~16 min | FreeCut real 20/20; desfase A/V 0 ms | 0 | — | 0 | 0 | 3 / 1 | no medido | Su test de integración tiene un fallo intermitente upstream (→ 074b) |
| FDN-080b | CL-A2 Sonnet 5.5 | ~17:55 → 18:00 UTC | ~5 min | 200 pass; preview con motor real | 0 | — | 0 | 0 | — | no medido | Eliminó la duplicación MCP/CLI |
| FDN-073a | CX-C0+C1+C2 Sol | 17:56 → 18:04 UTC | ~8 min | 10 pass + 3 TODO | 0 | — | 0 | 0 | — | no medido | Señaló los huecos como TODO en lugar de ocultarlos |
| FDN-004 | CL-A3 Haiku 5.5 | 05:51 → 05:56 UTC | ~5 min | n/a (documento) | 0 | — | 0 | 0 | 0 / 0 | no medido | Calidad alta; contradijo con fuentes la hipótesis «Sonnet ≥ Opus en terminal» |

## Tiempo de coordinación (A0)

| Fecha | Actividad | Duración aproximada |
|---|---|---|
| 2026-11-23 | Revisión e integración de 5 ramas, reproducción del render de Blender y consolidación | ~15 min |
| 2026-11-23 | Integración 6: 6 ramas; verificación con FreeCut y Revideo reales; criterio #6 | ~15 min |
| 2026-11-23 | Integración 5: 4 ramas + FDN-040 sin REVIEW (Codex sin cuota); verificación con motores reales | ~20 min |
| 2026-11-23 | Integración 4: 6 ramas, diagnóstico de 2 fallos intermitentes (EPERM de la caché; aislamiento de tests de Revideo), verificación de FreeCut y del E2E, cierre de las F1 y F3 | ~30 min |
| 2026-11-23 | Integración 2: 8 ramas, 2 workspaces nuevos (lockfile), verificación PS 5.1, ADR-0011 y fichas de la Tanda 3 | ~25 min |

## Valor de los grafos (se evalúa al cerrar cada tanda)

| Tanda | Consultas | Lecturas evitadas declaradas | Valoración |
|---|---|---|---|
| 2 | CodeGraph ~16 (CX y AG), Graphify 3 updates + 1 `god-nodes` (A0) | ~10 archivos declarados | Graphify ya aporta: identificó `parseProject` y `ConnectorRegistry` como nodos centrales |
| 1 (parcial) | CodeGraph 10+ (CX), A0 `affected` 1; Graphify 0 | 2 (contrato TS, `index.ts`) | Útil para localizar tests afectados; Graphify aún sin uso real (poco código) |
