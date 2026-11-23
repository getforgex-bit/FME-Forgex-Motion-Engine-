// FDN-023: el 100 % de las fixtures validan y hacen round-trip byte a byte.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { deserialize, framesToSeconds, parseProject, serialize } from "../src/index.ts";
import type { Project } from "../src/index.ts";

const dir = join(import.meta.dirname, "fixtures");
const hibrida = join(import.meta.dirname, "..", "..", "..", "examples", "prueba-hibrida-10s", "project.fme.json");
const archivos = [...readdirSync(dir).filter((f) => f.endsWith(".fme.json")).map((f) => join(dir, f)), hibrida];

function cargar(ruta: string): Project {
  const r = deserialize(readFileSync(ruta, "utf8"));
  assert.ok(r.ok, r.ok ? "" : JSON.stringify(r.errors));
  return r.value;
}

test("hay al menos 3 fixtures (mínima, 29,97 e híbrida)", () => {
  assert.ok(archivos.length >= 3);
});

for (const ruta of archivos) {
  test(`fixture válida y con round-trip idéntico: ${ruta.split(/[\/]/).slice(-2).join("/")}`, () => {
    const texto = readFileSync(ruta, "utf8");
    const p = cargar(ruta);
    assert.equal(parseProject(JSON.parse(texto)).ok, true);
    assert.equal(serialize(p), texto);
  });
}

test("híbrida: 300 fotogramas a 30 FPS = 10 s con los rangos del README", () => {
  const p = cargar(hibrida);
  const escena = p.sequences[0]!.scenes[0]!;
  assert.equal(escena.durationFrames, 300);
  assert.equal(framesToSeconds(escena.durationFrames, p.fps), 10);
  const capa = (id: string) => escena.layers.find((l) => l.id === id)!;
  const rango = (id: string) => [capa(id).startFrame, capa(id).startFrame + capa(id).durationFrames - 1];
  assert.deepEqual(rango("capa-fondo"), [0, 299]);
  assert.deepEqual(rango("capa-2d"), [30, 239]);
  assert.deepEqual(rango("capa-3d"), [105, 254]);
  assert.deepEqual(rango("capa-titulo"), [180, 299]);
  assert.equal(capa("capa-2d").externalProject?.pluginId, "revideo");
  assert.equal(capa("capa-titulo").externalProject?.pluginId, "revideo");
  assert.equal(capa("capa-3d").externalProject?.pluginId, "blender");
  assert.equal(capa("capa-titulo").guide3DLayerId, "capa-3d");
  for (const canal of ["expression", "integration"] as const) {
    const animado = escena.layers.some((l) => (l.channels[canal]?.keyframes.length ?? 0) >= 2);
    assert.ok(animado, `${canal} animado`);
  }
});

test("29,97: la duración en segundos es exacta (30000 fotogramas = 1001 s)", () => {
  const p = cargar(join(dir, "ntsc-2997.fme.json"));
  assert.deepEqual(p.fps, { num: 30000, den: 1001 });
  const frames = p.sequences[0]!.scenes[0]!.durationFrames;
  assert.equal(frames, 30000);
  assert.equal(framesToSeconds(frames, p.fps), 1001);
});
