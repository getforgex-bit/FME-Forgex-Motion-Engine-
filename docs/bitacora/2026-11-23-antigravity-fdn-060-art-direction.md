# 2026-11-23 · FDN-060 Dirección artística: perfiles de estilo y reglas deterministas

- **Autores:** `antigravity-b2` (`packages/art-direction/src/**`, `package.json`, `tsconfig.json`) y `antigravity-b1` (`packages/art-direction/test/art-direction.test.ts`, bitácora), coordinados por `antigravity-b0`
- **Worktree / Rama:** `C:\Users\bogex\Documents\Forgex\FME-wt\antigravity-2` · `fdn/FDN-060-art-direction`
- **Fase:** 6 (adelantada como tarea `Libre` sin dependencias bloqueantes tras la integración de FDN-021)

## Objetivo
Implementar el paquete `@fme/art-direction` (`FDN-060`) con perfiles de estilo validados con Zod 4, reglas de dirección de animación deterministas (sin IA) para los gradientes `expression` e `integration` (§7 y §8 de `docs/vision.md`), y aplicación no destructiva sobre `Project` (`@fme/project`).

## Hecho
- `packages/art-direction/package.json` y `packages/art-direction/tsconfig.json`: configuración del paquete `@fme/art-direction` con referencia a `../project` y `rewriteRelativeImportExtensions: true` (sin modificar `package.json` ni `tsconfig.json` raíz, respetando el reclamo activo de `codex-c1-r2`).
- `packages/art-direction/src/schema.ts`: esquemas `z.strictObject` (`ART_DIRECTION_SCHEMA_VERSION = 1`, `STYLE_FAMILIES`, `ANIMATION_PRINCIPLES` —14 principios de `vision.md` §8—, `GRADIENT_CHANNELS`, `ruleTargetSchema`, `animationRuleSchema`, `coherenceConfigSchema`, `styleProfileSchema`, `artDirectionPlanSchema`), `parseStyleProfile`, `parseArtDirectionPlan` y `styleProfileJsonSchema`.
- `packages/art-direction/src/rules.ts`: PRNG determinista `fnv1a32` + `mulberry32`, filtrado `ruleMatchesLayer`, evaluación determinista `evaluateLayerChannel` con keyframes enteros estrictamente crecientes en `[0, durationFrames]` y valores en `[0, 1]` (incluyendo capas de 0 y 1 frame), y 3 presets en `STYLE_PRESETS` (`minimalGeometric`, `editorialHandmade`, `cinematicHybrid`).
- `packages/art-direction/src/apply.ts`: `ArtDirectionValidationError`, `buildArtDirectionPlan` y `applyArtDirection` con clonado profundo no destructivo y opción `overwriteExisting` (por defecto `true`).
- `packages/art-direction/src/index.ts`: API pública re-exportada.
- `packages/art-direction/test/art-direction.test.ts`: 7 pruebas integrales con `node:test` cubriendo validación Zod/JSON Schema, rechazo de `schemaVersion` desconocida y campos extra, determinismo byte a byte, sensibilidad e invariancia al `seed` (`maxVariation > 0` vs `0`), invariantes sobre los 3 presets y 14 principios (0 y 1 frame), filtrado por `RuleTarget` / `enabled: false`, no destructividad, `overwriteExisting: false` y compatibilidad con `parseProject` + `serialize`/`deserialize`.

## Verificado
| Comando | Resultado real |
|---|---|
| `npx.cmd tsc -b packages/art-direction` | Exit `0` |
| `npm.cmd run typecheck` (`tsc -b && tsc -p tsconfig.test.json`) | Exit `0` |
| `npm.cmd test` | Exit `0` (`tests 37`, `suites 1`, `pass 37`, `fail 0`, `duration_ms 1216.6119`; `7/7` en `@fme/art-direction (FDN-060)` + `30` existentes) |
| `codegraph.cmd sync` + `codegraph.cmd affected ...` | Sync: `5` archivos, `+114` nodos en `1.2s`, `302` refs resueltas; Affected: `packages/art-direction/test/art-direction.test.ts` (B2 también ejecutó `1 sync` + `1 context` previos) |
| `graphify update .` | Reconstruido: `790` nodos, `1103` aristas, `68` comunidades |

## Pendiente
- Añadir `{ "path": "./packages/art-direction" }` en el `tsconfig.json` de la raíz por parte de A0 al integrar `FDN-060` en `develop` (no editado aquí por estar reclamado por `codex-c1-r2` para `FDN-031`).
- Revisión por B0 y envío del evento `REVIEW` a `claude-code-a0`.
