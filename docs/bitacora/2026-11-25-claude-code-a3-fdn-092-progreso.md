# FDN-092 · Script de trazabilidad por hitos (`scripts/progreso.mjs`)

**Autor:** claude-code-a3 (Haiku 5.5) · **Fecha:** 2026-11-25 · **Rama:** `fdn/FDN-092-progreso` (desde `develop` cbd3256)

## Hecho
- `scripts/progreso.mjs`: lee la sección `## Hitos` y `## Resumen` de `coordinacion/BACKLOG.md` y los criterios ☑/☐ de `docs/pruebas-aceptacion.md`. Genera `PROGRESO.md` o, con `--check`, aplica las reglas del §3.4 (sale con 1 si hay incumplimientos y no escribe).
- Opciones: `--backlog`, `--acceptance`, `--salida`. Sin dependencias.
- `scripts/progreso.test.mjs`: 13 pruebas con un BACKLOG de ejemplo en un directorio temporal.

## Decisiones de diseño (interpretación propia donde la propuesta no lo fija)
- **% binario y sin pesos:** `hitos cerrados / hitos vivos` (no retirados). El % general es v0.1 (plazos 1+2). El plazo 3 (largo) se muestra como catálogo condicionado, fuera del %.
- **Reglas de `--check` implementadas:** hito cerrado sin evidencia; retirado sin motivo; slug duplicado; clase desconocida; tarea DONE sin ningún hito; hito que aporta a una tarea inexistente; criterio ☑ sin `H-criterio-N` cerrado y, al revés, `H-criterio-N` cerrado con criterio ☐.
- **«Un hito menor no aporta a uno crítico»:** la propuesta no define el chequeo. Lo implemento como: un hito `menor` no puede tener id `H-criterio-*` ni `H-cierre-*`. Si A0 quiere otra regla, es un cambio pequeño.
- **Hitos nuevos:** se cuentan contra el PROGRESO.md anterior (ids `H-…` no presentes).
- **Vista por equipo:** solo CL/AG/CX, con las tareas en curso y las integradas. **La vista por rol queda pendiente:** el BACKLOG no registra el rol (hallazgo 12).

## Verificado
- `node --test scripts/progreso.test.mjs` → 13/13.
- `npm run typecheck` → exit 0.
- `npm test` → 265 pruebas: 246 pasan, 18 omitidas, 1 falla. La falla es `packages/recovery/test/real-fallbacks.integration.test.ts` (FreeCut real, `'escalated' !== 'ok'`). No importa ningún archivo de este cambio y en una ejecución anterior fallaron más tests de integración real, así que parece inestable. **No lo he investigado a fondo.**
- `node scripts/progreso.mjs --check` sobre el BACKLOG real → exit 2: todavía no existe la sección `## Hitos`, que escribirá A0.

## Pendiente / para A0
- `npm test` no ejecuta `--check` todavía. Hace falta tocar `package.json` (fuera de mis rutas) o un test que llame a `verificar` sobre el BACKLOG real; el usuario decidió que solo avise en `npm test`.
- Migración retroactiva: `--check` marcará como DONE sin hito las tareas históricas hasta que A0 complete la sección `## Hitos`.
- `coord.mjs usuario` funciona ahora. En el primer intento devolvió «Comando desconocido»; lo probé de nuevo y responde (`Permitido: presente`).
