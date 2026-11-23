# FDN-051 · Medición de tokens leídos por el router

**Autor:** claude-code-a3 (Haiku 5.5) · **Fecha:** 2026-11-23 · **Rama:** `fdn/FDN-051-tokens`

## Hecho
- `packages/router/test/tokens.test.ts`: mide lo que el router recibe del registro en cuatro escenarios reales, con las tarjetas de `examples/fase1/{revideo,blender,freecut}/card.*.json`.
- Espía sobre `RouterRegistry` (envuelve `listSimple` e `inspect`) para registrar cada sección avanzada que el router pide y su tamaño.
- Regresión: el test falla si el router lee una sección avanzada que el requisito no necesita.
- Sin cambios en `packages/router/src`.

## Método
- Tokens estimados = caracteres de la serialización JSON / 4, redondeado hacia arriba. **No es un tokenizador real**; se usa como proxy comparable entre escenarios.
- Bytes = UTF-8 de esa misma serialización. Las tarjetas del disco tienen espacios y saltos de línea, así que sus bytes son mayores (ver base).
- Las lecturas avanzadas se miden sobre el objeto `sections` que devuelve `inspect`, no sobre el fichero.

## Números reales (`node --test packages/router/test/tokens.test.ts`)

| Escenario | Lecturas del router | Simple (3 tarjetas) | Avanzada leída | Total |
|---|---|---|---|---|
| «título SVG animado» (solo simples) | ninguna | 222 tok / 885 B | 0 tok / 0 B | **222 tok** |
| «cámara 3D con alpha» | blender `[technical]` | 222 tok / 885 B | 33 tok / 131 B | **255 tok** |
| «título animado con alpha en MOV» | revideo `[technical]` | 222 tok / 885 B | 64 tok / 255 B | **286 tok** |
| «render con límite de FPS y licencia revisada» | revideo `[limits,licenseReview]`, freecut `[limits,licenseReview]` | 222 tok / 885 B | 197 tok / 782 B | **419 tok** |

**Base:** leer las 3 tarjetas avanzadas completas (5 secciones cada una) = **503 tok / 2005 B** (2005 caracteres). En ficheros del disco, las tres `card.advanced.json` suman 2649 B con formato (889 + 561 + 1199).

**Lectura:** en el peor escenario medido (dos conectores, dos secciones) el router lee 197 tok en avanzadas, el 39 % de la base. En escenarios con una sola sección, 33–64 tok, entre el 7 % y el 13 %.

## Observaciones
- **Las tarjetas simples se leen completas en todos los escenarios** (222 tok, 3 de 3). `listSimple` no filtra por capacidad: el filtrado ocurre después. Si el número de tarjetas crece, ese coste crece con él. Es el primer punto a optimizar si hace falta; requiere un cambio en el registro, por eso no se toca aquí.
- Las métricas del router (`simpleCardsRead`, `advancedInspections`, `advancedSectionsRequested`) coinciden con lo que mide el test en los cuatro escenarios.
- Muestra pequeña: tres tarjetas, cuatro escenarios. No permite generalizar a catálogos grandes.

## Verificado
- `node --test packages/router/test/tokens.test.ts` → 5/5 pasan.
- `npm test` → 113 pasan, 0 fallos, 6 omitidos (tests de integración de Revideo/Blender sin motor en este equipo, preexistentes).
- `npm run typecheck` → exit 0.

## Pendiente
- No hay medida con un tokenizador real del modelo; el número es proxy.
- Si A0 quiere que el registro filtre antes de leer, hace falta una `solicitud` sobre `packages/connectors` (no tocada).
