# ADR-0013: Relevo entre equipos cuando uno se queda sin cuota

- **Estado:** aceptada (2026-11-23; decisiones del usuario en el chat de A0) · **Dueño:** A0 · **Revisable:** tras el primer relevo real
- **Contexto real:** el 2026-11-23, Codex se quedó sin cuota con FDN-071 a medias y FDN-070b sin empezar.

## Contexto

Las tres aplicaciones (Claude Code, Antigravity y Codex) dependen de cuotas que se agotan. **Ninguna detecta sola** que otra se ha quedado sin cuota: solo lo sabe el usuario, que la está viendo. Sin un protocolo:
- las tareas a medias quedan bloqueadas;
- los reclamos impiden que otro equipo las tome;
- cuando el equipo vuelve, no sabe qué cambió en su ausencia.

## Decisión (opciones elegidas por el usuario)

1. **Detección: latido y usuario.**
   - `coord.mjs equipos` marca un equipo como **sospechoso** si tiene sesiones activas o reclamos y ninguna de sus sesiones ha dado latido en **60 minutos** (`FME_UMBRAL_CAIDA_MIN`). El latido se renueva con `registrar`, `avance` y `buzon`.
   - Solo el **usuario** declara un equipo **caído**. A0 ejecuta `coord.mjs caida --equipo <x> --cita "<palabras del usuario>"`, y la cita literal es obligatoria.
2. **Acta de caída.** Al declararlo, `coord.mjs` guarda en `FME-ops/relevos/` una foto del estado de cada sesión activa del equipo: tarea, rama, punta (SHA), worktree, cambios sin commit (con un `.patch` de solo lectura) y reclamos. **No toca** los worktrees ni las ramas del equipo caído.
3. **Autorización del relevo: A0 propone y el usuario aprueba.**
   - A0 propone qué equipo releva cada tarea, según la carga y el tipo de tarea.
   - Tras el «sí» del usuario: `coord.mjs relevar --tarea FDN-xxx --de <equipo> --a <equipo> --cita "<…>"`.
   - El comando libera los reclamos del equipo caído para esa tarea y envía un `traspaso` al relevista, con la punta de la rama.
4. **Rama del relevista:** rama **nueva** `fdn/FDN-xxx-slug-relevo-<equipo>` creada **desde la punta** de la rama del caído. Conserva sus commits sin tocar su rama ni su worktree. Si había cambios sin commit, el relevista puede aplicar el `.patch` del acta en su rama nueva.
5. **Retorno: el relevista termina lo relevado.**
   - Cuando el equipo vuelve, A0 ejecuta `coord.mjs reincorporar --equipo <x>`.
   - El comando genera una **nota de reincorporación**: qué se relevó, a quién y en qué rama, y qué se integró en `develop` desde la caída. Se la envía como `traspaso` al equipo.
   - El equipo que vuelve compara su worktree con el acta (punta y cambios sin commit), **no continúa** las tareas relevadas y toma tareas READY nuevas.
6. **Si cae A0 (director e integrador):**
   - la integración en `develop` **se pausa**;
   - los equipos siguen en sus ramas y acumulan REVIEW;
   - nadie fusiona hasta que **el usuario elija un suplente** o A0 vuelva.
   - **Suplentes posibles:** una sesión Sol, una sesión Neon o **Astra en Codex**. Es una excepción explícita del usuario a la regla «no usar Astra», válida solo para este rol.
   - El suplente usa el id `<herramienta>-integrador-suplente` y sigue `coordinacion/INTEGRATION.md`; anota cada fusión en su bitácora.
   - Al volver, A0 revisa todas las fusiones del suplente antes de seguir.
7. **Las sesiones Claude A1–A3** comparten la cuenta de A0, así que probablemente caen con él. Su relevo sigue las mismas reglas.

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| Declaración automática por latido | Una tarea larga sin mensajes daría relevos falsos y duplicaría trabajo (descartado por el usuario) |
| Relevo en la misma rama del caído | Rama compartida entre dos equipos; el que vuelve tendría que fusionar (descartado) |
| Devolver la tarea al dueño al volver | Doble cambio de contexto (descartado) |
| Integrador suplente automático | Dos integradores a la vez en `develop` (descartado) |

## Consecuencias

- **Positivas:**
  - ninguna tarea queda bloqueada por una cuota agotada;
  - el que vuelve tiene una nota verificable en lugar de reconstruir el estado;
  - nada del caído se pierde ni se sobrescribe.
- **Negativas:**
  - el umbral de 60 min puede marcar como sospechoso a un equipo con un render largo; solo es un aviso.
  - `FME-ops` sigue sin historial: las actas y notas se resumen en la bitácora de A0.
- **Seguimiento:** registrar en `AGENT_PERFORMANCE.md` cada caída, cuánto dura y el tiempo hasta el relevo.

## Evidencia

`npm test` → tests de `equipos`, `caida`, `relevar` y `reincorporar` en `scripts/coord.test.mjs` (bitácora de A0, 2026-11-23).
