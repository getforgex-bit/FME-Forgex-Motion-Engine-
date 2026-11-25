# ADR-0011: Interfaz común de adaptadores y procedencia de los artefactos

- **Estado:** propuesta (2026-11-23) · **Dueño:** A0 · **Revisable:** al cerrar la Fase 3 (FDN-033)

## Contexto

Tres adaptadores se van a desarrollar en paralelo y por equipos distintos: Revideo (FDN-032, Claude), Blender (FDN-040, Codex) y FreeCut (FDN-041, Antigravity). `JobRequest` y `JobResult` (§8.3) no definen cómo se invoca un adaptador ni cómo registra la procedencia que exige la Fase 3 («un job real produce un artefacto con procedencia: herramienta, versión, parámetros y hash»). Sin una interfaz común, el router (FDN-050) tendría que conocer cada adaptador por separado.

## Decisión

1. **Interfaz `ConnectorAdapter`** (`packages/connectors/src/adapter.ts`):
   - `simple` y `advanced`: las tarjetas;
   - `probe()`: comprueba la disponibilidad real del motor y su versión;
   - `run(job, ctx)`: ejecuta el job y devuelve un `AdapterJobResult`.
2. **`AdapterJobResult` extiende `JobResult`** con `jobId` y `provenance[]` (un elemento por salida: `sha256` del archivo, `contentSha256` opcional para formatos con metadatos volátiles, `pluginId`/`pluginVersion`, `engineVersion` leída del propio motor, `params`, `seed`, `startedAt` y `durationMs`). `JobResult` no cambia, así que el cambio es compatible.
3. **Ejecución:**
   - los adaptadores invocan los motores con `runIsolated` de `@fme/runtime-workers`;
   - sin shell;
   - escriben solo en `ctx.workDir`;
   - el timeout viene de `ctx.timeoutMs`.
4. **Conformidad:** `checkAdapterResult(result, adapter)` es la prueba común. Cada adaptador la ejecuta en sus tests con un job real.
5. **Ubicación:**
   - cada adaptador es un workspace `packages/adapters/<motor>` (`@fme/adapter-<motor>`);
   - los proyectos npm pesados de un motor (p. ej. Revideo con Puppeteer y Vite) viven **fuera de los workspaces**, en `runtime/engines/<motor>/`, con su propio lockfile;
   - el adaptador los ejecuta como CLI, así las dependencias del motor no contaminan el lockfile raíz.

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| Que cada adaptador exponga su propia API | El router tendría código específico por motor (contradice §8) |
| Meter la procedencia en `JobResult` como campo obligatorio | Rompe el contrato v0.1 publicado en los docs |
| Revideo como dependencia directa del adaptador en el lockfile raíz | Más de 360 MB y un aviso de seguridad en el núcleo; mezcla el motor y el contrato |

## Consecuencias

- **Positivas:** los tres adaptadores son intercambiables para el router y la procedencia es verificable con la misma prueba.
- **Negativas:** el `runtime/engines/<motor>` exige instalar el motor aparte (documentado en cada adaptador).
- **Seguimiento:** si FreeCut (FDN-012) no admite una ejecución por CLI, revisar el punto 3 para ese adaptador.

## Evidencia

`packages/connectors/test/adapter.test.ts` (conformidad), y `npm run typecheck` + `npm test` en verde al introducirlo (bitácora de A0, 2026-11-23).
