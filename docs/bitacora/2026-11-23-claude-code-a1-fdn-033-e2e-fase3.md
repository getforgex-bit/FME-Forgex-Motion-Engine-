# 2026-11-23 · FDN-033 prueba de extremo a extremo de la Fase 3

- **Autor:** claude-code-a1 (Sonnet 5.5) · **Rama:** fdn/FDN-033-e2e · **Fase:** 3

## Hecho
- `packages/adapters/revideo/test/e2e.integration.test.ts`: registro (`createConnectorRegistry`) → `listSimple({capability:'render.video', accepts:'fme/project+json'})` → `inspect(['technical'])` solo si el registro lo pide (comprueba que solo devuelve `technical`) → `run` real con la capa de título de la fixture híbrida → `checkAdapterResult` → `RenderArtifact` con `dependencyHash` de `@fme/cache` → `renderArtifactId` en `layer.externalProject` → `parseProject`.
- `Project` v1 no tiene dónde guardar `RenderArtifact`: se escriben en `workDir/artifacts.json` junto a `project.linked.fme.json` (**nota para FDN-042**).
- Hash: `projectId` + segmento (capa, fps, tamaño, texto) + assets de la capa + `{pluginId, pluginVersion, engineVersion, params}` del adaptador. El test comprueba que cambia al cambiar el texto.

## Verificado
| Comando | Resultado real |
|---|---|
| `node --test packages/adapters/revideo/test/e2e.integration.test.ts` | 1 pass en ~6 s (motor real; MP4 de 120 fotogramas a 30 FPS) |
| con `FME_FFMPEG_PATH` inválido | 1 skip con el motivo |
| `npx tsc -p tsconfig.test.json` | sin errores |
| `npm test` (3 ejecuciones) | 97/97 en 2; en 1 ejecución hubo 1 fallo que **no pude identificar ni reproducir** |

## Pendiente
- El test importa `@fme/cache` sin declararlo en el `package.json` del adaptador (no toqué `package.json` ni el lockfile); A0 puede añadir la dependencia al integrar.
- Fallo intermitente sin identificar en `npm test` completo (¿concurrencia entre tests de integración que lanzan Chrome/Vite a la vez? hipótesis no verificada).
