# Capacidades y enrutado de modelos

> Combina «capacidades» y «enrutado». Fuentes: [BENCHMARKS.md](BENCHMARKS.md) (POR VALIDAR) y la experiencia medida en [AGENT_PERFORMANCE.md](AGENT_PERFORMANCE.md). Se revisa al cerrar cada tanda.

## Recursos

| Rol | Modelo | Entorno | Fortalezas observables o esperadas | Uso en FDN |
|---|---|---|---|---|
| A0 | Opus 5.5 | Claude Code Desktop | Razonamiento largo, arquitectura, revisión | Dirección, contratos, integración, ADR |
| A1, A2 | Sonnet 5.5 | Sesiones independientes de Claude Code Desktop | Implementación con terminal (dentro del ruido frente a Opus en TB 4.0 y 4.1; ver BENCHMARKS §4) | Tareas de código de tamaño medio; en la Tanda 1 entregaron en 4–11 min con pruebas en verde |
| A3 | Haiku 5.5 | Sesión de Claude Code Desktop bajo demanda | Rápido y barato; terminal limitado | Investigación web, resúmenes, scripts simples, comprobaciones |
| B0c | Gemini 4 Carbon | Antigravity, en **turno** con B0 (no en paralelo; ADR-0017) | Terminal complejo, horizonte largo, verificación y redacción (tabla del usuario, POR VALIDAR) | Coordina AG cuando `turno` lo recomienda: depuración, intermitentes, auditorías largas |
| C0a | GPT-6.2 Astra | Codex, en **turno** con C0 (temporal mientras Sol no tenga cuota) | Ciencia y algoritmos, razonamiento abstracto, repositorios complejos | Coordina CX mientras Sol no tenga cuota; según resultados, pareja de turno |
| B0 | Gemini 4 Neon | Antigravity (`/swarm`) | Orquestación; agente de navegador del entorno | Coordina AG; tareas de UI o navegador |
| B1, B2 | Gemini 4 Hydrogen | Antigravity | Ejecución | Lo que asigne Neon |
| C0, C1, C2 | GPT-6.2 Sol | Codex Desktop (multiagente) | Terminal y código; delegación | Coordina CX; Python/CLI y lógica con tests |
| (reserva) | Argon | — | No permanente | Solo si A0 lo justifica |

**Excepción del usuario (2026-11-25, ADR-0017):** se usan Carbon (Antigravity) y Astra (Codex) como coordinadores **en turno**, nunca en paralelo con su pareja del mismo equipo.

**¿A quién pongo a trabajar?** `node scripts/coord.mjs turno --equipo antigravity` (o `codex`). Recomienda según el titular, la cuota y el perfil del modelo frente a las tareas READY del equipo (`coordinacion/turnos.json`).

## Reglas de asignación

1. **Primero las restricciones duras:** herramientas que hacen falta (navegador → AG; `nvidia-smi` y un proceso largo → cualquiera con terminal) y rutas libres de conflicto.
2. **Contexto previo:** quien verificó una herramienta hace su adaptador (CL→Revideo, CX→Blender, AG→FreeCut).
3. **Riesgo de contrato:** los cambios en `packages/project` y `packages/connectors` los implementa cualquier equipo, pero A0 los revisa siempre y la ficha fija las rutas.
4. **Coste:** no se activan todos los agentes si no aporta. A3 solo con tareas concretas; los Sonnet en paralelo solo con tareas independientes.
5. **Evidencia sobre benchmark:** si las métricas reales contradicen la tabla, prevalecen las métricas.
