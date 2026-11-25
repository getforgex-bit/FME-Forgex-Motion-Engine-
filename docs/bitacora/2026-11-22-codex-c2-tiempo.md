# 2026-11-22 · FDN-022 Tiempo racional

- **Sesión** `codex-c2` · **Rama** `fdn/FDN-022-tiempo` · **Tarea** FDN-022

## Hecho

- Implementé la conversión entre fotogramas y segundos con FPS racional. Reduje los términos por su máximo común divisor antes de operar con `Number` para que las representaciones equivalentes produzcan el mismo resultado.
- La conversión de segundos a fotogramas exige una política de redondeo. El reescalado entre tasas opera con `BigInt` y redondea una vez. Admite piso, techo y entero más cercano, con empate alejándose de cero. El reescalado usa el entero más cercano por defecto.
- El timecode usa `:` sin omisiones y `;` en drop-frame a 30000/1001. Omite las etiquetas `;00` y `;01` al comienzo de cada minuto salvo los múltiplos de diez. Cuenta horas acumuladas después de las 24 h y acepta fotogramas no negativos. [Referencia SMPTE](https://www.smpte.org/hubfs/er1002-2017%20%282%29.pdf?hsLang=en)
- Las funciones viven en el módulo interno `packages/project/src/time.ts`, con el tipo `Fps` y el esquema v1 existentes.

## Verificado

| Comando | Resultado |
|---|---|
| `npm run typecheck` | OK. |
| `npm test` | 19 pasan. La suite recorre 608 297 puntos de fotograma de una hora a 24, 25, 30, 60 y 30000/1001. También prueba límites de drop-frame, redondeos, precisión con tasas equivalentes cerca de `Number.MAX_SAFE_INTEGER` y entradas inválidas. |
| `codegraph sync` | Índice al día después de reintentar por un bloqueo temporal. |
| `codegraph affected packages/project/src/time.ts packages/project/test/time.test.ts` | Detectó `packages/project/test/time.test.ts`. |
| `codegraph impact reduceFps` | Alcance interno en `framesToSeconds`, `secondsToFrames` y la prueba. |
| `gitnexus detect-changes --repo <worktree> --scope all` | El registro local de GitNexus no tiene este worktree indexado. |

## Pendiente

- Revisión e integración de A0. FDN-023 depende de esta tarea y de FDN-021.
- Los segundos se representan con `Number` y su precisión queda sujeta al rango representable. El reescalado mantiene el cálculo exacto hasta el redondeo final.
