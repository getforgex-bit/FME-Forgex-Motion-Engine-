# 2026-11-23 · FDN-041 Adaptador FreeCut nivel A (`@fme/adapter-freecut`)

- **Autor:** `antigravity-b1` (Antigravity, Equipo B) · **Worktree:** `C:\Users\bogex\Documents\Forgex\FME-wt\antigravity` · **Rama:** `fdn/FDN-041-adapter-freecut` · **Fase:** 4

## Objetivo
Implementar el adaptador real nivel A de FreeCut (`FDN-041`) conforme a `ConnectorAdapter` (ADR-0011), ADR-0012 (`Layer.text`) y aislamiento temporal en `ctx.workDir` (FDN-034), envolviendo `headless/lib/*` de `C:\Users\bogex\Documents\Forgex\FME-ext\freecut` sin modificar el repositorio upstream.

## Hecho
- `runtime/engines/freecut/cli.mjs` y `runtime/engines/freecut/README.md`: wrapper CLI ESM puro Node sin dependencias nuevas (`--version` leyendo `0.0.0+<sha>` y `--job` ejecutando `headless/lib/*` + `dist/headless.html` en workspace contenido dentro de `--work-dir`, soportando capas `video`, `audio`, `image` y `text` con `zIndex` y `sourceInFrame`, y selección configurable de navegador `auto|msedge|chrome|playwright`).
- `packages/adapters/freecut/package.json`, `tsconfig.json`, `.gitignore`: workspace `@fme/adapter-freecut` con referencias a `@fme/project`, `@fme/connectors` y `@fme/runtime-workers`.
- `packages/adapters/freecut/src/cards.ts`: tarjetas `simple` (`id: 'adapter.freecut'`, `executor: 'cli'`, `capabilities` con `'edit.export'`) y `advanced` fiel a FDN-012 (`alpha: 'no'`, `headlessCli: 'yes'`, `deterministicContainer: 'no'`, `editability: 'native'`, `licenseReview: 'pending'`).
- `packages/adapters/freecut/src/mapping.ts`: `buildFreeCutJob`, `buildDirectClipJob`, `findScene` y `MappingError` validando proyectos v1 (migrados) y v2 (`layer.text` ADR-0012), contención de assets sin path traversal y ordenación determinista por `zIndex`.
- `packages/adapters/freecut/src/adapter.ts` y `src/index.ts`: `FreeCutAdapter` implementando `probe()` y `run(job, ctx)` usando `deserialize` (v1/v2), `runIsolated` (`shell: false`, `TEMP`/`TMP`/`TMPDIR` dentro de `ctx.workDir`), cálculo de `sha256` del MP4 y `contentSha256` vía `ffmpeg -f hash -hash sha256 -` (`yuv420p`) sin shell.
- `packages/adapters/freecut/test/workroot.ts`, `mapping.test.ts` y `adapter.integration.test.ts`: pruebas unitarias (5 casos) e integración real ejecutando 2 jobs independientes con FreeCut sobre escena v2 (`video` + `layer.text`) verificados con `checkAdapterResult`, `probeMedia`, `contentSha256` idéntico y limpieza de `os.tmpdir()`.

## Verificado
| Comando | Resultado real observado |
|---|---|
| `npm.cmd ci --offline` (temporalmente ocultando el nuevo `package.json` sin lockfile) | Exit `0`: restaurados enlaces de workspace en `node_modules` sin descargas de red |
| `npx.cmd tsc -b packages/adapters/freecut` | Exit `0` |
| `npm.cmd run typecheck` (`tsc -b && tsc -p tsconfig.test.json`) | Exit `0` |
| `node --test packages/adapters/freecut/test/*.test.ts` | Exit `0` (`tests 7`, `pass 7`, `fail 0`, `skipped 0`, `17112.92ms`); `contentSha256=93cb5c72ebe5dc415606ac993f96e29b48c47f3e99de8eceb5cab0b064dfa5e5` idéntico en ambos jobs; `probeMedia`: `fps=30, frames=60, 1280x720, yuv420p, hasAlpha=false, audio=true` |
| `npm.cmd test` | Exit `0` (`tests 127`, `suites 4`, `pass 121`, `fail 0`, `skipped 6` [integración `revideo` sin motor en este worktree], `17890.96ms`) |
| `codegraph.cmd sync` + `codegraph.cmd affected ...` | `2` syncs (`60` arch/`1,080` nodos previo + `8` arch/`177` nodos posterior); `1` `affected` (`9` archivos de test afectados) |
| `graphify update .` | Reconstruido: `1488` nodos, `2554` aristas, `128` comunidades |

## Pendiente
- Añadir `{ "path": "./packages/adapters/freecut" }` en `references` del `tsconfig.json` raíz y regenerar `package-lock.json` por A0 al integrar en `develop`.
- Revisión por B0 antes de emitir el evento `REVIEW` a `claude-code-a0`.
