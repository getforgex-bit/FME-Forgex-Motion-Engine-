# ADR-0014: Modo ausencia del usuario (parada gradual y cola de decisiones)

- **Estado:** aceptada (2026-11-23; decisiones del usuario en el chat de A0) · **Dueño:** A0 · **Revisable:** tras la primera ausencia real
- **Complementa a:** [ADR-0013](0013-relevo-entre-equipos.md) (relevo entre equipos)

## Contexto

- Codex y Antigravity **solo trabajan cuando el usuario les escribe**. Si el usuario se ausenta, dejan de dar latido aunque tengan cuota. Con ADR-0013 aparecerían como «sospechosos de caída»: un **relevo falso**.
- Las sesiones Claude (A0 con A1–A3) **sí avanzan solas**: A0 recibe los avisos de sus sesiones y les manda nuevas tareas. Sin el usuario, pueden acumular decisiones que solo él debe tomar (descargas, cambios de contrato, relevos).

## Decisión (opciones elegidas por el usuario)

1. **Presencia.**
   - Cada coordinador (A0, B0 y C0) ejecuta `coord.mjs usuario --presente` **en cada mensaje del usuario**, antes de hacer nada.
   - La presencia es la más reciente de cualquier coordinador. Cada uno escribe su propio archivo `FME-ops/usuario/presencia-<sesion>.md`.
2. **Escalones** (X = `FME_AUSENCIA_H`, **2 h** por defecto):

| Escalón | Sin presencia | Qué se permite |
|---|---|---|
| 0 | < X | Trabajo normal |
| 1 | ≥ X (2 h) | Solo tareas READY **ya asignadas**. Toda decisión que requiera aprobación va a la cola. Sin descargas, relevos ni ADR aceptados (las propuestas sí). A0 integra solo REVIEW en verde **sin cambios de contrato ni dependencias nuevas** |
| 2 | ≥ 2X (4 h) | Solo **terminar lo IN_PROGRESS**; no se toman tareas nuevas. A0 sigue integrando solo lo verde |
| 3 | ≥ 3X (6 h) | **Punto de control**: commits, bitácora, `estado/<equipo>.md` y traspaso. Después, **parada total**, incluida la integración. A0 deja de mandar tareas a A1–A3 |

3. **Sin relevos falsos.**
   - Mientras el usuario está ausente, `equipos` muestra «en pausa (usuario ausente)» en lugar de «sospechoso».
   - `caida`, `relevar` y `decidir` **se rechazan** si no hay presencia reciente: necesitan al usuario y su cita literal.
4. **Cola de decisiones.**
   - `coord.mjs pendiente --asunto … --texto … --impacto alto|medio|bajo [--tarea FDN-xxx]` crea un archivo en `FME-ops/decisiones/`.
   - `pendientes` las lista con el impacto alto primero.
   - `decidir --id … --resolucion aprobada|rechazada|aplazada --cita "<usuario>"` guarda la respuesta en un archivo de resolución aparte (un archivo, un autor) y avisa a quien la pidió.
5. **Vuelta del usuario.**
   - `usuario --presente` detecta que venía de una ausencia y lo avisa.
   - El coordinador muestra **primero un resumen** de lo ocurrido (integraciones, tareas terminadas, bloqueos) y **después las decisiones, una a una**, por orden de impacto, para que el usuario las apruebe, rechace o aplace.
6. **Sin registro previo de presencia** se asume el escalón 0: no se presupone ausencia.

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| Detectar la presencia por los latidos de los equipos | Confunde «usuario ausente» con «equipo caído»: es justo el falso relevo que se quiere evitar |
| Parada directa al llegar al umbral | Desaprovecha el trabajo ya decidido (descartada por el usuario) |
| Nada se integra en ausencia | Bloquea a los equipos en ramas obsoletas (descartada por el usuario) |

## Consecuencias

- **Positivas:**
  - no hay relevos falsos;
  - el trabajo seguro continúa, el arriesgado espera;
  - al volver, el usuario tiene una lista ordenada en lugar de cambios sorpresa.
- **Negativas:** depende de que cada coordinador registre la presencia en cada mensaje. Si lo olvida, el sistema creerá que el usuario está ausente y frenará, que es el fallo seguro.
- **Seguimiento:** medir en `AGENT_PERFORMANCE.md` cuántas decisiones se encolan por ausencia y cuánto tardan en resolverse.

## Evidencia

`node --test scripts/coord.test.mjs` → test «modo ausencia del usuario» (escalones a 2,5, 4,5 y 6,5 h; «en pausa» en lugar de sospechoso; `caida` rechazada; cola ordenada; vuelta y resolución).
