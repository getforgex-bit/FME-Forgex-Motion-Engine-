# Roadmap y objetivos

> Basado en el plan de ejecución de la especificación v0.1 (§19, §20 y §25).
> **Sin fechas comprometidas:** la spec deja el "calendario realista" como **POR VALIDAR** (§21.3). Cada horizonte se cierra por **criterios verificables**, no por calendario. Tras cerrar la Fase 1, se añadirán estimaciones basadas en datos reales.

## Resumen

| Horizonte | Fases | Resultado medible al cerrar |
|---|---|---|
| **Corto plazo** | 0 → 3 | Las 3 herramientas base verificadas, el proyecto universal persistente y el primer adaptador ejecutando un job de extremo a extremo |
| **Mediano plazo** | 4 → 7 | **Prueba híbrida de 10 s superada** con los 8 criterios de aceptación y un servidor MCP mínimo operativo |
| **Largo plazo** | 8+ | Catálogo ampliado según valor demostrado, rendimiento nativo donde se mida, licencias auditadas y FME usable en producción por FORGEX MEDIA |

Orden de construcción (spec §19.1): **verificar software → archivo universal → contrato de conectores y registro → tres adaptadores → enrutamiento, dirección artística y pruebas.** Así se evita diseñar contra APIs que no existen.

---

## Corto plazo: base verificable (Fases 0–3)

### Fase 0: Especificar ✅ (cerrada al preparar este repo)
- [x] Especificación v0.1 congelada e incorporada al repo (`docs/especificacion/`).
- [x] Documentación navegable, roadmap, riesgos y glosario.
- [x] Contratos TypeScript propuestos (`packages/project`, `packages/connectors`) que compilan.
- [x] Sistema común de memoria y registro (FORGEX Stack + ADR + bitácora + changelog).
- **Condición de cierre (spec):** especificación FME 0.1 aprobada → **pendiente de la aprobación explícita del usuario.**

### Fase 1: Verificar el software base
**Objetivo:** demostrar que FreeCut, Revideo y Blender funcionan en el entorno de referencia antes de diseñar sobre ellos.

- [ ] Fijar versiones exactas (commit/tag) de FreeCut, Revideo y Blender, y de FFmpeg.
- [ ] Revisar la actividad del proyecto upstream (releases, issues) antes de fijar cada versión.
- [ ] Prueba repetible por herramienta (script en `examples/` o `runtime/`):
  - FreeCut: importar un clip y exportar un MP4 (o documentar qué API/flujo existe realmente).
  - Revideo: renderizar una escena TS de 3 s a MP4 y, si es posible, una secuencia PNG con alpha.
  - Blender: `blender -b` + script `bpy` que renderice una secuencia PNG RGBA con cámara animada.
