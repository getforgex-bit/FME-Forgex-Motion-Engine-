# Adaptadores

Un adaptador por herramienta: implementa el contrato de `@fme/connectors` y publica su tarjeta simple y su tarjeta avanzada.

| Adaptador | Herramienta | Nivel inicial | Fase | Estado |
|---|---|---|---|---|
| `revideo/` | Revideo (TS) | A: CLI/archivo | 3 (primer adaptador recomendado) | Pendiente de la verificación de la Fase 1 |
| `blender/` | Blender (`bpy`, headless) | A: CLI/archivo | 4 | Pendiente de la verificación de la Fase 1 |
| `freecut/` | FreeCut (editor) | A o B según la API real | 4 | Pendiente de la verificación de la Fase 1 (riesgo: API no estable) |

Requisitos de cada adaptador: versión fijada, directorio de trabajo aislado, timeouts, rutas validadas, procedencia en cada artefacto y licencia registrada en `docs/licencias-seguridad.md`.
