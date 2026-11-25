# 2026-11-23 · FDN-040 · Adaptador Blender

- **Sesión:** `codex-c1-r3` (GPT-6.2 Sol).
- **Rama:** `fdn/FDN-040-adapter-blender`.
- **Motor:** `21ca2b7`, de C0, en la misma rama.

## Hecho

- El workspace `@fme/adapter-blender` implementa `ConnectorAdapter` (ADR-0011). La operación `render.image-sequence` valida un proyecto FME y una capa `model3d`, admite una resolución opcional y lanza el motor mediante `runIsolated`.
- El adaptador entrega una solicitud JSON al script versionado. Los únicos modelos existentes admitidos son GLB y blend autocontenidos. Los modelos ausentes usan un primitivo y un diagnóstico de advertencia.
- Se comprueban las rutas locales dentro de las raíces autorizadas. Cada fotograma PNG tiene un SHA-256 de archivo calculado por el adaptador y un SHA-256 de píxeles RGBA decodificados, calculado por el motor. Las pruebas recomputan de forma independiente el hash de píxeles con FFmpeg.

## Verificado

| Comando o prueba | Resultado |
|---|---|
| `npm --workspace @fme/adapter-blender test` | 5/5, sin omisiones, en Windows con Blender 5.2.3 LTS. |
| Fixture híbrida de 10 s | Dos jobs de 150 PNG RGBA 256 × 144, (30/1) FPS. Mismos hashes de píxeles cuadro a cuadro, archivos validados y `checkAdapterResult` sin incumplimientos. El hash RGBA independiente verificado para el primer y último cuadro. |
| GLB local | 1 PNG con asset existente, resolución por defecto, sin advertencia de sustitución, procedencia de FPS 30000/1001 y semilla sobrescrita. |
| Timeout real | Al vencer 50 ms, Blender terminó. El PID del worker dejó de existir y se devolvió `BLENDER_TIMEOUT`. |
| `npm run typecheck` y `npm test` | OK y 76/76, sin omisiones. La suite del workspace compila el adaptador y sus tests explícitamente. |
| `codegraph sync` y `codegraph affected` | Detectó `packages/adapters/blender/test/adapter.test.ts`. |
| `git diff --cached --check` | Correcto. |

GitNexus no encontró el worktree en su índice local. Instalación de enlaces del workspace con `npm install --offline --ignore-scripts --no-package-lock --no-audit --no-fund`, sin descargas ni cambios en archivos raíz.

## Pendiente

- A0 añade la referencia TypeScript de la raíz y actualiza el lockfile al integrar los commits de motor y adaptador.
- Los modelos con dependencias externas quedan fuera del flujo de esta entrega. Blender se ejecuta con los permisos de la cuenta anfitriona.
