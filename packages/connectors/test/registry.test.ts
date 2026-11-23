import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  CONTRACT_VERSION,
  type CardAdvanced,
  type CardSimple,
} from '../src/index.ts';
import {
  ADVANCED_SECTIONS,
  ConnectorRegistry,
  ConnectorRegistryError,
  createConnectorRegistry,
  type AdvancedSection,
} from '../src/registry.ts';

function makeSimple(overrides: Partial<CardSimple> = {}): CardSimple {
  return {
    id: 'adapter.revideo',
    name: 'Revideo',
    version: '0.10.0',
    contractVersion: CONTRACT_VERSION,
    capabilities: ['animate.vector', 'render.video'],
    accepts: ['fme/scene+json', 'image/svg+xml'],
    produces: ['video/mp4', 'image/png-sequence'],
    executor: 'cli',
    ...overrides,
  };
}

function makeAdvanced(overrides: Partial<CardAdvanced> = {}): CardAdvanced {
  return {
    pluginId: 'adapter.revideo',
    technical: {
      alpha: 'yes',
      depth: 'unknown',
      keyframes: 'yes',
    },
    limits: {
      maxWidth: 3840,
      maxHeight: 2160,
    },
    permissions: ['fs:workdir', 'proc:spawn'],
    editability: 'native',
    licenseReview: 'approved',
    ...overrides,
  };
}

