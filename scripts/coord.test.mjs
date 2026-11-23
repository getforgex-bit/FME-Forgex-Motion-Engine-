// Pruebas de scripts/coord.mjs. Uso: npm test  (node --test)
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

process.env.FME_COORD_DIR = mkdtempSync(join(tmpdir(), "fme-coord-"));
const { comandos: c, parseArgs } = await import("./coord.mjs");
test.after(() => rmSync(process.env.FME_COORD_DIR, { recursive: true, force: true }));

const reg = (herramienta, nombre, equipo = "general") => c.registrar({ herramienta, nombre, tarea: "t", equipo });

test("registrar crea id y rechaza duplicados y herramientas inválidas", () => {
  assert.match(reg("codex", "Fase 1 Blender", "fase1"), /codex-fase-1-blender/);
  assert.throws(() => reg("codex", "Fase 1 Blender"), /Ya existe/);
  assert.throws(() => c.registrar({ herramienta: "x", nombre: "a", tarea: "t" }), /herramienta/);
});

test("mensajes: directo, por equipo y a todos; el buzón marca lo leído", () => {
  reg("claude-code", "a", "fase1"); reg("antigravity", "b", "fase1"); reg("codex", "c", "otro");
  c.enviar({ de: "claude-code-a", para: "antigravity-b", asunto: "hola", texto: "directo" });
  c.enviar({ de: "claude-code-a", para: "equipo:fase1", asunto: "eq", texto: "equipo" });
  c.enviar({ de: "claude-code-a", para: "todos", asunto: "todos", texto: "difusión", tipo: "bloqueo" });
  const b = c.buzon({ sesion: "antigravity-b" });
  assert.match(b, /directo/); assert.match(b, /equipo/); assert.match(b, /difusión/);
  assert.equal(c.buzon({ sesion: "antigravity-b" }), "Sin mensajes nuevos.");
  const otro = c.buzon({ sesion: "codex-c" });
  assert.doesNotMatch(otro, /directo/); assert.doesNotMatch(otro, /equipo\n/); assert.match(otro, /difusión/);
  assert.equal(c.buzon({ sesion: "claude-code-a" }), "Sin mensajes nuevos.");
  assert.throws(() => c.enviar({ de: "claude-code-a", para: "fantasma", asunto: "x", texto: "y" }), /no está registrada/);
  assert.throws(() => c.enviar({ de: "claude-code-a", para: "todos", asunto: "x", texto: "y", tipo: "raro" }), /tipo/);
});

test("reclamos: bloquean rutas solapadas de otra sesión y se liberan", () => {
  c.reclamar({ sesion: "claude-code-a", ruta: "packages/project", motivo: "esquema" });
  assert.throws(() => c.reclamar({ sesion: "codex-c", ruta: "packages/project/src/index.ts", motivo: "x" }), /Conflicto/);
  assert.throws(() => c.reclamar({ sesion: "codex-c", ruta: "packages", motivo: "x" }), /Conflicto/);
  assert.match(c.reclamar({ sesion: "codex-c", ruta: "packages/projects-otro", motivo: "ok" }), /creado/);
  assert.match(c.reclamar({ sesion: "claude-code-a", ruta: "packages/project/src", motivo: "propio" }), /creado/);
  assert.match(c.liberar({ sesion: "claude-code-a" }), /2 reclamo/);
  assert.match(c.reclamar({ sesion: "codex-c", ruta: "packages/project", motivo: "ya libre" }), /creado/);
});

test("avance, estado y cerrar", () => {
  c.avance({ sesion: "claude-code-a", texto: "hice algo" });
  assert.match(c.estado(), /claude-code-a/);
  assert.match(c.cerrar({ sesion: "claude-code-a", resumen: "fin" }), /cerrada/);
  assert.doesNotMatch(c.estado().split("## Reclamos")[0], /claude-code-a/);
  assert.throws(() => c.avance({ sesion: "nadie", texto: "x" }), /no está registrada/);
});

test("parseArgs", () => {
  assert.deepEqual(parseArgs(["--a", "1", "--todo"]), { a: "1", todo: true });
  assert.throws(() => parseArgs(["suelto"]), /inesperado/);
});

test("tipos evento y solicitud (ADR-0007) y resolución de la carpeta operativa", async () => {
  const { resolverRaiz } = await import("./coord.mjs");
  assert.match(c.enviar({ de: "claude-code-a", para: "todos", asunto: "FDN-000 review", texto: "rama fdn/x", tipo: "evento" }), /enviado/);
  assert.match(c.enviar({ de: "claude-code-a", para: "todos", asunto: "FDN-000 cambio", texto: "pido", tipo: "solicitud" }), /enviado/);
  assert.equal(resolverRaiz({ FME_COORD_DIR: process.env.FME_COORD_DIR }), process.env.FME_COORD_DIR);
  assert.match(resolverRaiz({}), /FME-ops$/);
});

test("relevo entre equipos (ADR-0013): sospechoso, caída con acta, relevo y reincorporación", () => {
  const T0 = "2030-01-01T10:00:00.000Z";
  process.env.FME_AHORA = T0;
  try {
    reg("codex", "r1", "rel-cx");
    reg("antigravity", "r2", "rel-ag");
    reg("claude-code", "int", "rel-int");
    c.reclamar({ sesion: "codex-r1", ruta: "packages/render-plan", motivo: "FDN-071" });
    c.reclamar({ sesion: "codex-r1", ruta: "packages/otra", motivo: "FDN-099" });
    assert.match(c.equipos(), /rel-cx \| activo/);

    process.env.FME_AHORA = "2030-01-01T11:05:00.000Z"; // 65 min sin latido
    c.avance({ sesion: "antigravity-r2", texto: "sigo vivo" });
    const tabla = c.equipos();
    assert.match(tabla, /rel-cx \| sospechoso/);
    assert.match(tabla, /rel-ag \| activo/);

    assert.throws(() => c.caida({ sesion: "claude-code-int", equipo: "rel-cx" }), /Falta --cita/);
    assert.match(c.caida({ sesion: "claude-code-int", equipo: "rel-cx", cita: "Codex se quedó sin tokens" }), /caído/);
    assert.throws(() => c.caida({ sesion: "claude-code-int", equipo: "rel-cx", cita: "otra vez" }), /ya está declarado/);
    assert.match(c.equipos(), /rel-cx \| caido/);

    assert.throws(() => c.relevar({ sesion: "claude-code-int", tarea: "FDN-071", de: "rel-ag", a: "rel-cx", cita: "x" }), /no está declarado caído/);
    assert.match(c.relevar({ sesion: "claude-code-int", tarea: "FDN-071", de: "rel-cx", a: "rel-ag", cita: "sí, que lo releve Antigravity" }), /Reclamos liberados: 1/);
    assert.doesNotMatch(c.estado(), /packages\/render-plan/); // reclamo de 071 liberado
    assert.match(c.estado(), /packages\/otra/); // el de otra tarea se conserva
    assert.match(c.buzon({ sesion: "antigravity-r2" }), /RELEVO FDN-071/);

    const r = c.reincorporar({ sesion: "claude-code-int", equipo: "rel-cx" });
    assert.match(r, /reincorporado/);
    const msg = c.buzon({ sesion: "codex-r1" });
    assert.match(msg, /Nota de reincorporación/);
    assert.match(msg, /FDN-071: rel-cx → rel-ag/);
    assert.doesNotMatch(c.equipos(), /rel-cx \| caido/);
    assert.throws(() => c.reincorporar({ sesion: "claude-code-int", equipo: "rel-cx" }), /no está caído/);
  } finally {
    delete process.env.FME_AHORA;
  }
});
