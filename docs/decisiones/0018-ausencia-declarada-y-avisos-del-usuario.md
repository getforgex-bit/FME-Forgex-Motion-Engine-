# ADR-0018: Ausencia declarada y avisos de cuota por parte del usuario

- **Estado:** aceptada (2026-11-25; pedido por el usuario en el chat de A0) · **Dueño:** A0
- **Complementa a:** [ADR-0014](0014-modo-ausencia-del-usuario.md) (no lo modifica), [ADR-0013](0013-relevo-entre-equipos.md) y [ADR-0017](0017-turnos-de-coordinadores.md)

## Contexto

ADR-0014 detecta la ausencia del usuario **por tiempo**: 2 h sin presencia. El usuario pidió poder **avisar** cuando se va («me voy a dormir»), para que el modo ausencia empiece de inmediato, y poder avisar también de que un equipo se quedó sin cuota.

## Decisión

1. **«Me voy»:**
   - el coordinador que recibe el aviso ejecuta `coord.mjs usuario --ausente --sesion <id> --nota "<sus palabras>"`;
   - el **escalón 1 empieza ya**; el 2 llega a las X h (2 h) y el 3 (punto de control y parada) a las 2X h (4 h) **desde el aviso**;
   - el siguiente `usuario --presente` registra la vuelta, con el resumen y la cola de decisiones de ADR-0014.
2. **«El equipo X se quedó sin cuota»:**
   - si X tiene turnos, `turno --sin-cuota --coordinador <id>`;
   - si se queda sin cuota todo el equipo, `caida --equipo X --cita "<sus palabras>"` y A0 propone el relevo (ADR-0013).
3. **Trabajo encadenado durante la ausencia** (lo pidió el usuario al irse el 2026-11-25):
   - cada sesión trabajadora de Claude, al terminar su tarea, pide a A0 que continúe en nombre del usuario con un mensaje entre sesiones, **una sola vez por tarea**;
   - A0 integra lo que esté en verde y asigna la siguiente tarea **ya autorizada**, siempre obedeciendo el escalón;
   - cuando no quedan tareas coordinadas o se llega al escalón 3, A0 hace el punto de control y para.

## Consecuencias

- **Positivas:** el modo ausencia es preciso, no hay que esperar 2 h, y se aprovecha el tiempo sin decisiones arriesgadas.
- **Negativas:** depende de que el coordinador registre el aviso. Si no lo hace, sigue aplicando la detección por tiempo de ADR-0014.

## Evidencia

`node --test scripts/coord.test.mjs` → 10/10, con el test «ausencia declarada por el usuario» (escalón 1 inmediato, 2 a +2,5 h, 3 a +4,5 h, `caida` bloqueada y vuelta).
