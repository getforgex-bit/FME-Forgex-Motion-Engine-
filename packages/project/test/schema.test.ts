import assert from "node:assert/strict";
import { test } from "node:test";
import type { Project } from "../src/index.ts";
import { SCHEMA_VERSION } from "../src/index.ts";
import { parseProject, projectJsonSchema, type ProjectFromSchema } from "../src/schema.ts";

// Test de tipos (lo comprueba `tsc`). Zod infiere `?: T | undefined` para los opcionales y `index.ts` usa `?: T`
// (exactOptionalPropertyTypes), así que la equivalencia es: (1) Project es asignable al tipo de Zod y
// (2) ambos coinciden estructuralmente una vez normalizados los opcionales.
type Norm<T> = T extends readonly (infer U)[]
  ? Norm<U>[]
  : T extends object
    ? { [K in keyof T]-?: Norm<Exclude<T[K], undefined>> }
    : T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const tiposEquivalentes: Equal<Norm<ProjectFromSchema>, Norm<Project>> = true;
const projectAsignableAZod = (p: Project): ProjectFromSchema => p;

function proyectoValido(): Project {
  return {
    schemaVersion: 3,
    id: "p1",
    name: "Demo",
    fps: { num: 30000, den: 1001 },
    width: 1920,
    height: 1080,
    seed: 42,
    assets: [{ id: "a1", type: "video", uri: "assets/a.mp4", hash: "abc" }],
    sequences: [
      {
        id: "s1",
        scenes: [
          {
            id: "sc1",
            durationFrames: 300,
            layers: [
              {
                id: "l1",
                kind: "video",
                assetId: "a1",
                startFrame: 0,
                durationFrames: 300,
                zIndex: 0,
                techniques: ["2d", "3d-with-2d"],
                channels: {
                  opacity: { defaultValue: 1, keyframes: [{ frame: 0, value: 0, easing: "smooth" }] },
                },
                externalProject: { pluginId: "revideo", uri: "ext/p.ts" },
              },
            ],
          },
        ],
      },
    ],
  };
}

function clone(): any {
  return structuredClone(proyectoValido());
}

test("los tipos de Zod e index.ts son equivalentes y SCHEMA_VERSION coincide", () => {
  assert.equal(tiposEquivalentes, true);
  assert.equal(typeof projectAsignableAZod, "function");
  assert.equal(SCHEMA_VERSION, 3);
  assert.equal(parseProject(proyectoValido()).ok, true);
});

test("errores con ruta y mensaje", () => {
  const p = clone();
  p.sequences[0].scenes[0].layers[0].startFrame = -1;
  const r = parseProject(p);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.errors[0]?.path, "sequences[0].scenes[0].layers[0].startFrame");
    assert.ok(r.errors[0]?.message);
  }
});

test("schemaVersion desconocido da un error estructurado", () => {
  for (const v of [4, 2, 1, 0, "3", null]) {
    const p = clone();
    p.schemaVersion = v;
    const r = parseProject(p);
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.errors.length, 1);
      assert.equal(r.errors[0]?.code, "unknown-schema-version");
      assert.equal(r.errors[0]?.path, "schemaVersion");
    }
  }
});

test("fotogramas enteros ≥ 0", () => {
  for (const bad of [1.5, -1, Number.NaN]) {
    const p = clone();
    p.sequences[0].scenes[0].durationFrames = bad;
    assert.equal(parseProject(p).ok, false, `durationFrames=${bad}`);
    const q = clone();
    q.sequences[0].scenes[0].layers[0].channels.opacity.keyframes[0].frame = bad;
    assert.equal(parseProject(q).ok, false, `keyframe=${bad}`);
  }
});

test("fps.num y fps.den enteros positivos", () => {
  for (const fps of [{ num: 0, den: 1 }, { num: 30, den: 0 }, { num: 29.97, den: 1 }, { num: 30, den: -1 }]) {
    const p = clone();
    p.fps = fps;
    assert.equal(parseProject(p).ok, false, JSON.stringify(fps));
  }
});

