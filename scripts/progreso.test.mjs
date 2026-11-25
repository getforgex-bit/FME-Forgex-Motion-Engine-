// Pruebas de scripts/progreso.mjs (FDN-092). Uso: npm test  (node --test)
// Todos los BACKLOG y criterios son de ejemplo, en un directorio temporal.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { generar, leerFuentes, verificar } from "./progreso.mjs";

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), "progreso.mjs");
const dir = mkdtempSync(join(tmpdir(), "fme-progreso-"));
test.after(() => rmSync(dir, { recursive: true, force: true }));

const TAREAS = `## Resumen

| ID | Tarea | Equipo | Depende de | Estado |
|---|---|---|---|---|
| FDN-050 | Núcleo del router | AG | 030 | DONE (arranque) |
| FDN-051 | Medición de tokens | CL-A3 | 050 | DONE |
| FDN-052 | Fallbacks | CX | 050 | IN_PROGRESS |
| FDN-053 | Cierre F5 | CL-A0 | 051, 052 | READY |
| FDN-005 | Aprobación de la spec | **Usuario** | — | BLOCKED (humano) |
`;

const HITOS = `## Hitos

| id | plazo | parte | fase | clase | estado | evidencia | aportan |
|---|---|---|---|---|---|---|---|
| H-router-nucleo | 2 | 2.B | 5 | normal | [x] | bitácora 051 | 050 |
| H-medicion-tokens | 2 | 2.B | 5 | normal | [x] | commit 3366479 | 051 |
| H-fallbacks | 2 | 2.B | 5 | normal | [ ] | — | 052 |
| H-criterio-4 | 2 | 2.B | 5 | critico | [x] | comando → ok | 052, 053 |
| H-criterio-5 | 2 | 2.B | 5 | critico | [ ] | — | 053 |
| H-spec-aprobada | 1 | 1.A | 0 | critico | [ ] | — | 005 |
| H-largo-cli | 3 | 3.C | 8 | normal | [ ] | — | — |
`;

const ACEPTACION = `# Criterios

| # | Criterio | Fase | Estado | Evidencia |
|---|---|---|---|---|
| 4 | El router selecciona ruta | 5 | ☑ | A0 test |
| 5 | Solo consulta lo necesario | 5 | ☐ | — |
`;

function backlog(extra = "") {
  return `# Backlog\n\n${TAREAS}\n${HITOS}\n${extra}`;
}

function fuentesDe(txt, acept = ACEPTACION) {
  return leerFuentes(txt, acept);
}

test("leerFuentes extrae hitos, tareas y criterios", () => {
  const f = fuentesDe(backlog());
  assert.equal(f.hitos.length, 7);
  assert.equal(f.tareas.length, 5);
  assert.equal(f.criterios.length, 2);
  const router = f.hitos.find((h) => h.id === "H-router-nucleo");
  assert.equal(router.estado, "cerrado");
  assert.deepEqual(router.aportan, ["050"]);
  assert.equal(f.hitos.find((h) => h.id === "H-criterio-5").estado, "abierto");
  assert.equal(f.tareas.find((t) => t.id === "005").estado, "BLOCKED");
});

test("un backlog consistente no tiene incumplimientos", () => {
  // Cada tarea DONE aporta a un hito; los criterios coinciden con sus hitos críticos.
  const txt = backlog().replace("| H-fallbacks | 2 | 2.B | 5 | normal | [ ] | — | 052 |", "| H-fallbacks | 2 | 2.B | 5 | normal | [x] | bitácora 052 | 052 |");
  const v = verificar(fuentesDe(txt, ACEPTACION.replace("| 5 | Solo consulta lo necesario | 5 | ☐ | — |", "| 5 | x | 5 | ☐ | — |")));
  // FDN-053 es READY, no DONE; sigue sin ser un incumplimiento. H-criterio-5 abierto con criterio ☐.
  assert.deepEqual(v, []);
});

test("cerrado o retirado sin evidencia se rechazan", () => {
  const txt = backlog().replace("| H-spec-aprobada | 1 | 1.A | 0 | critico | [ ] | — | 005 |", "| H-spec-aprobada | 1 | 1.A | 0 | critico | [x] | — | 005 |");
  const v = verificar(fuentesDe(txt));
  assert.ok(v.some((x) => x.includes("H-spec-aprobada: cerrado sin evidencia")));
});

test("slug duplicado y tarea que aporta a un hito o tarea inexistente", () => {
  const txt = backlog("| H-router-nucleo | 2 | 2.B | 5 | normal | [ ] | — | 999 |\n");
  const v = verificar(fuentesDe(txt));
  assert.ok(v.some((x) => x === "slug duplicado: H-router-nucleo"));
  assert.ok(v.some((x) => x.includes("aporta a la tarea inexistente FDN-999")));
});

