// Prueba mínima de la infraestructura de tests de paquetes (FDN-003): node:test + type stripping de Node.
import assert from "node:assert/strict";
import { test } from "node:test";
import { SCHEMA_VERSION } from "../src/index.ts";

test("el contrato de proyecto expone schemaVersion 3", () => {
  assert.equal(SCHEMA_VERSION, 3);
});
