# 2026-11-23 · FDN-071 · Perfil de previsualización

- **Sesión:** `codex-c1-r4` (GPT-6.2 Sol).
- **Rama:** `fdn/FDN-071-render-plan`.
- **Alcance:** `selectPreviewProfile`, pruebas del perfil y esta bitácora.

## Hecho

- El perfil acota el lado largo a la mitad de la resolución original y redondea el otro lado al píxel más cercano. Busca el tamaño máximo que cabe con una muestra y luego selecciona entre 8, 4, 2 y 1 muestras para ese tamaño.
- La estimación incluye 256 MiB de reserva fija, 64 bytes por píxel de buffers y 16 bytes por píxel y muestra de margen de trabajo. Las operaciones de área y presupuesto usan aritmética entera. Las entradas inválidas y un presupuesto menor al mínimo de 1 × 1 provocan `RangeError`.

## Verificado

| Presupuesto para 1920 × 1080 | Resolución | Muestras | VRAM estimada (bytes) |
|---:|---:|---:|---:|
| 4096 MiB (4 GiB) | 960 × 540 | 8 | 367 968 256 |
| 310 MiB | 960 × 540 | 2 | 318 201 856 |
| 280 MiB | 747 × 420 | 1 | 293 534 656 |

- `node --test packages/render-plan/test/preview.test.ts` → 4/4. Incluye determinismo, orientación, dimensiones máximas seguras y el mínimo exacto de un píxel.
- `tsc --strict --noEmit --module NodeNext --target ES2022 --allowImportingTsExtensions --types node` sobre el perfil y sus pruebas → correcto.
- `codegraph sync` y `codegraph affected packages/render-plan/src/preview.ts packages/render-plan/test/preview.test.ts` → índice actualizado, detectó `preview.test.ts`. Graphify no fue necesario para la política independiente. GitNexus no tiene este worktree indexado.

## Pendiente

- C2 reexporta el perfil en el workspace y ejecuta la suite conjunta.
- El presupuesto de 4 GiB es la referencia de planificación. La VRAM real depende de la escena, el renderizador y la memoria ya ocupada. Esta parte no ejecuta motores.