test("claves desconocidas, tipos incorrectos y entradas no objeto se rechazan", () => {
  const p = clone();
  p.extra = 1;
  assert.equal(parseProject(p).ok, false);
  const q = clone();
  q.sequences[0].scenes[0].layers[0].channels.noExiste = { defaultValue: 0, keyframes: [] };
  assert.equal(parseProject(q).ok, false);
  const r = clone();
  r.sequences[0].scenes[0].layers[0].techniques = ["4d"];
  assert.equal(parseProject(r).ok, false);
  for (const x of [null, 5, "x", []]) assert.equal(parseProject(x).ok, false);
});

test("el JSON Schema se genera desde Zod", () => {
  const js = projectJsonSchema();
  assert.equal(js.type, "object");
  assert.ok(JSON.stringify(js).includes("schemaVersion"));
});

test("capas text: text válido en kind 'text' y rechazado en otras capas (ADR-0012)", () => {
  const ok = clone();
  const capa = ok.sequences[0].scenes[0].layers[0];
  capa.kind = "text";
  delete capa.assetId;
  capa.text = { content: "Hola\nmundo", fontFamily: "Inter", fontSize: 48, color: "#fff" };
  assert.equal(parseProject(ok).ok, true);
  delete capa.text;
  assert.equal(parseProject(ok).ok, true, "una capa text sin text sigue siendo válida");

  const mala = clone();
  mala.sequences[0].scenes[0].layers[0].text = { content: "x" };
  const r = parseProject(mala);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.errors[0]?.path, "sequences[0].scenes[0].layers[0].text");
});

test("text: content no vacío, fontSize > 0, claves desconocidas rechazadas", () => {
  for (const text of [{ content: "" }, { content: "x", fontSize: 0 }, { content: "x", fontSize: -3 }, { content: "x", color: "" }, { content: "x", extra: 1 }, {}]) {
    const p = clone();
    const capa = p.sequences[0].scenes[0].layers[0];
    capa.kind = "text";
    capa.text = text;
    assert.equal(parseProject(p).ok, false, JSON.stringify(text));
  }
});

function conArtefacto(): any {
  const p = clone();
  p.artifacts = [{ id: "r1", uri: "renders/a.mp4", type: "video/mp4", dependencyHash: "abc", producedBy: { pluginId: "revideo", pluginVersion: "0.0.0" } }];
  return p;
}

test("artefactos: renderArtifactId debe existir en artifacts (ADR-0015)", () => {
  const ok = conArtefacto();
  ok.sequences[0].scenes[0].layers[0].externalProject.renderArtifactId = "r1";
  assert.equal(parseProject(ok).ok, true);

  const colgante = conArtefacto();
  colgante.sequences[0].scenes[0].layers[0].externalProject.renderArtifactId = "nadie";
  const r = parseProject(colgante);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.errors[0]?.path, "sequences[0].scenes[0].layers[0].externalProject.renderArtifactId");

  const sinCatalogo = clone();
  sinCatalogo.sequences[0].scenes[0].layers[0].externalProject.renderArtifactId = "r1";
  assert.equal(parseProject(sinCatalogo).ok, false, "sin artifacts, cualquier id está colgante");
  assert.equal(parseProject(clone()).ok, true, "sin referencias, artifacts es opcional");
});

test("artefactos: ids únicos y forma válida", () => {
  const dup = conArtefacto();
  dup.artifacts.push({ ...dup.artifacts[0] });
  const r = parseProject(dup);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.errors[0]?.path, "artifacts[1].id");
  const mal = conArtefacto();
  mal.artifacts[0].dependencyHash = "";
  assert.equal(parseProject(mal).ok, false);
  const extra = conArtefacto();
  extra.artifacts[0].otro = 1;
  assert.equal(parseProject(extra).ok, false);
});
