# ADR-0015: Los `RenderArtifact` viven en el proyecto y se enlazan por id (`schemaVersion` 3)

- **Estado:** propuesta (2026-11-23) · **Dueño:** A0 (redacta A2, FDN-042b) · **Revisable:** al cerrar la Fase 4 (FDN-043)

## Contexto

`ExternalProjectRef.renderArtifactId` (§7.1) apunta al artefacto derivado de un documento nativo, pero el `Project` no guarda ningún `RenderArtifact`: el id no apunta a nada. FDN-033 lo comprobó: dejó los artefactos en `workDir/artifacts.json`, fuera del proyecto. Sin catálogo, el proyecto no puede decir qué archivo generado procede de qué capa, con qué adaptador y con qué hash de dependencias, y el criterio #2 (guardar y abrir sin pérdida) no cubre la trazabilidad de §2.4.

## Decisión

1. **Campo nuevo y opcional** en `Project`: `artifacts?: RenderArtifact[]` (el tipo ya existe en `index.ts`). Un catálogo separado, igual que `assets`, y las capas lo referencian por id.
2. **Validación referencial** en el esquema:
   - cada `layer.externalProject.renderArtifactId` debe existir en `artifacts`; un id colgante da un error en la ruta `sequences[i].scenes[j].layers[k].externalProject.renderArtifactId`;
   - los `id` de `artifacts` son únicos (error en `artifacts[n].id`).
3. **`SCHEMA_VERSION` pasa a 3.** Migración **v2 → v3**:
   - sube la versión y no añade `artifacts` (opcional);
   - **elimina los `renderArtifactId` que existan**, porque en v2 no había catálogo y por tanto apuntaban a nada; conservarlos haría fallar la validación referencial de documentos antiguos. Es la única pérdida, y solo de un puntero que no era resoluble;
   - se conservan v0 → v1 → v2.
4. **Fixtures:** las v2 se conservan en `packages/project/test/fixtures-v2/` como entrada de migración; las vigentes pasan a v3. La híbrida lleva dos artefactos ilustrativos (`render-3d` y `render-titulo`) enlazados desde las capas de Blender y Revideo.
5. **Cambio de contrato:** `index.ts` (`Project.artifacts`, `SCHEMA_VERSION`) es de A0; `docs/contratos.md` se actualiza vía A0.

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| Artefactos fuera del proyecto (`artifacts.json` por job) | El proyecto no se autodescribe; se pierde la trazabilidad al guardar y abrir |
| `artifacts` obligatorio | Cambio innecesario para consumidores y fixtures que no generan artefactos |
| Conservar los `renderArtifactId` colgantes al migrar | La validación referencial rechazaría proyectos v2 válidos |
| Referencia en `Layer` en lugar de `externalProject` | `renderArtifactId` ya existe en `ExternalProjectRef` (§7.1) |

## Consecuencias

- **Positivas:** trazabilidad dentro del proyecto; los adaptadores pueden registrar sus salidas; la caché puede validar procedencia.
- **Negativas:** los proyectos v2 con un `renderArtifactId` pierden ese puntero al migrar; quien escriba artefactos debe mantener la integridad referencial (el esquema la exige).
- **Seguimiento:** que los adaptadores (FDN-042a) escriban `artifacts` y el enlace al guardar, y que FDN-043 compruebe el flujo de extremo a extremo.

## Evidencia

Pendiente: tests de FDN-042b (fixtures v0, v1 y v2 migran a v3; id colgante con ruta; round-trip byte a byte).
