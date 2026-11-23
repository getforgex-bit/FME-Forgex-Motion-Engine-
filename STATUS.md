# Estado del proyecto

_Última actualización: 2026-11-22: repositorio preparado (Fase 0)._

## Fases

| Fase | Nombre | Estado | Condición de cierre |
|---|---|---|---|
| 0 | Especificar | **Hecha** (pendiente de la aprobación formal del usuario) | Especificación FME 0.1 aprobada |
| 1 | Verificar software | **Siguiente** | Tres pruebas individuales repetibles |
| 2 | Modelo universal | Pendiente | Guardar/abrir sin perder estado |
| 3 | Conectores | Pendiente | Descubrimiento y job de extremo a extremo |
| 4 | Integración real | Pendiente | Vídeo final con fuentes enlazadas |
| 5 | Enrutador | Pendiente | Selección justificada y verificable |
| 6 | Dirección artística | Pendiente | Cambios reales y reproducibles en la escena |
| 7 | Calidad | Pendiente | Prueba híbrida de 10 s superada |
| 8 | Evolución | Pendiente | Cada pieza nueva demuestra valor concreto |

Detalle: [`docs/roadmap.md`](docs/roadmap.md) · Criterios: [`docs/pruebas-aceptacion.md`](docs/pruebas-aceptacion.md) (0/8).

## Qué existe hoy (verificado)

- Documentación completa derivada de la spec v0.1.
- Contratos TypeScript **propuestos** (`@fme/project`, `@fme/connectors`): `npm run typecheck` en verde.
- FORGEX Stack instalado y verificado en el entorno de preparación (ver la bitácora del 2026-11-22). Cada persona debe instalarlo en su máquina.

## Qué NO existe todavía

- Ningún adaptador, enrutador, dirección artística, MCP ni render. Ninguna herramienta externa verificada.

## Próxima acción

Fase 1: fijar las versiones de FreeCut, Revideo y Blender y ejecutar una prueba repetible de cada una en la PC de referencia (RTX 3050 de 4 GB, 23 GB de RAM, Ryzen 7 4800H).

## Decisiones

| Fecha | Decisión | Referencia |
|---|---|---|
| 2026-11-22 | Registrar las decisiones con ADR + memoria + bitácora | ADR-0001 |
| 2026-11-22 | Decisiones congeladas de la spec v0.1 | ADR-0002 |
| 2026-11-22 | FORGEX Stack (Segundo Cerebro, `develop`) como memoria y herramientas para agentes | ADR-0003 |
| 2026-11-22 | Licencia de FME pendiente; uso interno (propuesta) | ADR-0004 |
| 2026-11-22 | Monorepo TypeScript con npm workspaces (propuesta) | ADR-0005 |
| 2026-11-22 | Coordinación multiagente por archivos versionados (propuesta) | ADR-0006 |
