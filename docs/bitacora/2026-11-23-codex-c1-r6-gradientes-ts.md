# 2026-11-23 · FDN-061b · Gradientes de Blender en TypeScript

- **Sesión:** `codex-c1-r6` (GPT-6.2 Sol).
- **Rama:** `fdn/FDN-061b-blender-gradientes`.

## Hecho

- El adaptador prepara `gradientOps` con un elemento por fotograma relativo de la capa y consume el mapeo existente `blenderGradientOps` de `@fme/art-direction`.
- Conserva el valor por omisión antes de la primera clave, prioriza la última clave duplicada y aplica el easing de la clave de destino. Si falta un canal aplica los valores neutros `expression=0` e `integration=1`. Omite el arreglo si faltan ambos canales.
- El README documenta el contorno y la respuesta material y lumínica que aplica el motor de C2. La referencia TypeScript y la dependencia de workspace quedan en el manifiesto local del adaptador.

## Verificado

- `node node_modules/typescript/bin/tsc -b packages/adapters/blender` y `npm run typecheck` → correctos. Para la raíz, C0 restauró los enlaces y dependencias desde la caché local.
- `node --input-type=module` sobre `dist/gradients.js` → aserciones de ausencia de curvas, valores por omisión, orden y duplicados, easing `hold` y `smooth`, acotación y límite nativo.
- `codegraph sync` y `codegraph affected packages/adapters/blender/src/gradients.ts packages/adapters/blender/src/request.ts` → detectó la suite del adaptador, la nueva integración de gradientes y la fixture transitiva de MCP. GitNexus no tiene el worktree indexado. Graphify no fue necesario para el enlace directo.
- `git diff --cached --check` → correcto.

## Pendiente

- C0 entrega las métricas y la prueba visual de Blender junto a los cambios del motor. A0 actualiza el lockfile al integrar el workspace.
