# 2026-11-23 · FDN-061 gradientes y técnicas → operaciones por backend

- **Autor:** claude-code-a1 (Sonnet 5.5) · **Rama:** fdn/FDN-061-gradientes · **Fase:** 6 (base del criterio #6)

## Hecho
- `packages/art-direction/src/backends/` (`revideo.ts`, `blender.ts`, `techniques.ts`, `index.ts`) + `test/backends.test.ts`; tabla de mapeo en `packages/art-direction/README.md`.
- Revideo: `expression` → contorno (grosor/opacidad) y temblor; `integration` → sombra proyectada (desenfoque/desplazamiento/opacidad). Adaptador: `sampleGradientTracks` (`mapping.ts`), `gradients` en el job; motor: `scene.tsx` los aplica por fotograma.
- Blender: solo vocabulario propuesto (no consumido ni verificado; no toqué código de Codex).

## Verificado
| Comando | Resultado real |
|---|---|
| `node --test packages/adapters/revideo/test/gradients.integration.test.ts` (motor real, 2 veces) | pass; contorno en fotogramas 0/60/90/119 = 0, 11 687, 21 018, 28 564 (sube); sombra = 45 705, 20 241, 6 047, 1 649 (baja); idéntico en ambas |
| `node --test packages/art-direction/test/backends.test.ts` | 5 pass |
| `node --test packages/adapters/revideo/test/mapping.test.ts` | 12 pass (2 nuevos) |
| `npx tsc -b`, `npx tsc -p tsconfig.test.json` | sin errores |

Hallazgo: un contorno de ~2 px con opacidad 0,25 (fotograma 30) no se detecta tras H.264 yuv420p (submuestreo de croma); por eso se miden 0, 60, 90 y 119.

## Cambios fuera de las rutas de la ficha (para que A0 los revise)
- `packages/art-direction/src/index.ts`: `export * from './backends/index.ts'` (adición; no cambia la API existente).
- `packages/adapters/revideo/package.json` (+ `@fme/art-direction`) y `tsconfig.json` (+ referencia): el adaptador depende del paquete. **El lockfile raíz necesita regenerarse** (no lo toqué).
- Para resolver `@fme/*` desde el worktree creé junctions en `node_modules/@fme` (ignorado por git); sin ellas Node resolvía los paquetes del checkout principal.

## Pendiente
- Blender: implementar la traducción en su adaptador (FDN-040b, código de Codex) y verificar con un render real.
- Técnicas `2.5d`, `3d-with-2d` y `guide3DLayerId` en Revideo: sin implementar.
- Los efectos de Revideo solo se miden en texto/SVG; no hay perfil de estilo que escoja rangos (`StyleProfile` no los parametriza).