test("una tarea DONE sin ningún hito se marca", () => {
  const v = verificar(fuentesDe(backlog()));
  assert.ok(v.includes("FDN-050: DONE sin ningún hito") === false, "FDN-050 sí aparece en H-router-nucleo");
  const sinHito = backlog().replace("| bitácora 051 | 050 |", "| bitácora 051 | — |");
  const v2 = verificar(fuentesDe(sinHito));
  assert.ok(v2.some((x) => x === "FDN-050: DONE sin ningún hito"));
});

test("criterio ☑ sin hito crítico cerrado y criterio ☐ con hito cerrado se marcan", () => {
  const cruzado = ACEPTACION.replace("| 4 | El router selecciona ruta | 5 | ☑ | A0 test |", "| 4 | El router selecciona ruta | 5 | ☑ | A0 test |");
  const txt = backlog().replace("| H-criterio-4 | 2 | 2.B | 5 | critico | [x] | comando → ok | 052, 053 |", "| H-criterio-4 | 2 | 2.B | 5 | critico | [ ] | — | 052, 053 |");
  const v = verificar(fuentesDe(txt, cruzado));
  assert.ok(v.some((x) => x === "criterio 4 ☑ sin hito H-criterio-4 cerrado"));

  const v2 = verificar(fuentesDe(backlog().replace("| H-criterio-5 | 2 | 2.B | 5 | critico | [ ] |", "| H-criterio-5 | 2 | 2.B | 5 | critico | [x] |")));
  assert.ok(v2.some((x) => x === "H-criterio-5 cerrado pero el criterio 5 está ☐"));
});

test("un hito menor no puede cerrar un criterio ni una fase", () => {
  const txt = backlog("| H-criterio-9 | 2 | 2.B | 5 | menor | [ ] | — | 053 |\n");
  const v = verificar(fuentesDe(txt));
  assert.ok(v.some((x) => x.startsWith("H-criterio-9: un hito menor")));
});

test("retirado sin motivo se rechaza", () => {
  const txt = backlog("| H-retirado | 3 | 3.A | 8 | normal | retirado | — | — |\n");
  assert.ok(verificar(fuentesDe(txt)).some((x) => x === "H-retirado: retirado sin motivo"));
});

test("el % no tiene pesos y el largo plazo queda fuera", () => {
  const { resumen, markdown } = generar(fuentesDe(backlog()));
  // Plazos 1+2: H-router-nucleo, H-medicion-tokens, H-fallbacks, H-criterio-4, H-criterio-5, H-spec-aprobada → 3 cerrados de 6.
  assert.equal(resumen.general.cerrados, 3);
  assert.equal(resumen.general.total, 6);
  assert.equal(resumen.porPlazo[3].total, 1);
  assert.match(markdown, /v0\.1: 3\/6 hitos \(50 %\)/);
  assert.match(markdown, /Largo: catálogo condicionado \(0\/1, fuera del %\)/);
  assert.match(markdown, /Criterios: 1\/2 ☑/);
});

test("PROGRESO.md cuenta hitos nuevos desde la generación anterior", () => {
  const previo = "# Progreso\n- [x] H-router-nucleo\n- [ ] H-spec-aprobada\n";
  const { resumen, markdown } = generar(fuentesDe(backlog()), previo);
  assert.equal(resumen.nuevos, 5);
  assert.match(markdown, /\+5 hitos nuevos desde la última generación\./);
});

test("CLI: --check sale con 0 si cumple y 1 si no; sin --check escribe el PROGRESO.md", () => {
  const b = join(dir, "BACKLOG.md");
  const a = join(dir, "pruebas.md");
  const s = join(dir, "PROGRESO.md");
  writeFileSync(b, backlog());
  writeFileSync(a, ACEPTACION);

  // Backlog con un hito cerrado sin evidencia: debe fallar.
  writeFileSync(b, backlog("| H-sin-prueba | 2 | 2.B | 5 | normal | [x] | — | — |\n"));
  const bad = spawnSync(process.execPath, [SCRIPT, "--check", "--backlog", b, "--acceptance", a], { encoding: "utf8" });
  assert.equal(bad.status, 1, bad.stdout + bad.stderr);
  assert.match(bad.stdout, /incumplimiento/);

  writeFileSync(b, backlog());
  const ok = spawnSync(process.execPath, [SCRIPT, "--check", "--backlog", b, "--acceptance", a], { encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stdout);

  const gen = spawnSync(process.execPath, [SCRIPT, "--backlog", b, "--acceptance", a, "--salida", s], { encoding: "utf8" });
  assert.equal(gen.status, 0, gen.stderr);
  assert.match(readFileSync(s, "utf8"), /Progreso de FME/);
});

test("CLI: sin sección Hitos devuelve error de uso (2)", () => {
  const b = join(dir, "sin-hitos.md");
  writeFileSync(b, TAREAS);
  const r = spawnSync(process.execPath, [SCRIPT, "--check", "--backlog", b], { encoding: "utf8" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /"## Hitos"/);
});

test("el script real se puede importar sin ejecutar nada", () => {
  // Si el módulo ejecutara main() al importarse, esto fallaría al generar PROGRESO.md del repo.
  assert.equal(typeof generar, "function");
  assert.equal(typeof execFileSync, "function");
});
