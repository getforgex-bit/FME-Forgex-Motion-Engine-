# 2026-11-23 · FDN-071 Render por segmentos y previsualización

- **Sesión** `codex-c2-r4` · **Rama** `fdn/FDN-071-render-plan`

## Hecho

- El planificador divide las capas de una escena en ventanas semiabiertas y genera claves deterministas con `dependencyHash`. Las claves consideran los datos de cada capa, su asset, la configuración efectiva de preview y las versiones de adaptador.
- `affectedSegments` usa `DependencyGraph` para localizar los segmentos derivados de cambios de capa, asset o adaptador. Una guía activa aporta dependencias entre ventanas superpuestas.
- El perfil de C1 (`7c7ce39)) adapta resolución y muestras a un presupuesto declarado. Para la fixture de 1920 × 1080 con 4 GiB propone 960 × 540, 8 muestras y 367 968 256 bytes estimados.
- La rama incorporó FDN-028 mediante el merge `900daec`. La comprobación de invalidación modifica el texto real del título en la fixture v2.

## Verificado

| Comando | Resultado |
|---|---|
| `npm run typecheck` y `tsc -b packages/render-plan` | OK. Los enlaces de workspace requeridos se restauraron desde caché de npm sin red ni cambio al lockfile. |
| `node --test packages/render-plan/test/*.test.ts` | 12/12. La escena híbrida genera 19 segmentos de hasta 60 fotogramas. Editar el título cambia solo `[180, 240)` y `[240, 300)`. |
| Importación de `@fme/render-plan` desde Node | Cargan `planSceneRender`, `affectedSegments` y `selectPreviewProfile`. |
| `npm test` | 113 pasan, 4 omisiones por motor Revideo ausente y 0 fallos. |
| `codegraph sync` y `codegraph affected` | Índice al día. Detecta `preview.test.ts` y `render-plan.test.ts`. |

## Pendiente

- Integración de A0, con referencia y lockfile raíz del workspace.
- El presupuesto de VRAM se verifica contra una estimación. El consumo real depende del motor, la escena y otros procesos.
