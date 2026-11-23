# 2026-11-23 · FDN-032b (layer.text) y FDN-034b (tests en paralelo)

- **Autor:** claude-code-a1 (Sonnet 5.5) · **Rama:** fdn/FDN-032b-034b-revideo · **Fase:** 3

## FDN-032b
- `mapping.ts`: el título sale de `layer.text` (`content`, `fontFamily`, `fontSize`, `color`). Precedencia: `requirements.text/fontSize/fill` (sobrescritura explícita, documentada) > `layer.text` > nombre del proyecto (compatibilidad con capas sin texto).
- Motor: `scene.tsx` aplica `fontFamily` (con `sans-serif` de reserva).
- Comprobado a ojo en el fotograma 60 del MP4: se lee «Forgex Motion Engine». `Inter` no está instalada en esta máquina; la fuente real no se verificó.

## FDN-034b
- `test/workroot.ts`: raíz propia `packages/adapters/revideo/.test-work/` (ignorada por git); todos los `workDir` y los logs de `probe()` salen de ahí (`RevideoAdapterOptions.probeWorkDir`, nueva).
- `tmp-workdir` ya no ve los directorios de otros tests. Además el patrón vigilado excluye `fme-`, porque otros procesos (p. ej. la integración de A0 con código anterior) crean `fme-*` en el mismo temporal.

## Verificado
| Comando | Resultado real |
|---|---|
| `node --test packages/adapters/revideo/test/*.integration.test.ts` (paralelo, motor real) ×3 con el arreglo final | 8/8, 8/8, 8/8 |
| ídem, un intento previo (antes de quitar `fme-` del patrón) | 7/8: `tmp-workdir` vio `fme-revideo-it-*` en `%TEMP%` que no eran de este árbol (origen: ajeno; no lo pude demostrar) |
| `npx tsc -b packages/adapters/revideo`, `npx tsc -p tsconfig.test.json` | sin errores |
| `npm test` (raíz) | 115/115 |

## Pendiente
- Un proceso ajeno que renderice a la vez con nombres revideo/vite/puppeteer/chrome en el temporal aún podría provocar un falso fallo de `tmp-workdir`.
- `.test-work/` no se limpia al terminar.
