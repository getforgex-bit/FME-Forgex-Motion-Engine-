# 2026-11-23 · FDN-040 · Compatibilidad con proyectos v1

- **Sesión** `codex-c0-r4` · **Rama** `fdn/FDN-040-adapter-blender`

## Hecho

- Integré el cambio de esquema de FDN-028, que elevó `schemaVersion` a 2.
- Al abrir un proyecto persistido, el adaptador de Blender ahora usa `deserialize`. Así aplica las migraciones de `@fme/project` antes de preparar el render.

## Verificado

- Reproducción sobre `3ee7a09`: `parseProject(JSON.parse(fixtureV1))` devolvió `unknown-schema-version`; `deserialize(fixtureV1)` devolvió un proyecto v2.
- `npm run typecheck` y `tsc -b packages/adapters/blender` pasaron.
- `npm test` salió con código 0. La regresión verificó que la fixture híbrida v1 y la vigente preparan la misma solicitud. Pasaron además las dos secuencias Blender de 150 PNG, la prueba de timeout y el GLB local. La integración de Revideo se omitió porque su motor no está instalado en este worktree.
- `git diff --check` no detectó problemas. CodeGraph relacionó la lectura del proyecto con la prueba del adaptador.

## Pendiente

- A0 integra la rama actualizada y registra el workspace en la raíz.
