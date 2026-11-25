# ADR-0019: Trazabilidad por hitos verificables y PROGRESO.md generado

- **Estado:** aceptada (2026-11-25; propuesta v2 del asistente a0s, decisiones del usuario y revisión de A0) · **Dueño:** A0
- **Fuente:** `FME-ops/propuestas/2026-11-23-mejora-plan-trazabilidad-v2.md` (ADR-0016: el asistente propone y A0 revisa)

## Contexto

Había cuatro porcentajes de avance distintos según el documento: BACKLOG, STATUS, roadmap y pruebas de aceptación. El usuario quiere leer en menos de 30 s cuánto falta en el corto, el mediano y el largo plazo y en el proyecto completo, y ver el avance por equipo.

## Decisión

1. **Hitos verificables:** enunciados de algo que debe ser cierto en `develop`, con evidencia.
   - Niveles: **Plazo → Parte → Fase → Hito**; las partes solo agrupan.
   - La relación con las tareas es muchos a muchos: las tareas FDN «aportan» a hitos.
   - Ids por slug (`H-…`), estables y nunca renumerados.
2. **Clases:**
   - **crítico:** cierra un criterio o una fase de la spec; solo cambia con un ADR;
   - **normal:** lo propone A0, B0 o C0 y A0 lo da de alta;
   - **menor:** B0 o C0 lo añaden sin consultar, con un aviso, en `FME-ops/hitos/<equipo>.md`, y A0 lo consolida.
   - Si hay duda, es normal.
3. **Fuente única:** la sección `## Hitos` de `coordinacion/BACKLOG.md`, editada solo por A0.
4. **`scripts/progreso.mjs`** (FDN-092, A3) genera **`PROGRESO.md` versionado**:
   - el % es binario y sin pesos;
   - % general = v0.1 (plazos 1 y 2);
   - el largo plazo es un catálogo condicionado, fuera del %.
   - `--check` detecta tareas DONE sin hito, hitos `[x]` sin evidencia, criterios incoherentes con su hito crítico, slugs duplicados y hitos menores que cierran criterios. **Solo bloquea la integración de A0**; no se añade a `npm test` (decisión del usuario).
5. **Al integrar:** A0 actualiza `## Hitos`, ejecuta `node scripts/progreso.mjs --check` y regenera `PROGRESO.md`.

## Consecuencias

- **Positivas:** una sola cifra de avance, verificable y con su evidencia enlazada; hitos parciales visibles (p. ej. la F6 cerrada con FDN-063b/c abiertas).
- **Negativas:** mantener la tabla cuesta trabajo a A0, aunque `--check` avisa de las omisiones.

## Evidencia

`node scripts/progreso.mjs --check` → «Trazabilidad conforme» con 45 hitos (34 de v0.1 y 11 de largo plazo) sobre `develop` (A0, 2026-11-25); tests del script 13/13 (A3).
