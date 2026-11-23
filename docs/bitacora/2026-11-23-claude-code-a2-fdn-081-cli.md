# 2026-11-23 · claude-code-a2 · FDN-081 CLI de consola (`@fme/cli`)

## Hecho
- `apps/cli/` (`src/cli.ts`, `main.ts`, `index.ts`, `package.json`, `tsconfig.json`, `tsconfig.test.json`, `test/cli.test.ts`). Sin dependencias externas nuevas (`node:util` `parseArgs`); dependencias de workspace: `@fme/project`, `@fme/connectors`, `@fme/router`, `@fme/adapter-revideo`.
- Comandos: `project validate <archivo>` (migra en memoria e indica `migratedFrom`), `project migrate <archivo> [--out]`, `connectors list [--capability --accepts --produces]`, `route plan <archivo> --layer <id>` y `job run <archivo> --layer <id> --out <dir> [--alpha --timeout]`. `--json` en todos.
- Códigos de salida: 0 correcto, 1 error (proyecto inválido, capa inexistente, sin conector, job fallido), 2 uso incorrecto, 3 motor no disponible (el job no se ejecuta).
- Misma API que `apps/mcp` (deserialize, registro de conectores, `planRoute`, adaptadores, `checkAdapterResult`); no importa de `@fme/mcp` porque este solo exporta el servidor. La pequeña lógica compartida (resumen del proyecto, directorio de job) está duplicada en ambos: candidata a un paquete común si crece.
- `FME_REVIDEO_ENGINE_DIR` permite apuntar a otra carpeta del motor de Revideo.

## Verificado
- `npx tsc -b apps/cli` y `tsc -p apps/cli/tsconfig.test.json` sin errores. `node --test apps/cli/test/cli.test.ts`: 8 pass, 1 skip. Raíz: `npm run typecheck` sin errores; `npm test` 139 pass, 0 fail, 7 skipped.
- **No verificado:** `job run` con render real. El test hace skip con motivo («El motor no está instalado en …/runtime/engines/revideo: ejecuta npm ci»); en esta máquina no hay motor instalado y instalarlo exige descargas que no pedí. Sí está probado el flujo previo (ruta, capa, `NO_CONNECTOR`, uso incorrecto).

## Pendiente para A0
- Añadir `apps/cli` a las referencias de `tsconfig.json`, `apps/cli/tsconfig.test.json` al typecheck y regenerar `package-lock.json` (nueva dependencia de workspace).
- Ejecutar `job run` con el motor instalado para quitar el skip.
