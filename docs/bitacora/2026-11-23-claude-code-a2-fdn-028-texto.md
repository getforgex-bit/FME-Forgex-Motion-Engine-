# 2026-11-23 · claude-code-a2 · FDN-028 Contenido de capas de texto (schemaVersion 2)

## Hecho
- ADR-0012 (propuesta): `Layer.text?: { content, fontFamily?, fontSize?, color? }`, solo con `kind === 'text'`; `SCHEMA_VERSION` 2.
- `schema.ts`: `textContentSchema` y `superRefine` en `layerSchema` (text en capa no `text` → error `custom` en `…layers[i].text`); `SCHEMA_VERSION` local = 2.
- `migrate.ts`: migración v1→v2 (solo sube la versión); v0→v1 conservada y encadenada.
- Fixtures: v1 conservadas en `test/fixtures-v1/` (mínima, 29,97 e híbrida); vigentes a v2; híbrida con el título «Forgex Motion Engine» (Inter, 96, #ffffff). Tests en `schema.test.ts`, `fixtures.test.ts`, `serialize.test.ts`, `smoke.test.ts`.
- **Cambio de `index.ts` aplicado localmente, pendiente de A0** (`TextContent`, `Layer.text`, `SCHEMA_VERSION = 2`).

## Verificado
- `codegraph impact parseProject` (23 símbolos) y `Layer` (24): los consumidores (art-direction, adapter-revideo, cache) usan `SCHEMA_VERSION`, no el literal 1.
- `npm run typecheck` sin errores; `npm test`: 101 pass, 0 fail (4 omitidos). Una primera pasada falló en `packages/cache` («escrituras concurrentes»); aislado da 8/8 y la repetición completa pasó: parece intermitente bajo carga, ajeno a este cambio.

## Pendiente
- A0: aplicar `index.ts`, actualizar `docs/contratos.md`, decidir el ADR. A1 (FDN-032b): usar `layer.text` en el adaptador.
- La migración v1→v2 no rechaza un `text` en un documento v1; lo valida el esquema v2.
