# 2026-11-23 · FDN-034 temporales de Revideo en workDir

- **Autor:** claude-code-a1 (Sonnet 5.5) · **Rama:** fdn/FDN-034-tmp-workdir · **Fase:** 3

## Hecho
- `adapter.ts`: el job crea `workDir/<jobId>.tmp` y lo pasa como `TEMP`/`TMP`/`TMPDIR` en el entorno explícito (Revideo `os.tmpdir()`, perfil de Chrome, Vite) y `FME_VITE_CACHE_DIR` = `<tmp>/vite-cache`.
- `runtime/engines/revideo/cli.mjs`: aplica `FME_VITE_CACHE_DIR` como `viteConfig.cacheDir` (por defecto Vite escribía en `node_modules/.vite` del motor).
- Test `tmp-workdir.integration.test.ts`: tras un job real no aparecen entradas nuevas (patrón revideo/puppeteer/vite/chrome/fme-) en `os.tmpdir()`, `node_modules/.vite` del motor no cambia (mtime) y `workDir/<jobId>.tmp` contiene los temporales.

## Verificado
| Comando | Resultado real |
|---|---|
| `node --test .../tmp-workdir.integration.test.ts` con el arreglo | 1 pass (~6 s) |
| mismo test con el arreglo revertido (`git apply -R`) | 1 fail → el test detecta la regresión |
| `npx tsc -b packages/adapters/revideo`, `npx tsc -p tsconfig.test.json` | sin errores |

## Pendiente
- `probe()` no recibe `ctx`: sus logs de `runIsolated` siguen en `<tmp del sistema>/fme-probe-revideo`.
- El `workDir/<jobId>.tmp` se conserva tras el job (inspección); limpiarlo es decisión del llamador.
- El test del temporal del sistema filtra por nombres de Revideo/Vite/Chrome: no detecta temporales con otros nombres.
