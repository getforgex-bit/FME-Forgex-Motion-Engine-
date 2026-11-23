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
