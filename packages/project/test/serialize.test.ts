import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { Project } from "../src/index.ts";
import { deserialize, serialize } from "../src/serialize.ts";

function proyecto(): Project {
  return {
    schemaVersion: 2,
    id: "p1",
    name: "Demo",
    fps: { num: 30000, den: 1001 },
    width: 1920,
    height: 1080,
    seed: 7,
    assets: [{ id: "a1", type: "image", uri: "assets/a.png", licenseId: "cc0" }],
    sequences: [
      {
        id: "s1",
        scenes: [
          {
            id: "sc1",
            durationFrames: 60,
            layers: [
              {
                id: "l1",
                kind: "image",
                assetId: "a1",
                startFrame: 0,
                durationFrames: 60,
                zIndex: 1,
                techniques: ["2.5d"],
                channels: {
                  x: { defaultValue: 0, keyframes: [{ frame: 0, value: 0 }, { frame: 59, value: 100, easing: "linear" }] },
                  opacity: { defaultValue: 1, keyframes: [] },
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

test("round-trip estable: deserialize(serialize(p)) es igual y serialize es idempotente", () => {
  const p = proyecto();
  const texto = serialize(p);
  const r = deserialize(texto);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.value, p);
    assert.equal(serialize(r.value), texto);
  }
});

test("el orden de claves es determinista", () => {
  const p = proyecto();
  const invertido = Object.fromEntries(Object.entries(p).reverse()) as unknown as Project;
  assert.equal(serialize(invertido), serialize(p));
  const claves = Object.keys(JSON.parse(serialize(p)));
  assert.deepEqual(claves, [...claves].sort());
  assert.ok(serialize(p).endsWith("}\n"));
});

test("deserialize: JSON mal formado y schemaVersion desconocido dan errores estructurados", () => {
  const a = deserialize("{no es json");
  assert.equal(a.ok, false);
  if (!a.ok) assert.equal(a.errors[0]?.code, "invalid-json");
  const b = deserialize(JSON.stringify({ ...proyecto(), schemaVersion: 99 }));
  assert.equal(b.ok, false);
  if (!b.ok) assert.equal(b.errors[0]?.code, "unknown-schema-version");
});

test("serialize rechaza un proyecto no válido", () => {
  const p = { ...proyecto(), width: 0 };
  assert.throws(() => serialize(p), /no válido/);
});

test("deserialize migra la fixture v0 hasta la versión actual y es estable (FDN-026)", () => {
  const ruta = join(import.meta.dirname, "fixtures-v0", "project.fme.json");
  const texto = readFileSync(ruta, "utf8").replace(/\r\n/g, "\n");
  const a = deserialize(texto);
  assert.equal(a.ok, true);
  if (!a.ok) return;
  assert.equal(a.value.schemaVersion, 2);
  assert.deepEqual(a.value.fps, { num: 25, den: 1 });
  assert.equal(a.value.id, JSON.parse(texto).id);
  const salida = serialize(a.value);
  assert.equal(JSON.parse(salida).schemaVersion, 2);
  const b = deserialize(salida);
  assert.equal(b.ok, true);
  if (b.ok) {
    assert.deepEqual(b.value, a.value);
    assert.equal(serialize(b.value), salida);
  }
});

test("deserialize: versión futura o inválida sigue dando unknown-schema-version", () => {
  for (const v of [3, 99, -1, "2", null]) {
    const r = deserialize(JSON.stringify({ ...proyecto(), schemaVersion: v }));
    assert.equal(r.ok, false, String(v));
    if (!r.ok) assert.equal(r.errors[0]?.code, "unknown-schema-version", String(v));
  }
});
