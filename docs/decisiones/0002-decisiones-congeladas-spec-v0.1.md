# ADR-0002: Decisiones congeladas de la especificación v0.1

- **Estado:** aceptada (2026-11-22; spec fechada el 2026-11-21) · **Dueño:** FORGEX MEDIA · **Revisable:** solo mediante un ADR nuevo que cambie el alcance

## Contexto

La *Especificación integral v0.1* (`docs/especificacion/FME-Especificacion-Integral-v0.1.pdf`, SHA-256 `0aec59aa…d71d8`) cierra el alcance funcional. Su §21.2 enumera las decisiones fijadas.

## Decisión

Quedan fijadas:

1. Nombre: **Forgex Motion Engine (FME)**.
2. Alcance de capacidades e integraciones **congelado** (catálogo en `docs/catalogo-integraciones.md`).
3. Núcleo con **dos mitades**: dirección artística (`packages/art-direction`) y proyecto universal (`packages/project`).
4. **Timeline** como estructura primaria.
5. **Conectores con registro dinámico** y dos tarjetas por herramienta (simple y avanzada).
6. **Router** con rutas manuales, automáticas e híbridas.
7. Operación para IA mediante **código y MCP sobre la misma API** (MCP = adaptador de la API).
8. **Cinco técnicas y dos gradientes** combinables y animables.
9. **Integrar primero**; forks graduales solo ante una carencia demostrada (configuración → API/plugin → adaptador → fork).
10. **FreeCut, Revideo y Blender** como cadena inicial de prueba.

## Consecuencias

- **Positivas:** foco y protección frente al *scope creep*.
- **Negativas:** si la Fase 1 demuestra que alguna herramienta base no sirve (p. ej. FreeCut sin una API utilizable), habrá que escribir un ADR que sustituya el punto 10. Candidatas ya discutidas en la spec: MLT, OpenCut, mcut.
- **Seguimiento:** los aspectos de la spec §21.3 siguen **POR VALIDAR** (`docs/riesgos.md`).