- [ ] Registrar para cada una: comando, versión, salida, tiempo, uso de VRAM/RAM y limitaciones (alpha, FPS, timebase).
- [ ] Rellenar la tarjeta simple **real** de cada herramienta con lo verificado (`yes`/`no`/`unknown`).
- **Cierre:** tres pruebas individuales repetibles (criterio de éxito #1).
- **Métrica:** 3/3 herramientas con prueba reproducible documentada en la bitácora.

### Fase 2: Modelo universal
**Objetivo:** que `Project` sea la fuente de verdad persistente.

- [x] Esquema JSON (generado o escrito) a partir de los tipos de `packages/project`. → `projectJsonSchema()` generado desde Zod (FDN-021).
- [x] Validación en runtime (elegir la librería mediante ADR; candidatas: Zod o un validador de JSON Schema). → Zod 4.6.7, ADR-0008, `parseProject` estricto (FDN-021).
- [x] Serialización/deserialización con `schemaVersion` y una primera migración de ejemplo. → `serialize`/`deserialize` deterministas; `migrateToCurrent` v0→v1 conectado a `deserialize` (FDN-021, FDN-024, FDN-026).
- [x] Fixtures de proyecto (incluido el de la prueba híbrida) y tests de ida y vuelta. → `examples/prueba-hibrida-10s/project.fme.json`, `minima`, `ntsc-2997` y `fixtures-v0` (FDN-023).
- [x] Tiempo en fotogramas enteros con FPS racional; tests de no deriva (p. ej. 30000/1001). → `time.ts`, 1 h de fotogramas a 5 tasas sin error, timecode drop-frame (FDN-022).
- **Cierre:** guardar/abrir sin perder estado (criterio #2). ✅ **Cerrada el 2026-11-23** (FDN-025; evidencia en la bitácora de A0).
- **Métrica:** el 100 % de las fixtures pasan el round-trip y la validación. → 4/4 fixtures; `node --test packages/project/test/*.test.ts` 36/36.

### Fase 3: Conectores
**Objetivo:** contrato 0.1 operativo con registro y un primer adaptador.

- [ ] Registro dinámico: alta y baja de conectores, y consulta de tarjetas simples y avanzadas por secciones.
- [ ] Estados `soportado` / `no soportado` / `no comprobado` y el comportamiento ante `unknown`.
- [ ] Primer adaptador (recomendado: **Revideo**, porque es TypeScript nativo y no requiere integrar el editor) con `JobRequest` → `JobResult` reales.
- [ ] Ejecución aislada: directorio de trabajo propio, timeout y validación de rutas.
- **Cierre:** descubrimiento y job de extremo a extremo.
- **Métrica:** un job real produce un artefacto con procedencia (herramienta, versión, parámetros y hash).

---

## Mediano plazo: prueba híbrida de 10 s (Fases 4–7)

### Fase 4: Integración real
- [ ] Adaptadores de FreeCut y Blender (nivel A: archivo/CLI; nivel B donde se pueda).
- [ ] Rutas A, B y C del catálogo (Revideo→FreeCut, Blender→FreeCut, originales→FreeCut).
- [ ] `ExternalProjectRef` y `RenderArtifact` enlazados en el proyecto.
- **Cierre:** vídeo final con fuentes enlazadas (criterio #3).

### Fase 5: Enrutador
- [ ] Modos automático, manual e híbrido.
- [ ] Secuencia de decisión de 8 pasos (ver [`arquitectura.md`](arquitectura.md#3-enrutador-inteligente)) con justificación registrada.
- [ ] Restricciones duras (compatibilidad y permisos), límites y rutas alternativas (fallbacks).
- [ ] Medir los tokens consumidos por la exploración (tarjeta simple frente a avanzada).
- **Cierre:** selección justificada y verificable (criterios #4 y #5).

### Fase 6: Dirección artística
- [ ] Perfiles de estilo editables y reglas de animación como procedimientos.
- [ ] Las 5 técnicas y los 2 gradientes, aplicados y animados con curvas.
- [ ] Mapeo de gradientes a operaciones concretas por backend.
- **Cierre:** cambios reales y reproducibles en la escena (criterio #6).

### Fase 7: Calidad
- [ ] Previsualización adaptativa, render por segmentos y caché con invalidación por dependencias.
- [ ] Manejo de errores (falta de VRAM, reintento seguro, backend alternativo).
- [ ] Pruebas técnicas: temporal, estética, editabilidad, enrutamiento, recursos, seguridad y regresión.
- [ ] Exportación final con audio y sincronía.
- **Cierre: prueba híbrida de 10 s superada** (criterios #7 y #8).

### Transversal en el mediano plazo
- [ ] **Servidor MCP mínimo** (`apps/mcp`) sobre la API: `project.*`, `asset.register`, `scene/layer`, `timeline.animate`, `connectors.*`, `route.plan`, `job.run`, `preview.*` y `project.export`.
- [ ] CLI de consola (`apps/cli`) para operar sin agente.
- [ ] Auditoría de licencias de las versiones fijadas (registro en [`licencias-seguridad.md`](licencias-seguridad.md)).

**Métrica del horizonte:** 8/8 criterios de aceptación con evidencia en la bitácora; prueba reproducible en la PC de referencia (RTX 3050, 4 GB de VRAM).

---

## Largo plazo: evolución y producto (Fase 8+)

Solo se integra una pieza nueva cuando **demuestra valor concreto** (spec §19, Fase 8).

| Línea | Objetivos | Disparador para empezar |
|---|---|---|
| Acabado artesanal | libmypaint + Paper.js + animación tradicional (OpenToonz); coherencia temporal del trazo | La Fase 6 muestra que el trazo de Revideo/SVG es insuficiente |
| Edición/VFX | MLT si FreeCut limita; OpenCV/SAM 2 para tracking y segmentación; Natron/OpenFX | Necesidad demostrada por un proyecto real |
| Color | OpenColorIO, pipeline EXR | Diferencias de color/alpha medidas entre motores |
| Interoperabilidad | OTIO, glTF/GLB y OpenUSD como intercambio avanzado | Clientes o flujos que lo requieran |
| Audio | whisper.cpp, pysubs2, Rhubarb, Tone.js | Producciones con voz y subtítulos |
| Rendimiento | Mover a **Rust** (NAPI-RS) las operaciones con cuello de botella **medido** | Perfil de tiempo/memoria que lo justifique |
| Forks | Fork solo tras descartar, por este orden: configuración → API/plugin → adaptador | Carencia bloqueante documentada (ADR) |
| Interfaz | UI React (React Flow para pipelines) y empaquetado Tauri | Uso por personas no técnicas |
| Escala | Render distribuido (OpenCue) y revisión (OpenRV) | Más de un equipo de render |
| Comercialización | Auditoría completa de licencias, definir la licencia de FME y empaquetado | Decisión de negocio de FORGEX MEDIA |
| Productización | Plantillas reutilizables (intros, rótulos, explainers) como producto ForgeX Media | Patrones de producción repetidos |

**Métricas de largo plazo (a definir con datos de la Fase 7):** tiempo de producción por minuto de vídeo, porcentaje de jobs exitosos sin intervención, coste por render, número de conectores mantenidos frente a su uso real.

---

## Cómo se actualiza este roadmap

- Marca ☑ solo con evidencia (entrada en `docs/bitacora/` o en un PR con los comandos ejecutados).
- Los cambios de alcance requieren un **ADR**: el alcance v0.1 está congelado.
- Al cerrar cada fase: actualiza [`STATUS.md`](../STATUS.md), [`riesgos.md`](riesgos.md), `CHANGELOG.md` y la memoria del proyecto.