describe('ConnectorRegistry (FDN-030)', () => {
  test('alta, consulta básica, tamaño y baja con unregister', () => {
    const registry = createConnectorRegistry();
    assert.ok(registry instanceof ConnectorRegistry);
    assert.equal(registry.size, 0);

    const revideo = makeSimple();
    const blender = makeSimple({
      id: 'adapter.blender',
      name: 'Blender',
      version: '5.2.0',
      capabilities: ['render.3d', 'render.video'],
      accepts: ['fme/scene+json', 'model/gltf-binary'],
      produces: ['image/png-sequence', 'video/mp4'],
      executor: 'cli',
    });

    registry.register(revideo, makeAdvanced());
    registry.register(blender);

    assert.equal(registry.size, 2);
    assert.equal(registry.has('adapter.revideo'), true);
    assert.equal(registry.has('adapter.blender'), true);
    assert.equal(registry.has('adapter.missing'), false);

    assert.equal(registry.unregister('adapter.revideo'), true);
    assert.equal(registry.unregister('adapter.revideo'), false);
    assert.equal(registry.size, 1);
    assert.equal(registry.has('adapter.revideo'), false);

    assert.throws(
      () => registry.inspect('adapter.revideo', ['technical']),
      (err: unknown) =>
        err instanceof ConnectorRegistryError &&
        err.code === 'CONNECTOR_NOT_FOUND' &&
        err.connectorId === 'adapter.revideo',
    );

    // Permite volver a registrar tras dar de baja
    registry.register(revideo);
    assert.equal(registry.size, 2);
    assert.equal(registry.has('adapter.revideo'), true);
  });

  test('rechaza duplicados por id con error estructurado', () => {
    const registry = createConnectorRegistry();
    registry.register(makeSimple({ id: 'adapter.freecut' }));

    assert.throws(
      () => registry.register(makeSimple({ id: 'adapter.freecut', name: 'Otro' })),
      (err: unknown) =>
        err instanceof ConnectorRegistryError &&
        err.code === 'DUPLICATE_CONNECTOR' &&
        err.connectorId === 'adapter.freecut',
    );
  });

  test('rechaza contractVersion incompatible', () => {
    const registry = createConnectorRegistry();
    const invalidVersionCard = {
      ...makeSimple({ id: 'adapter.future' }),
      contractVersion: '0.2',
    } as unknown as CardSimple;

    assert.throws(
      () => registry.register(invalidVersionCard),
      (err: unknown) =>
        err instanceof ConnectorRegistryError &&
        err.code === 'INCOMPATIBLE_CONTRACT_VERSION' &&
        err.connectorId === 'adapter.future',
    );
  });

  test('rechaza tarjetas simples o avanzadas inválidas y pluginId inconsistente', () => {
    const registry = createConnectorRegistry();

    assert.throws(
      () => registry.register(makeSimple({ id: '   ' })),
      (err: unknown) =>
        err instanceof ConnectorRegistryError && err.code === 'INVALID_CARD',
    );

    assert.throws(
      () =>
        registry.register(
          makeSimple({ capabilities: ['animate.vector', ''] }),
        ),
      (err: unknown) =>
        err instanceof ConnectorRegistryError && err.code === 'INVALID_CARD',
    );

    assert.throws(
      () =>
        registry.register(
          makeSimple({ id: 'adapter.revideo' }),
          makeAdvanced({ pluginId: 'adapter.otro' }),
        ),
      (err: unknown) =>
        err instanceof ConnectorRegistryError &&
        err.code === 'PLUGIN_ID_MISMATCH' &&
        err.connectorId === 'adapter.revideo',
    );

    const invalidTech = {
      ...makeAdvanced(),
      technical: { alpha: 'maybe' },
    } as unknown as CardAdvanced;

    assert.throws(
      () => registry.register(makeSimple(), invalidTech),
      (err: unknown) =>
        err instanceof ConnectorRegistryError && err.code === 'INVALID_CARD',
    );
  });

  test('listSimple filtra por capability, capabilities, accepts, produces y executor sin exponer CardAdvanced', () => {
    const registry = createConnectorRegistry();
    registry.register(makeSimple(), makeAdvanced());
    registry.register(
      makeSimple({
        id: 'adapter.freecut',
        name: 'FreeCut',
        capabilities: ['edit.timeline', 'render.video'],
        accepts: ['video/mp4', 'audio/wav'],
        produces: ['video/mp4'],
        executor: 'api',
      }),
    );
    registry.register(
      makeSimple({
        id: 'adapter.blender',
        name: 'Blender',
        capabilities: ['render.3d', 'render.video'],
        accepts: ['fme/scene+json', 'model/gltf-binary'],
        produces: ['image/png-sequence'],
        executor: 'cli',
      }),
    );

    const all = registry.listSimple();
    assert.equal(all.length, 3);
    for (const item of all) {
      assert.deepEqual(Object.keys(item).sort(), [
        'card',
        'inspectionSections',
        'requiresInspection',
        'unknownRequirements',
      ]);
      assert.equal('advanced' in item, false);
      assert.equal(item.requiresInspection, false);
      assert.deepEqual(item.unknownRequirements, []);
      assert.deepEqual(item.inspectionSections, []);
    }

    const byCap = registry.listSimple({ capability: 'animate.vector' });
    assert.deepEqual(
      byCap.map((x) => x.card.id),
      ['adapter.revideo'],
    );

    const byCapsAndProduces = registry.listSimple({
      capabilities: ['render.video'],
      produces: ['image/png-sequence'],
    });
    assert.deepEqual(
      byCapsAndProduces.map((x) => x.card.id),
      ['adapter.revideo', 'adapter.blender'],
    );

    const byAcceptsMulti = registry.listSimple({
      accepts: ['video/mp4', 'audio/wav'],
    });
    assert.deepEqual(
      byAcceptsMulti.map((x) => x.card.id),
      ['adapter.freecut'],
    );

    const byExecutorSingle = registry.listSimple({ executor: 'api' });
    assert.deepEqual(
      byExecutorSingle.map((x) => x.card.id),
      ['adapter.freecut'],
    );

    const byExecutorList = registry.listSimple({
      executor: ['api', 'mcp'],
    });
    assert.deepEqual(
      byExecutorList.map((x) => x.card.id),
      ['adapter.freecut'],
    );
  });

  test('semántica yes/no/unknown: nunca trata unknown ni ausencia de CardAdvanced como yes', () => {
    const registry = createConnectorRegistry();

    // alpha=yes, depth=unknown
    registry.register(
      makeSimple({ id: 'con.alpha-yes-depth-unknown' }),
      makeAdvanced({
        pluginId: 'con.alpha-yes-depth-unknown',
        technical: { alpha: 'yes', depth: 'unknown', telemetry: 'no' },
      }),
    );

    // alpha=no, depth=unknown -> debe quedar excluido cuando se exige alpha=yes
    registry.register(
      makeSimple({ id: 'con.alpha-no-depth-unknown' }),
      makeAdvanced({
        pluginId: 'con.alpha-no-depth-unknown',
        technical: { alpha: 'no', depth: 'unknown' },
      }),
    );

    // alpha ausente en technical -> requiere inspección
    registry.register(
      makeSimple({ id: 'con.alpha-missing-key' }),
      makeAdvanced({
        pluginId: 'con.alpha-missing-key',
        technical: { keyframes: 'yes' },
      }),
    );

    // Sin CardAdvanced -> requiere inspección
    registry.register(makeSimple({ id: 'con.no-advanced' }));

    const alphaMatches = registry.listSimple({
      requiredTechnical: ['alpha'],
    });
    assert.deepEqual(
      alphaMatches.map((x) => ({
        id: x.card.id,
        requiresInspection: x.requiresInspection,
        unknownRequirements: x.unknownRequirements,
        inspectionSections: x.inspectionSections,
      })),
      [
        {
          id: 'con.alpha-yes-depth-unknown',
          requiresInspection: false,
          unknownRequirements: [],
          inspectionSections: [],
        },
        {
          id: 'con.alpha-missing-key',
          requiresInspection: true,
          unknownRequirements: ['alpha'],
          inspectionSections: ['technical'],
        },
        {
          id: 'con.no-advanced',
          requiresInspection: true,
          unknownRequirements: ['alpha'],
          inspectionSections: ['technical'],
        },
      ],
    );

    // Exige alpha=yes y depth=yes: el primero pasa pero requiere inspección SOLO por depth
    const alphaAndDepth = registry.listSimple({
      technical: { alpha: 'yes', depth: 'yes' },
    });
    assert.equal(alphaAndDepth.length, 3);
    assert.deepEqual(alphaAndDepth[0]?.unknownRequirements, ['depth']);
    assert.equal(alphaAndDepth[0]?.requiresInspection, true);
    assert.deepEqual(alphaAndDepth[1]?.unknownRequirements, ['alpha', 'depth']);
    assert.deepEqual(alphaAndDepth[2]?.unknownRequirements, ['alpha', 'depth']);

    // Requisito negativo: telemetry='no' confirma al primero y marca inspección a los unknown
    const noTelemetry = registry.listSimple({
      technical: { telemetry: 'no' },
    });
    assert.equal(noTelemetry[0]?.card.id, 'con.alpha-yes-depth-unknown');
    assert.equal(noTelemetry[0]?.requiresInspection, false);
    assert.equal(noTelemetry[1]?.requiresInspection, true);
    assert.deepEqual(noTelemetry[1]?.unknownRequirements, ['telemetry']);

    // Filtro contradictorio falla de forma explícita
    assert.throws(
      () =>
        registry.listSimple({
          requiredTechnical: ['alpha'],
          technical: { alpha: 'no' },
        }),
      (err: unknown) =>
        err instanceof ConnectorRegistryError && err.code === 'INVALID_FILTER',
    );
  });

  test('inspect devuelve exclusivamente las secciones pedidas y maneja vacías, duplicadas y sin avanzada', () => {
    const registry = createConnectorRegistry();
    registry.register(makeSimple({ id: 'adapter.revideo' }), makeAdvanced());
    registry.register(makeSimple({ id: 'adapter.bare' }));
    const { limits: _omittedLimits, ...withoutLimitsCard } = makeAdvanced({
      pluginId: 'adapter.nolimits',
    });
    registry.register(
      makeSimple({ id: 'adapter.nolimits' }),
      withoutLimitsCard,
    );

    const onlyTechnical = registry.inspect('adapter.revideo', ['technical']);
    assert.equal(onlyTechnical.pluginId, 'adapter.revideo');
    assert.equal(onlyTechnical.hasAdvanced, true);
    assert.deepEqual(Object.keys(onlyTechnical.sections), ['technical']);
    assert.deepEqual(onlyTechnical.sections.technical, {
      alpha: 'yes',
      depth: 'unknown',
      keyframes: 'yes',
    });

    const twoWithDuplicates = registry.inspect('adapter.revideo', [
      'permissions',
      'licenseReview',
      'permissions',
    ]);
    assert.deepEqual(Object.keys(twoWithDuplicates.sections), [
      'permissions',
      'licenseReview',
    ]);
    assert.deepEqual(twoWithDuplicates.sections.permissions, [
      'fs:workdir',
      'proc:spawn',
    ]);
    assert.equal(twoWithDuplicates.sections.licenseReview, 'approved');

    const emptySections = registry.inspect('adapter.revideo', []);
    assert.equal(emptySections.hasAdvanced, true);
    assert.deepEqual(Object.keys(emptySections.sections), []);

    const allSections = registry.inspect('adapter.revideo', ADVANCED_SECTIONS);
    assert.deepEqual(Object.keys(allSections.sections), [...ADVANCED_SECTIONS]);

    const withoutLimits = registry.inspect('adapter.nolimits', [
      'limits',
      'editability',
    ]);
    assert.deepEqual(Object.keys(withoutLimits.sections), ['editability']);
    assert.equal(withoutLimits.sections.editability, 'native');

    const withoutAdvanced = registry.inspect('adapter.bare', ['technical']);
    assert.deepEqual(withoutAdvanced, {
      pluginId: 'adapter.bare',
      hasAdvanced: false,
      sections: {},
    });

    assert.throws(
      () => registry.inspect('adapter.unknown', ['technical']),
      (err: unknown) =>
        err instanceof ConnectorRegistryError &&
        err.code === 'CONNECTOR_NOT_FOUND',
    );

    assert.throws(
      () =>
        registry.inspect('adapter.revideo', [
          'secret' as unknown as AdvancedSection,
        ]),
      (err: unknown) =>
        err instanceof ConnectorRegistryError &&
        err.code === 'INVALID_INSPECT_SECTION',
    );
  });

  test('garantiza aislamiento frente a mutaciones externas de entrada y salida', () => {
    const registry = createConnectorRegistry();
    const simple = makeSimple();
    const advanced = makeAdvanced();

    registry.register(simple, advanced);

    // Mutación de las referencias originales tras registrar
    simple.name = 'Mutado';
    simple.capabilities.push('hacked.cap');
    advanced.technical.alpha = 'no';
    advanced.permissions.push('root:all');
    if (advanced.limits !== undefined) {
      advanced.limits.maxWidth = 1;
    }

    const listed = registry.listSimple();
    assert.equal(listed[0]?.card.name, 'Revideo');
    assert.deepEqual(listed[0]?.card.capabilities, [
      'animate.vector',
      'render.video',
    ]);

    // Mutación de los objetos devueltos por listSimple e inspect
    listed[0]?.card.capabilities.push('client.mutated');
    listed[0]?.unknownRequirements.push('client.req');

    const inspected = registry.inspect('adapter.revideo', [
      'technical',
      'limits',
      'permissions',
    ]);
    if (inspected.sections.technical !== undefined) {
      inspected.sections.technical.alpha = 'no';
    }
    if (inspected.sections.limits !== undefined) {
      inspected.sections.limits.maxWidth = 999;
    }
    inspected.sections.permissions?.push('client.perm');

    const listedAgain = registry.listSimple({
      requiredTechnical: ['alpha'],
    });
    assert.equal(listedAgain.length, 1);
    assert.equal(listedAgain[0]?.requiresInspection, false);
    assert.deepEqual(listedAgain[0]?.card.capabilities, [
      'animate.vector',
      'render.video',
    ]);

    const inspectedAgain = registry.inspect('adapter.revideo', [
      'technical',
      'limits',
      'permissions',
    ]);
    assert.equal(inspectedAgain.sections.technical?.alpha, 'yes');
    assert.equal(inspectedAgain.sections.limits?.maxWidth, 3840);
    assert.deepEqual(inspectedAgain.sections.permissions, [
      'fs:workdir',
      'proc:spawn',
    ]);
  });

  test('instancias creadas por createConnectorRegistry están aisladas entre sí', () => {
    const a = createConnectorRegistry();
    const b = createConnectorRegistry();

    a.register(makeSimple({ id: 'adapter.only-a' }));
    assert.equal(a.size, 1);
    assert.equal(b.size, 0);
    assert.equal(b.has('adapter.only-a'), false);
  });
});
