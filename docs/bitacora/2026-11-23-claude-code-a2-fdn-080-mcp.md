# 2026-11-23 · claude-code-a2 · FDN-080 Servidor MCP mínimo (`@fme/mcp`)

## Hecho
- `apps/mcp/` (workspace nuevo): `src/server.ts` (`createFmeServer`), `src/paths.ts` (`resolveInRoot`), `src/main.ts` (entrada stdio), `src/index.ts`, `tsconfig.json`, `tsconfig.test.json`, `package.json`.
- Herramientas implementadas como adaptador de la API existente: `project.create` (parseProject + serialize; guarda con `wx`, sin sobrescribir), `project.open` (deserialize con migraciones), `connectors.list`/`connectors.inspect` (ConnectorRegistry), `route.plan` (planRoute) y `job.run` (adaptador registrado; entradas validadas dentro de la raíz; `workDir` propio en `<raíz>/.fme-jobs/<jobId>`; incluye `checkAdapterResult`).
- `preview.render`, `preview.inspect` y `project.export`: error estructurado `NOT_IMPLEMENTED` (no se simulan).
- Rutas: dentro de la raíz configurada (`--root` o `FME_MCP_ROOT`), también tras seguir enlaces simbólicos; solo rutas locales o `file:`. Sin ejecución arbitraria. `main.ts` no registra adaptadores salvo `FME_MCP_ADAPTERS=revideo`.
- Test `apps/mcp/test/mcp.test.ts` (11): cliente del SDK por stdio; lista de herramientas; `project.open` + `connectors.list` + `route.plan` sobre la fixture híbrida; `NOT_IMPLEMENTED`; rutas fuera de la raíz; JSON inválido y versión desconocida; `job.run`; y la entrada real `main.ts`.

## Dependencias
- `@modelcontextprotocol/sdk` 1.32.2 (MIT, registro npm, ~4,5 MB desempaquetado, ~94 paquetes transitivos entre ellos ajv, express, hono y jose), instalada con `--save-exact` tras confirmación del usuario. `zod` 4.6.7 (ya registrada, FDN-021).

## Verificado
- `npx tsc -b apps/mcp` y `npx tsc -p apps/mcp/tsconfig.test.json` sin errores; `node --test apps/mcp/test/mcp.test.ts`: 11 pass. En la raíz: `npm run typecheck` sin errores; `npm test` 108 pass, 0 fail (no incluye `apps/`).
- El test de `job.run` usa un adaptador de prueba (test double, con las tarjetas reales de Revideo): comprueba el cableado, no un render. No se ha ejecutado un job real a través del MCP.

## Pendiente para A0
- Añadir `apps/*` a `workspaces`, la referencia `apps/mcp` en `tsconfig.json` y regenerar `package-lock.json` (yo lo probé con esos cambios en local y los revertí). Añadir `apps/*/test/**/*.test.ts` al script `test` y el `tsconfig.test.json` de `apps/mcp` al typecheck.
- Registrar la licencia del SDK (MIT, 1.32.2) en `docs/licencias-seguridad.md`; actualizar `apps/README.md`/`docs/contratos.md` si procede.
- Tras instalar, `dist` de los paquetes `@fme/*` debe estar compilado (`tsc -b`) para que el test arranque.
