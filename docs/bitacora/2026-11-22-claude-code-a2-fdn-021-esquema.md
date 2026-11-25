# 2026-11-22 · claude-code-a2 · FDN-021 Esquema Zod, validación y serialización

## Hecho
- `packages/project/src/schema.ts`: esquemas Zod estrictos (claves desconocidas = error), `parseProject` (`{ok,value}` o `errors[{path,code,message}]`), `unknown-schema-version` como error propio, `projectJsonSchema()` con `z.toJSONSchema`.
- `packages/project/src/serialize.ts`: `serialize` (valida, claves ordenadas, 2 espacios, `\n` final) y `deserialize` (`invalid-json` o errores de `parseProject`).
- Tests: `schema.test.ts` (tipos, rutas, versión, fotogramas, fps, claves extra, JSON Schema) y `serialize.test.ts` (round-trip, orden, errores).
- Dependencia `zod@4.6.7` (`--save-exact`, MIT, registro https://registry.npmjs.org, ~6 MB desempaquetado), autorizada por el usuario.
- `packages/project/tsconfig.json`: añadido `rewriteRelativeImportExtensions` (ver pendiente).

## Verificado
- `npm run typecheck` → sin errores. `npm test` → 18 pass, 0 fail.

## Decisiones / avisos
- Zod infiere `?: T | undefined`; `index.ts` usa `?: T` (`exactOptionalPropertyTypes`). El test de tipos exige: Project asignable al tipo Zod + equivalencia estructural normalizada. La asignabilidad inversa estricta no se cumple; `parseProject` usa un cast.
- `schema.ts` duplica `SCHEMA_VERSION = 1` (evita el ciclo cuando `index.ts` re-exporte `schema.ts`); un test comprueba que coincide.
- Reglas añadidas por mí: `width`/`height` enteros > 0, `seed` entero, valores finitos, ids no vacíos. No hay validación referencial (assetId, ids únicos).

## Pendiente
- A0: re-exportar desde `index.ts`; registrar Zod en `docs/licencias-seguridad.md`; revisar el cambio en `packages/project/tsconfig.json` (fuera de mi ficha, necesario para que los imports `.ts` de `src` compilen con `tsc -b` y corran con Node).
