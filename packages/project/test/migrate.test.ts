import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { SCHEMA_VERSION } from '../src/index.ts';
import { migrateToCurrent } from '../src/migrate.ts';
import { parseProject } from '../src/schema.ts';

const fixtureText = readFileSync(new URL('./fixtures-v0/project.fme.json', import.meta.url), 'utf8');

test('migra la fixture sintética v0 y conserva activos, escenas y referencias', () => {
  const fixture = JSON.parse(fixtureText);
  // v2→v3 (ADR-0015) elimina los renderArtifactId, que en v0–v2 no apuntaban a ningún catálogo.
  const expected = JSON.parse(JSON.stringify({ ...fixture, schemaVersion: SCHEMA_VERSION, fps: { num: 25, den: 1 } }),
    (key, value) => (key === 'renderArtifactId' ? undefined : value));
  const migrated = migrateToCurrent(fixture);

  assert.deepEqual(migrated, { ok: true, value: expected });
  assert.equal(JSON.stringify(fixture), JSON.stringify(JSON.parse(fixtureText)));
  assert.ok(migrated.ok);
  assert.deepEqual(parseProject(migrated.value), migrated);
  assert.deepEqual(migrateToCurrent(migrated.value), migrated);
});

test('valida un proyecto vigente con el mismo esquema de proyecto', () => {
  const fixture = JSON.parse(fixtureText);
  const invalidCurrent = { ...fixture, schemaVersion: SCHEMA_VERSION, fps: { num: 25, den: 0 } };
  const result = migrateToCurrent(invalidCurrent);
  assert.deepEqual(result, parseProject(invalidCurrent));
  assert.ok(!result.ok);
  assert.equal(result.errors[0]?.path, 'fps.den');
});

test('informa versiones futuras y desconocidas de forma estructurada', () => {
  for (const schemaVersion of [SCHEMA_VERSION + 1, -1, '0', null, NaN, 1n]) {
    const result = migrateToCurrent({ schemaVersion });
    assert.ok(!result.ok);
    assert.equal(result.errors[0]?.path, 'schemaVersion');
    assert.equal(result.errors[0]?.code, 'unknown-schema-version');
  }

  for (const input of [null, [], {}]) {
    assert.deepEqual(migrateToCurrent(input), parseProject(input));
  }
});

test('informa un FPS v0 inválido y aplica la validación estricta al resultado', () => {
  const fixture = JSON.parse(fixtureText);
  for (const fps of [0, 29.97, '25', { num: 25, den: 1 }, undefined]) {
    const invalid = migrateToCurrent({ ...fixture, fps });
    assert.ok(!invalid.ok);
    assert.equal(invalid.errors[0]?.path, 'fps');
    assert.equal(invalid.errors[0]?.code, 'invalid-migration-input');
  }

  const invalid = migrateToCurrent({ ...fixture, unexpectedField: true });
  assert.ok(!invalid.ok);
  assert.ok(invalid.errors.some((issue) =>
    issue.code === 'unrecognized_keys' && issue.message.includes('unexpectedField'),
  ));
});
