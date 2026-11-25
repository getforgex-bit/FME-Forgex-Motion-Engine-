// Conformidad de AdapterJobResult (ADR-0011).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkAdapterResult, type AdapterJobResult } from '../src/adapter.ts';
import type { CardSimple } from '../src/index.ts';

const simple: CardSimple = {
  id: 'adapter.demo', name: 'Demo', version: '0.0.1', contractVersion: '0.1',
  capabilities: ['render.video'], accepts: ['fme/scene+json'], produces: ['video/mp4'], executor: 'cli',
};
const sha = 'a'.repeat(64);
const ok: AdapterJobResult = {
  jobId: 'j1', status: 'ok', diagnostics: [],
  outputs: [{ uri: 'file:///w/out.mp4', type: 'video/mp4' }],
  provenance: [{ uri: 'file:///w/out.mp4', type: 'video/mp4', sha256: sha, pluginId: 'adapter.demo', pluginVersion: '0.0.1',
    engineVersion: '1.0.0', params: { fps: 30 }, startedAt: '2026-11-23T00:00:00.000Z', durationMs: 10 }],
};

test('un resultado ok conforme no tiene incumplimientos', () => {
  assert.deepEqual(checkAdapterResult(ok, { simple }), []);
});

test('detecta procedencia incompleta, hash inválido y tipo no declarado', () => {
  const bad: AdapterJobResult = { ...ok, outputs: [{ uri: 'file:///w/out.webm', type: 'video/webm' }],
    provenance: [{ ...ok.provenance[0]!, sha256: 'x', uri: 'file:///w/otro.mp4' }] };
  const issues = checkAdapterResult(bad, { simple });
  assert.ok(issues.some((i) => i.includes('sha256')));
  assert.ok(issues.some((i) => i.includes('uri no coincide')));
  assert.ok(issues.some((i) => i.includes('produces')));
});

test('un fallo exige diagnostics y procedencia vacía', () => {
  const failed: AdapterJobResult = { jobId: 'j2', status: 'failed', outputs: [], diagnostics: [], provenance: [] };
  assert.ok(checkAdapterResult(failed, { simple }).some((i) => i.includes('sin diagnostics')));
  assert.deepEqual(checkAdapterResult({ ...failed, diagnostics: [{ code: 'engine-missing', message: 'x' }] }, { simple }), []);
});
