# 2026-11-23 · claude-code-a2 · FDN-026 `deserialize` con migraciones

## Hecho
- `packages/project/src/serialize.ts`: `deserialize` llama a `migrateToCurrent` (FDN-024) en vez de `parseProject`. Versión futura/desconocida mantiene `unknown-schema-version`; `serialize` sigue escribiendo la versión actual.
- `packages/project/test/serialize.test.ts`: fixture v0 → v1 válida (fps 25 → {25,1}), deserializar→serializar→deserializar estable, versiones 2/99/-1/"1"/null dan `unknown-schema-version`.

## Verificado
- `codegraph impact deserialize` antes de editar (17 símbolos; lo usan también art-direction y fixtures). `npm run typecheck` sin errores; `npm test`: 73 pass, 0 fail.
