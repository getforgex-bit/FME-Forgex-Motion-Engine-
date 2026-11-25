# ADR-0017: Turnos de coordinadores dentro de un equipo (no paralelos)

- **Estado:** aceptada (2026-11-25; pedido por el usuario en el chat de A0) · **Dueño:** A0 · **Revisable:** tras una semana de turnos reales
- **Complementa a:** ADR-0013 (relevo), ADR-0014 (ausencia) y ADR-0016 (asistente de A0)

## Contexto

El usuario quiere más de un coordinador por equipo, pero **sin trabajo en paralelo**: se turnan y siguen contando como el mismo equipo.
- **Antigravity:** Gemini 4 Neon (`antigravity-b0`) y una sesión nueva de **Gemini 4 Carbon** (`antigravity-b0c`), cada una con 2 Hydrogen.
- **Codex:** GPT-6.2 Sol (`codex-c0`). **Temporalmente, GPT-6.2 Astra** (`codex-c0a`) mientras se reinicia la cuota semanal de Sol. Más adelante puede quedar como pareja que se turna, según los resultados.

Esto es una **excepción del usuario** a «no usar Astra ni Carbon» del prompt maestro.

El usuario necesita saber **a cuál de los dos poner a trabajar** en cada momento. Además, el protocolo marcaba como «sospechoso» a un equipo que no había latido mientras el usuario estaba fuera, aunque sin él no puede trabajar.

## Decisión

1. **Configuración versionada** en `coordinacion/turnos.json` (solo A0 la edita):
   - los coordinadores de cada equipo, con su modelo;
   - los **perfiles por modelo** (0–3 por dominio), sacados de los benchmarks que aportó el usuario el 2026-11-25 (POR VALIDAR, `BENCHMARKS.md` §6);
   - los **dominios** con sus palabras clave;
   - el coste relativo, que solo desempata.
2. **Un solo titular por equipo.**
   - `coord.mjs turno --tomar --sesion <id>` falla si otro coordinador del mismo equipo tiene el turno sin haberlo cedido. Con el permiso del usuario se puede pasar `--forzar --cita`.
   - `turno --ceder --sesion <id> --nota "<qué queda>" [--motivo fin|cuota|pausa]` deja la nota de traspaso, y el siguiente la recibe al tomar el turno.
   - Tomar o ceder renueva el latido.
3. **Recomendación** con `coord.mjs turno --equipo <x> [--tarea FDN-… | --texto "…"]`. Por orden:
   1. si hay titular con cuota, **sigue él**: cambiar a mitad cuesta contexto;
   2. si no, se excluyen los coordinadores **sin cuota** (`turno --ceder --motivo cuota` o `turno --sin-cuota --coordinador <id>`, hasta `--disponible` o una nueva toma);
   3. se puntúan las tareas READY o en curso del equipo (o las indicadas) según el perfil del modelo;
   4. en caso de empate, gana el más barato y después se alterna.
4. **Mismo equipo:** las sesiones de ambos coordinadores usan `--equipo <x>`, comparten las fichas, ramas, worktrees y reclamos del equipo y cuentan como un solo equipo en `equipos`, BACKLOG y TEAM_STATUS.
5. **Sospecha tras la vuelta del usuario** (corrige ADR-0014):
   - `usuario --presente` guarda la hora de **vuelta** cuando el usuario regresa de una ausencia;
   - el plazo de 60 min de sospecha se cuenta desde la vuelta;
   - mientras tanto, el equipo aparece como «esperando al usuario (volvió hace poco)».
6. **Identificadores:** Carbon `antigravity-b0c`; Astra `codex-c0a`. Las reanudaciones usan el sufijo `-rN` (`codex-c0a-r2`). Los trabajadores mantienen sus ids (`b1`/`b2`, `c1`/`c2`) con cualquiera de los dos coordinadores.

## Consecuencias

- **Positivas:**
  - el usuario tiene una respuesta concreta y razonada sobre a quién activar;
  - el traspaso entre coordinadores queda escrito;
  - no hay dos coordinadores del mismo equipo a la vez;
  - no hay relevos falsos tras una ausencia.
- **Negativas:**
  - los perfiles salen de benchmarks POR VALIDAR y de palabras clave, así que la recomendación es orientativa;
  - el usuario puede elegir otro coordinador, y `AGENT_PERFORMANCE.md` irá corrigiendo los perfiles con datos reales.
- **Seguimiento:** registrar por turno el modelo, la tarea, el resultado y si hubo traspaso a mitad; revisar los perfiles cuando haya 5 o más tareas por modelo.

## Evidencia

`node --test scripts/coord.test.mjs` → 9/9, con el test de turnos: recomendación por perfil, bloqueo de un segundo titular, preferencia por el titular, exclusión por cuota con nota de traspaso, mismo equipo y sospecha contada desde la vuelta. Sobre el `FME-ops` real (A0, 2026-11-25): Antigravity → Neon para FDN-074 y Carbon para FDN-070c; Codex → Astra con Sol sin cuota.
