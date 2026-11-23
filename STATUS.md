# Estado del proyecto

_Última actualización: 2026-11-22: repositorio preparado (Fase 0)._

## Fases

| Fase | Nombre | Estado | Condición de cierre |
|---|---|---|---|
| 0 | Especificar | **Hecha** (pendiente de la aprobación formal del usuario) | Especificación FME 0.1 aprobada |
| 1 | Verificar software | **Hecha** (2026-11-23, criterio #1) | Tres pruebas individuales repetibles |
| 2 | Modelo universal | **Hecha** (2026-11-23, criterio #2) | Guardar/abrir sin perder estado |
| 3 | Conectores | **Hecha** (2026-11-23, E2E con job real) | Descubrimiento y job de extremo a extremo |
| 4 | Integración real | **Hecha** (2026-11-23, criterio #3) | Vídeo final con fuentes enlazadas |
| 5 | Enrutador | **En curso** (núcleo con tarjetas reales) | Selección justificada y verificable |
| 6 | Dirección artística | **En curso** (criterio #6 ☑ en Revideo y Blender; faltan técnicas, FDN-063) | Cambios reales y reproducibles en la escena |
| 7 | Calidad | Pendiente | Prueba híbrida de 10 s superada |
| 8 | Evolución | Pendiente | Cada pieza nueva demuestra valor concreto |

Detalle: [`docs/roadmap.md`](docs/roadmap.md) · Criterios: [`docs/pruebas-aceptacion.md`](docs/pruebas-aceptacion.md) (4/8).

## Qué existe hoy (verificado)

- Documentación completa derivada de la spec v0.1.
- Contratos TypeScript **propuestos** (`@fme/project`, `@fme/connectors`): `npm run typecheck` en verde.
- **Fase 1 CERRADA (criterio #1):** FreeCut `5ceeeb3`, Revideo 0.11.0 y Blender 5.2.3, cada uno con una prueba repetible que A0 ejecutó.
- **Fase 2 CERRADA (2026-11-23, criterio #2):** esquema, validación, serialización determinista, tiempo racional, migraciones conectadas a `deserialize` y fixtures (incluida la híbrida de 10 s).
- **Fase 3 CERRADA** (E2E: descubrimiento → job real → procedencia):
  - registro de conectores (FDN-030);
  - ejecución aislada de procesos con kill del árbol en Windows (FDN-031);
  - interfaz común de adaptadores (ADR-0011).
  - **Adaptador Revideo con job real** (FDN-032; 120 fotogramas desde la fixture híbrida, procedencia con SHA-256).
  - Caché por dependencias (FDN-070).
  - **Adaptador Blender integrado** (FDN-040; Blender real 6/6).
  - **Servidor MCP mínimo** (`apps/mcp`, FDN-080): `project.*`, `connectors.*`, `route.plan` y `job.run` sobre la API; el resto devuelve «no implementado».
  - Router: secuencia de 8 pasos, modos y restricciones duras sobre las tarjetas reales (FDN-050).
  - `schemaVersion` 2: contenido de las capas de texto (FDN-028, ADR-0012).
- **Fase 6, adelantada:** perfiles de estilo y reglas deterministas (`@fme/art-direction`, FDN-060).
- **Tres adaptadores reales** (Revideo, Blender y FreeCut), CLI (`apps/cli`), plan de render por segmentos, recuperación de errores y caché robusta en Windows.
- **Criterio #6 ☑:** los gradientes cambian una métrica de píxeles de forma monótona en un render real de Revideo.
- **`schemaVersion` 3:** el proyecto guarda los artefactos generados y valida sus enlaces (FDN-042b, ADR-0015). FreeCut compone pistas con alpha (FDN-042a).
- **Fase 4 CERRADA (criterio #3):** `@fme/pipeline` produce la prueba híbrida de 10 s con los tres motores reales y las fuentes enlazadas en el proyecto (FDN-042c).
- Audio y sincronía A/V en la composición, con desfase medido de 0 ms (FDN-074a); `preview.render` real en MCP y CLI (FDN-080b); pruebas de seguridad y regresión (FDN-073a).
- `npm test` 215 pass + 12 skip + 3 TODO (endurecimientos señalados por FDN-073a).
- FORGEX Stack instalado y verificado en el entorno de preparación (ver la bitácora del 2026-11-22). Cada persona debe instalarlo en su máquina.

## Qué NO existe todavía

- Ni adaptador FreeCut (FDN-041), ni composición de rutas A/B/C (FDN-042), ni MCP, ni CLI.

## Ejecución distribuida (FDN)

Tres equipos trabajan en paralelo (Claude, Antigravity y Codex) según [`coordinacion/`](coordinacion/README.md). Tanda 1:
- **Claude:** FDN-010 (Revideo), FDN-021 (esquema) y FDN-004 (benchmarks).
- **Codex:** FDN-011 (Blender) y FDN-022 (tiempo).
- **Antigravity:** FDN-012 (FreeCut) y FDN-030 (registro).

Detalle: [`coordinacion/CURRENT_SPRINT.md`](coordinacion/CURRENT_SPRINT.md).

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
| 2026-11-22 | Red FDN: carpeta operativa local y plan versionado; A0 integrador; `develop` local (propuesta; plan aprobado) | ADR-0007 |
| 2026-11-22 | Validación en runtime con Zod 4 (propuesta) | ADR-0008 |
| 2026-11-23 | Relevo entre equipos: detección por latido (60 min) + declaración del usuario; A0 propone, el usuario aprueba; rama nueva desde la punta; el relevista termina; si cae A0, se pausa la integración y el usuario elige un suplente (Sol, Neon o Astra) | ADR-0013 |
| 2026-11-23 | Modo ausencia del usuario: presencia en cada mensaje; escalones a 2, 4 y 6 h (solo lo asignado → solo lo en curso → punto de control y parada); sin relevos falsos; cola de decisiones con resumen y revisión una a una al volver; A0 integra solo lo verde | ADR-0014 |
