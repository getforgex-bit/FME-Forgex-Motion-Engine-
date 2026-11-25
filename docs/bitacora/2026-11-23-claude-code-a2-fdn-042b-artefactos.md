# 2026-11-23 · claude-code-a2 · FDN-042b Artefactos enlazados en el proyecto (schemaVersion 3)

## Hecho
- ADR-0015 (propuesta): `Project.artifacts?: RenderArtifact[]`, validación referencial de `renderArtifactId`, `SCHEMA_VERSION` 3.
- `schema.ts`: `artifacts` en `projectSchema` + `superRefine`: ids únicos (`artifacts[n].id`) y `renderArtifactId` resoluble (error en `sequences[i].scenes[j].layers[k].externalProject.renderArtifactId`).
- `migrate.ts`: v2→v3 (sube la versión y **elimina los `renderArtifactId`**, que en v0–v2 no apuntaban a ningún catálogo); se conserva v0→v1→v2.
- Fixtures: v2 conservadas en `test/fixtures-v2/`, vigentes a v3; la híbrida lleva `render-3d` (Blender) y `render-titulo` (Revideo) enlazados, con valores ilustrativos (hash y URIs de ejemplo).
- **Cambio de `index.ts` aplicado localmente, pendiente de A0:** `Project.artifacts?` y `SCHEMA_VERSION = 3`.

## Ediciones fuera de la ficha (necesarias para mantener el monorepo en verde)
- `apps/mcp/src/server.ts`: `project.create` tenía `schemaVersion: 2` literal; ahora usa `SCHEMA_VERSION`.
- Tests con la versión 2 fija: `apps/mcp/test/mcp.test.ts`, `apps/cli/test/cli.test.ts`, `packages/render-plan/test/render-plan.test.ts`.
- `packages/project/test/migrate.test.ts` y `packages/adapters/blender/test/adapter.test.ts`: la fixture v0 y la híbrida v1 traen/no traen `renderArtifactId`; el resultado migrado ya no lo conserva, así que las comparaciones lo ignoran.

## Verificado
- `codegraph impact parseProject` (42 símbolos) y `deserialize` (57): consumidores revisados (cli, mcp, blender, freecut, revideo, art-direction, render-plan; cache y recovery sin dependencia de la versión). El único literal de versión fuera de `packages/project` era el de mcp.
- `npm run typecheck` sin errores; `npm test`: 184 pass, 0 fail, 8 skipped.

## Pendiente
- A0: aplicar `index.ts`, actualizar `docs/contratos.md`, aceptar el ADR. FDN-042a: los adaptadores deben escribir `artifacts` y el enlace al guardar.
- Efecto de la migración: un proyecto v2 con un `renderArtifactId` pierde ese puntero al migrar (documentado en el ADR).
