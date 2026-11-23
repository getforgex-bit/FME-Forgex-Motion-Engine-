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

/** Lee normalizando CRLF a LF (autocrlf de Git en Windows). */
function leer(ruta: string): string {
  return readFileSync(ruta, "utf8").replace(/\r\n/g, "\n");
}

function cargar(ruta: string): Project {
  const r = deserialize(leer(ruta));
  assert.ok(r.ok, r.ok ? "" : JSON.stringify(r.errors));
  return r.value;
}

test("hay al menos 3 fixtures (mínima, 29,97 e híbrida)", () => {
  assert.ok(archivos.length >= 3);
});

for (const ruta of archivos) {
  test(`fixture válida y con round-trip idéntico: ${ruta.split(/[\/]/).slice(-2).join("/")}`, () => {
    const texto = leer(ruta);
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

test("híbrida v3: el título lleva su texto real (ADR-0012) y los artefactos están enlazados (ADR-0015)", () => {
  const p = cargar(hibrida);
  const capas = p.sequences[0]!.scenes[0]!.layers;
  const titulo = capas.find((l) => l.id === "capa-titulo")!;
  assert.equal(titulo.kind, "text");
  assert.equal(titulo.text?.content, "Forgex Motion Engine");
  assert.deepEqual(p.artifacts?.map((a) => a.id), ["render-3d", "render-titulo"]);
  assert.equal(capas.find((l) => l.id === "capa-3d")!.externalProject?.renderArtifactId, "render-3d");
  assert.equal(titulo.externalProject?.renderArtifactId, "render-titulo");
  assert.equal(p.artifacts?.[0]?.producedBy.pluginId, "blender");
});

// Fixtures de migración: v0 (sintética), v1 y v2 se migran a v3 y validan; las v1 y v2 equivalen a las vigentes.
const v1 = join(import.meta.dirname, "fixtures-v1");
const v2 = join(import.meta.dirname, "fixtures-v2");
const v0 = join(import.meta.dirname, "fixtures-v0", "project.fme.json");

for (const ruta of [v0, ...readdirSync(v1).map((f) => join(v1, f)), ...readdirSync(v2).map((f) => join(v2, f))]) {
  test(`migra a v3 y valida: ${ruta.split(/[\/]/).slice(-2).join("/")}`, () => {
    const p = cargar(ruta);
    assert.equal(p.schemaVersion, 3);
    assert.equal(serialize(cargar_texto(serialize(p))), serialize(p), "estable tras migrar");
  });
}

function cargar_texto(texto: string): Project {
  const r = deserialize(texto);
  assert.ok(r.ok);
  return r.value;
}

test("las fixtures v1 y v2 mínima y 29,97 migran exactamente a las v3 vigentes", () => {
  for (const dirMigracion of [v1, v2]) {
    for (const f of ["minima.fme.json", "ntsc-2997.fme.json"]) {
      assert.equal(serialize(cargar(join(dirMigracion, f))), leer(join(dir, f)), `${dirMigracion}/${f}`);
    }
  }
});

/** La híbrida vigente sin lo que añadieron las versiones posteriores a la v1 (texto) y a la v2 (artefactos y su enlace). */
function hibridaSin(quitar: { texto: boolean }): Project {
  const p = cargar(hibrida);
  delete p.artifacts;
  for (const capa of p.sequences[0]!.scenes[0]!.layers) {
    if (capa.externalProject) delete capa.externalProject.renderArtifactId;
    if (quitar.texto) delete capa.text;
  }
  return p;
}

test("la híbrida v2 migra a la v3 salvo los artefactos y su enlace (el id colgante se elimina)", () => {
  const v2Texto = JSON.parse(readFileSync(join(v2, "hibrida.fme.json"), "utf8"));
  const colgante = v2Texto.sequences[0].scenes[0].layers.find((l: any) => l.id === "capa-3d").externalProject.renderArtifactId;
  assert.equal(colgante, "render-3d", "la fixture v2 conserva el puntero que no apuntaba a nada");
  assert.deepEqual(cargar(join(v2, "hibrida.fme.json")), hibridaSin({ texto: false }));
});

test("la híbrida v1 migra a la v3 salvo el texto, los artefactos y su enlace", () => {
  assert.deepEqual(cargar(join(v1, "hibrida.fme.json")), hibridaSin({ texto: true }));
});
