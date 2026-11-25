# ADR-0008: Validar el proyecto universal en runtime con Zod 4

- **Estado:** propuesta (2026-11-22) · **Dueño:** A0 · **Revisable:** al cerrar la Fase 2 (FDN-025)

## Contexto

La Fase 2 exige validación en runtime, esquema JSON y serialización con `schemaVersion` ([roadmap](../roadmap.md#fase-2-modelo-universal)). Las candidatas que menciona la spec son Zod o un validador de JSON Schema. Los tipos actuales de `packages/project/src/index.ts` son la referencia (Anexo A).

## Decisión

- Usar **Zod 4** (licencia MIT) como única fuente del esquema en `packages/project/src/schema.ts`. Los tipos TS se derivan con `z.infer` y deben ser compatibles con los actuales, comprobado con un test de tipos.
- El **JSON Schema** publicado se genera con `z.toJSONSchema()` de Zod 4 y no se escribe a mano.
- La versión exacta se fija con `--save-exact` en FDN-021 y se registra en `docs/licencias-seguridad.md`.
- La deserialización valida, rechaza un `schemaVersion` desconocido con un error estructurado y aplica migraciones (FDN-024).

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| Ajv + JSON Schema escrito a mano | Dos fuentes de verdad (tipos TS y esquema) que pueden divergir |
| TypeBox | Viable, pero con menos ecosistema; Zod 4 cubre también la generación de JSON Schema |
| Validación manual | Propensa a errores; no genera esquema |

## Consecuencias

- **Positivas:** una sola fuente de verdad; errores legibles para los agentes (ruta y mensaje).
- **Negativas:** primera dependencia de runtime de `@fme/project`.
- **Seguimiento:** que el esquema generado no dependa de campos internos de FreeCut, Revideo ni Blender (regla 5 de AGENTS.md).

## Evidencia

Pendiente: la aporta FDN-021 (tests de validación y round-trip).
