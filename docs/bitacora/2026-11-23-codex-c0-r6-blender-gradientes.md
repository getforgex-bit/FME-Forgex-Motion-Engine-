# 2026-11-23 · FDN-061b · Gradientes en Blender

- **Sesión** `codex-c0-r6` · **Rama** `fdn/FDN-061b-blender-gradientes`

## Hecho

- C1 conectó el mapa existente de dirección artística con los fotogramas locales de Blender en `e5ba077`. C2 aplicó Freestyle, mezcla de material y luz de área en `841db3b`.
- Probé por separado `expression` e `integration` a 0, 1/3, 2/3 y 1, sobre un cubo con cámara y semilla fijas. Medí el efecto del contorno sobre el RGBA y la luminancia Rec.709 del material en una región central fija de 16 × 16. La región central aisló el efecto del material después de observar que el promedio de toda la figura combinaba caras con respuestas distintas.

## Verificado

| Comando | Resultado |
|---|---|
| `node --test packages/adapters/blender/test/gradients.integration.test.ts` | Blender 5.2.3, 1/1. Índice de contorno 0,00 → 1931,44 → 17784,81 → 76056,27. Luminancia central 111,97 → 115,15 → 123,07 → 132,86. |
| Verificación RGBA | Los dos trabajos repetidos conservaron los hashes cuadro a cuadro. Los extremos neutros conservaron el hash del control, con fondo transparente. |
| `npm run typecheck` y `tsc -b packages/adapters/blender` | OK. Dependencias restauradas desde caché con `npm install --offline --ignore-scripts --no-package-lock --no-audit --no-fund`. |
| `npm test` | 179 pasan, 0 fallos, 8 omitidas por motor Revideo ausente. Incluye la prueba nueva y las dos secuencias híbridas de 150 PNG. |
| `codegraph affected` y `graphify path` | CodeGraph identificó pruebas del adaptador y su dependencia de MCP. Graphify confirmó la llamada `prepareGradientOps → blenderGradientOps`. |

## Pendiente

- A0 integra la rama y actualiza el lockfile raíz por la nueva dependencia interna entre el adaptador y `@fme/art-direction`.
