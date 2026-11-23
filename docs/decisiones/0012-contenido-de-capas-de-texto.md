# ADR-0012: Contenido de las capas de texto (`Layer.text`) y `schemaVersion` 2

- **Estado:** propuesta (2026-11-23) · **Dueño:** A0 (redacta A2, FDN-028) · **Revisable:** al integrar FDN-032b (el adaptador Revideo usa `layer.text`)

## Contexto

La prueba híbrida exige tipografía cinética (6–10 s), pero `Layer` con `kind: 'text'` no tiene dónde guardar el texto. FDN-032 usó `requirements.text` del job como apaño; así el texto vive fuera del proyecto universal y no se guarda ni se versiona con él (criterio #2: guardar y abrir sin pérdida).

## Decisión

1. **Nuevo campo opcional** en `Layer`:
   ```ts
   export type TextContent = { content: string; fontFamily?: string; fontSize?: number; color?: string };
   // Layer: text?: TextContent
   ```
   - `content`: cadena no vacía (UTF-8; los saltos de línea se escriben como `\n`).
   - `fontFamily`: nombre de familia, cadena no vacía. No referencia fuentes internas de ninguna herramienta (regla 5).
   - `fontSize`: número finito > 0, en píxeles del lienzo del proyecto.
   - `color`: cadena no vacía en formato CSS (`#rrggbb`, `#rgb` o nombre); el esquema no interpreta el color.
2. **Restricción:** `text` solo es válido si `kind === 'text'`; una capa de otro tipo con `text` se rechaza (`code: custom`, ruta `…layers[i].text`). Una capa `text` sin `text` sigue siendo válida (compatibilidad con v1; el adaptador decide el valor por defecto).
3. **`SCHEMA_VERSION` pasa a 2.** Migración **v1 → v2**: solo sube la versión (el campo es opcional, no hay nada que rellenar). La migración v0 → v1 se conserva y se encadena (v0 → v1 → v2).
4. **Fixtures:** las fixtures v1 se conservan en `packages/project/test/fixtures-v1/` como entrada de migración; las vigentes pasan a v2. La híbrida lleva el texto real del título.
5. **Cambio de contrato:** `index.ts` (tipo `Layer`, `TextContent`, `SCHEMA_VERSION`) es de A0; `docs/contratos.md` se actualiza vía A0.

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| Mantener `requirements.text` en el job | El texto no se guarda en el proyecto: pérdida al guardar y abrir |
| Un `Asset` de tipo `text` | El texto no es un archivo; mezclaría catálogo y contenido, y `Asset.uri` es obligatorio |
| Canal animable `text` | Los canales son `Curve` numéricas; el texto no es numérico |
| Unión discriminada por `kind` en `Layer` | Cambio de tipo más invasivo para los consumidores (art-direction, adapter-revideo, cache) sin ganancia inmediata |
| `text` como cadena simple | No deja sitio para tipografía y color sin otro cambio de contrato |

## Consecuencias

- **Positivas:** el título de la prueba híbrida se guarda y se reabre con el proyecto; el adaptador lee `layer.text`.
- **Negativas:** `schemaVersion` 2 invalida los proyectos v1 sin migrar (se migran en `deserialize`); estilos más ricos (interlineado, peso, alineación) requerirán otra versión.
- **Seguimiento:** FDN-032b (A1) cambia el adaptador para usar `layer.text`; la validación del color/fuente queda al adaptador.

## Evidencia

Pendiente: tests de FDN-028 (migración v0/v1 → v2, rechazo de `text` en capas no `text`, round-trip byte a byte).
