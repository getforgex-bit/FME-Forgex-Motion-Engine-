# ADR-0016: Suplente (asistente) de A0 en paralelo

- **Estado:** aceptada (2026-11-23; confirmada por el usuario en el chat de A0) · **Dueño:** A0
- **Complementa a:** [ADR-0013](0013-relevo-entre-equipos.md) (relevo y suplente cuando A0 cae) y [ADR-0014](0014-modo-ausencia-del-usuario.md)

## Contexto

Mientras A0 integraba, el usuario abrió una sesión `claude-code-a0s` para auditar una propuesta de trazabilidad «en nombre de A0». ADR-0013 solo preveía un **integrador suplente** cuando A0 cae. El usuario aclaró:
- un suplente **no es un relevo**;
- **no puede** hacer cambios ni tomar decisiones importantes en nombre de A0;
- solo usa su criterio y **crea archivos**, con la autorización del usuario, para que A0 o el relevo los revisen.

## Decisión

Hay tres roles distintos:

| Rol | Cuándo | Qué puede hacer |
|---|---|---|
| **Suplente / asistente de A0** (`claude-code-a0s`, o `<herramienta>-a0s`) | Mientras A0 está activo, cuando el usuario lo designa | Leer todo, usar su criterio y **crear archivos nuevos** (propuestas, auditorías, borradores) en `FME-ops/propuestas/` o en su bitácora, con la autorización del usuario. Enviar `solicitud` a A0. **No** edita el repo ni los archivos compartidos, no integra, no da de alta tareas ni hitos, no acepta ADR y no responde por A0 a otros equipos |
| **Integrador suplente** (ADR-0013 §6) | Solo si A0 cae y el usuario lo nombra | Integrar siguiendo `INTEGRATION.md` |
| **Relevo** (ADR-0013) | Equipo caído, con la aprobación del usuario | Terminar las tareas relevadas |

- Las «decisiones del usuario» que recoja el asistente son **información**: A0 las verifica antes de aplicarlas. Si alguna cambia el alcance, los contratos o el protocolo, A0 lo confirma con el usuario en su chat.
- El asistente se registra en `coord.mjs` con `--tarea` que describa el encargo y cierra su sesión al terminar.

## Consecuencias

- **Positivas:** el usuario puede delegar auditorías y propuestas sin interrumpir a A0 y sin riesgo de decisiones en paralelo.
- **Negativas:** A0 debe revisar lo que produzca. Es trabajo adicional, pero visible y trazable.

## Evidencia

Primer uso: `FME-ops/propuestas/2026-11-23-mejora-plan-trazabilidad-v2.md`, que A0 revisó el 2026-11-23. Sus tres decisiones abiertas se confirmaron con el usuario en el chat de A0.
