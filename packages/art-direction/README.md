# @fme/art-direction: Mitad A, dirección artística

**Responsabilidad (spec §5 y §6.1):** recibir objetivos y restricciones; producir un plan estético por secuencia, plano, capa y objeto; mapear las 5 técnicas y los 2 gradientes al vocabulario de cada backend; aplicar reglas de animación y perfiles de estilo.
**Estado:** perfiles, reglas y `applyArtDirection` (FDN-060) y traducción a operaciones por backend (FDN-061, `src/backends/`).

## Gradientes → operaciones por backend (`src/backends/`)

Entradas normalizadas 0–1 e **independientes** entre sí (spec §4). Funciones puras, monótonas y deterministas; los valores fuera de 0–1 o no finitos se recortan.

### Revideo (VERIFICADO: render real con métrica de píxeles, FDN-061)

| Gradiente | Operación | Rango (0 → 1) | Qué se observa |
|---|---|---|---|
| `expression` | `strokeWidth` (contorno del texto) | 0 → 8 px | más píxeles de contorno |
| `expression` | `strokeOpacity` | 0 → 1 | contorno más opaco |
| `expression` | `jitterAmplitude` (temblor de posición, semilla `proyecto:capa:fotograma`) | 0 → 4 px | trazo más «artesanal» |
| `integration` | `shadowBlur` | 0 → 24 px | sombra más difusa y amplia |
| `integration` | `shadowOffset` | 0 → 18 px | sombra más desplazada (la capa «recibe» luz de la escena) |
| `integration` | `shadowOpacity` | 0 → 0,8 | sombra más densa |

`revideoGradientOps(expression, integration)` → `RevideoGradientOps`. El adaptador (`@fme/adapter-revideo`, `sampleGradientTracks`) la evalúa por fotograma a partir de las curvas `expression`/`integration` de la capa; si la capa no tiene ninguna, no se aplica nada (render idéntico al anterior). Si solo hay una, la otra vale 0 (sin efecto).

**Evidencia** (`packages/adapters/revideo/test/gradients.integration.test.ts`, título de la fixture híbrida, 1920×1080, `expression` 0→1 e `integration` 1→0 a la vez): píxeles de contorno (r − b > 30) en los fotogramas 0, 60, 90 y 119 = 0, 11 687, 21 018, 28 564 (crece); píxeles de sombra (más oscuros que el fondo) = 45 705, 20 241, 6 047, 1 649 (baja). Resultado idéntico en 2 ejecuciones.

### Blender (PROPUESTO; sin consumir ni verificar)

| Gradiente | Operación | Rango |
|---|---|---|
| `expression` | `freestyleThickness` / `freestyleAlpha` (líneas de Freestyle) | 0 → 4 px / 0 → 1 |
| `integration` | `materialMix` (material ↔ iluminación de escena) / `shadowStrength` | 0 → 1 |

`blenderGradientOps(expression, integration)`. El adaptador Blender no la usa todavía.

### Técnicas (`techniqueSupport(backend, técnica)`)

| Técnica | Revideo | Blender |
|---|---|---|
| `2d` | yes | no |
| `2.5d` | no | unknown |
| `3d` | no | yes |
| `2d-guided-by-3d` | partial (se renderiza la capa 2D; `guide3DLayerId` aún no condiciona la animación) | unknown |
| `3d-with-2d` | no | unknown |

`yes` solo con un render real que lo demuestre; `unknown` = no probado.
