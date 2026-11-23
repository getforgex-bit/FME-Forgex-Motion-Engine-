# Plan maestro FDN v1

> Aprobado por el usuario el 2026-11-22. Dueño: A0. El roadmap de producto sigue en [`docs/roadmap.md`](../docs/roadmap.md); este documento dice **quién hace qué y en qué orden**.

## Principio

El roadmap es secuencial por fases, pero las dependencias reales permiten paralelizar:
- la Fase 1 son **tres verificaciones independientes**, una por herramienta;
- la Fase 2 (modelo universal) y el registro de la Fase 3 dependen solo de los tipos de contrato, que ya existen.

Los equipos avanzan **de forma asíncrona**. Solo hay barrera cuando falta un contrato, hay una integración conjunta (FDN-042, FDN-075) o una fase nueva depende de pruebas compartidas.

## Equipos y autoridad

| Equipo | Coordinador | Trabajadores | Autoridad |
|---|---|---|---|
| Claude (CL) | **A0 Opus 5.5**: director, arquitecto e **integrador único** | A1 y A2 Sonnet 5.5 (sesiones independientes de Claude Code Desktop); A3 Haiku 5.5 bajo demanda | Visión, contratos, backlog maestro, fusiones en `develop` |
| Antigravity (AG) | B0 Gemini 4 Neon (`/swarm`) | B1 y B2 Gemini 4 Hydrogen | Reparte internamente sus tareas |
| Codex (CX) | C0 GPT-6.2 Sol | C1 y C2 GPT-6.2 Sol (delegación multiagente) | Reparte internamente sus tareas |

Neon y Sol son pares entre sí. Las decisiones locales (diseño interno de un módulo) son del equipo responsable. Reasignar una tarea a **otro equipo** requiere una `solicitud` a A0.

## Fases y tandas

| Fase | Hito verificable | Tareas | Tanda |
|---|---|---|---|
| Arranque | Entorno listo para los tres equipos | 001–003, 006, 020 | 0 (hecha) |
| 1 Verificar software | Criterio #1: tres pruebas repetibles | 010 (CL-A1), 011 (CX), 012 (AG), 013, 014 | 1–2 |
| 2 Modelo universal | Criterio #2: guardar/abrir sin pérdida | 021 (CL-A2), 022 (CX), 023, 024, 025 | 1–2 |
| 3 Conectores | Job real de extremo a extremo con procedencia | 030 (AG), 031, 032, 033 | 1–3 |
| 4 Integración | Criterio #3: vídeo con fuentes enlazadas | 040, 041, 042, 043 | 3–4 |
| 5 Router | Criterios #4 y #5 | 050, 051, 052, 053 | 2–5 |
| 6 Dirección artística | Criterio #6 | 060, 061, 062 | 3–5 |
| 7 Calidad | Criterios #7 y #8: prueba híbrida de 10 s | 070–075 | 4–6 |
| Transversal | MCP mínimo, CLI, licencias, benchmarks | 080, 081, 082, 004 | continuo |

**Tanda 1 (actual):** ver [CURRENT_SPRINT.md](CURRENT_SPRINT.md).
**Tanda 2:** 013, 023, 024, 031, 050 y 014 (cuando estén 010, 011 y 012).
**Tanda 3:** 032 (Revideo, CL), 040 (Blender, CX), 041 (FreeCut, AG) y 060.

Cada adaptador lo hace el equipo que verificó su herramienta, porque ya tiene el contexto.

## Criterios de asignación (resumen)

Detalle en [MODEL_ROUTING.md](MODEL_ROUTING.md). Se asigna por afinidad de herramientas y contexto, no por jerarquía:
- tareas con navegador o UI → AG;
- terminal, Python o lógica muy cubierta por tests → CX o CL;
- contratos y arquitectura → CL (A2 implementa, A0 revisa);
- investigación web y tareas mecánicas → A3.

Se revisa con los datos de [AGENT_PERFORMANCE.md](AGENT_PERFORMANCE.md) al cerrar cada tanda.

## Rutas reales

| Qué | Ruta |
|---|---|
| Checkout principal = integración (A0, rama `develop`) | `C:\Users\bogex\Documents\Forgex\FME` |
| Worktrees de Antigravity | `C:\Users\bogex\Documents\Forgex\FME-wt\antigravity`, `...\FME-wt\antigravity-2` |
| Worktrees de Codex | `C:\Users\bogex\Documents\Forgex\FME-wt\codex`, `...\FME-wt\codex-2` |
| Worktrees de Claude A1–A3 | Los crea Claude Code Desktop desde `develop` (ver `git worktree list`) |
| Carpeta operativa (no versionada) | `C:\Users\bogex\Documents\Forgex\FME-ops` |
| Herramientas externas clonadas | `C:\Users\bogex\Documents\Forgex\FME-ext` |
| Blender | `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe` |
