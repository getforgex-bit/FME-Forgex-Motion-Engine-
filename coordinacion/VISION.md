# Visión (resumen operativo)

**FME** (Forgex Motion Engine) es un motor audiovisual procedural y AI-first que **integra** herramientas existentes (FreeCut, Revideo, Blender, FFmpeg) mediante:
- un **proyecto universal** con timeline (fuente de verdad, independiente de cada herramienta),
- **conectores** con tarjeta simple y avanzada,
- un **enrutador** que elige la herramienta con justificación,
- una mitad de **dirección artística** (5 técnicas y 2 gradientes).

**Meta del mediano plazo:** la **prueba híbrida de 10 s** con los 8 criterios de [`docs/pruebas-aceptacion.md`](../docs/pruebas-aceptacion.md).

**No es:** un editor nuevo, un motor de render propio ni un catálogo ampliado. El alcance está congelado en la spec v0.1 (ADR-0002); cualquier ampliación requiere un ADR aprobado por el usuario.

**Reglas que todo equipo respeta** (detalle en [`AGENTS.md`](../AGENTS.md)):
- verdad (ACORDADO / PROPUESTO / POR VALIDAR / VERIFICADO, citando el comando);
- integrar antes que forkear;
- los contratos (`packages/project`, `packages/connectors`) solo cambian con ADR;
- seguridad: rutas aisladas, timeouts y nada destructivo sin el usuario;
- registrar las licencias antes de fijar una dependencia.

Visión completa: [`docs/vision.md`](../docs/vision.md).
