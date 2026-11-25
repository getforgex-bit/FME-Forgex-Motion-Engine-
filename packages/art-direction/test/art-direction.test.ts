import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  ANIMATION_PRINCIPLES,
  ART_DIRECTION_SCHEMA_VERSION,
  ArtDirectionValidationError,
  STYLE_PRESETS,
  applyArtDirection,
  buildArtDirectionPlan,
  parseArtDirectionPlan,
  parseStyleProfile,
  styleProfileJsonSchema,
  type ArtDirectionPlan,
  type StyleProfile,
} from '../src/index.ts';
import {
  SCHEMA_VERSION,
  deserialize,
  parseProject,
  serialize,
  type Curve,
  type Project,
} from '../../project/src/index.ts';

function createFixtureProject(seed = 42): Project {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: 'proj-art-01',
    name: 'Escena híbrida de prueba',
    fps: { num: 30, den: 1 },
    width: 1920,
    height: 1080,
    seed,
    assets: [
      {
        id: 'asset-bg',
        type: 'video',
        uri: 'assets/bg.mp4',
      },
      {
        id: 'asset-char',
        type: 'drawing',
        uri: 'assets/char.svg',
      },
    ],
    sequences: [
      {
        id: 'seq-main',
        scenes: [
          {
            id: 'scene-intro',
            durationFrames: 120,
            layers: [
              {
                id: 'layer-bg',
                kind: 'video',
                assetId: 'asset-bg',
                startFrame: 0,
                durationFrames: 120,
                zIndex: 0,
                techniques: ['2d'],
                channels: {
                  opacity: { defaultValue: 1, keyframes: [] },
                },
              },
              {
                id: 'layer-hero',
                kind: 'drawing',
                assetId: 'asset-char',
                startFrame: 10,
                durationFrames: 90,
                zIndex: 1,
                techniques: ['2d', '2d-guided-by-3d'],
                channels: {
                  expression: {
                    defaultValue: 0.25,
                    keyframes: [{ frame: 0, value: 0.25, easing: 'linear' }],
                  },
                },
              },
            ],
          },
          {
            id: 'scene-short',
            durationFrames: 1,
            layers: [
              {
                id: 'layer-single-frame',
                kind: 'text',
                startFrame: 0,
                durationFrames: 1,
                zIndex: 2,
                techniques: ['2.5d'],
                channels: {},
              },
              {
                id: 'layer-zero-frame',
                kind: 'group',
                startFrame: 0,
                durationFrames: 0,
                zIndex: 3,
                techniques: ['3d-with-2d'],
                channels: {},
              },
            ],
          },
        ],
      },
      {
        id: 'seq-alt',
        scenes: [
          {
            id: 'scene-outro',
            durationFrames: 60,
            layers: [
              {
                id: 'layer-3d',
                kind: 'model3d',
                startFrame: 0,
                durationFrames: 60,
                zIndex: 0,
                techniques: ['3d'],
                channels: {},
              },
            ],
          },
        ],
      },
    ],
  };
}

function assertCurveInvariants(curve: Curve, durationFrames: number, label: string): void {
  assert.ok(Number.isFinite(curve.defaultValue), `${label}: defaultValue debe ser finito`);
  assert.ok(
    curve.defaultValue >= 0 && curve.defaultValue <= 1,
    `${label}: defaultValue fuera de [0, 1]: ${curve.defaultValue}`,
  );
  assert.ok(curve.keyframes.length >= 1, `${label}: debe haber al menos un keyframe`);

  let prevFrame = -1;
  for (const kf of curve.keyframes) {
    assert.ok(Number.isInteger(kf.frame), `${label}: frame debe ser entero (${kf.frame})`);
    assert.ok(
      kf.frame >= 0 && kf.frame <= durationFrames,
      `${label}: frame ${kf.frame} fuera de [0, ${durationFrames}]`,
    );
    assert.ok(
      kf.frame > prevFrame,
      `${label}: frames deben ser estrictamente crecientes (${prevFrame} -> ${kf.frame})`,
    );
    prevFrame = kf.frame;

    assert.ok(Number.isFinite(kf.value), `${label}: value debe ser finito`);
    assert.ok(
      kf.value >= 0 && kf.value <= 1,
      `${label}: value ${kf.value} fuera de [0, 1]`,
    );
  }
}

describe('@fme/art-direction (FDN-060)', () => {
  test('validación Zod: presets válidos, JSON Schema y parseArtDirectionPlan', () => {
    for (const preset of Object.values(STYLE_PRESETS)) {
      const parsed = parseStyleProfile(preset);
      assert.equal(parsed.ok, true, `Preset ${preset.id} debería validar`);
      if (parsed.ok) {
        assert.equal(parsed.value.id, preset.id);
      }
    }

    assert.equal(typeof styleProfileJsonSchema, 'object');
    assert.ok(styleProfileJsonSchema !== null);
    assert.equal(styleProfileJsonSchema['type'], 'object');
    assert.equal(styleProfileJsonSchema['additionalProperties'], false);
    const props = styleProfileJsonSchema['properties'] as Record<string, unknown> | undefined;
    assert.ok(props !== undefined && 'rules' in props && 'coherence' in props);

    const project = createFixtureProject();
    const plan = buildArtDirectionPlan(project, STYLE_PRESETS.editorialHandmade);
    const parsedPlan = parseArtDirectionPlan(plan);
    assert.equal(parsedPlan.ok, true);

    const invalidPlan = {
      ...plan,
      extraField: 'no-permitido',
    };
    const rejectedPlan = parseArtDirectionPlan(invalidPlan);
    assert.equal(rejectedPlan.ok, false);
  });

  test('validación Zod: rechaza schemaVersion desconocida, campos extra, rangos fuera de [0,1] y enums inválidos', () => {
    const base = structuredClone(STYLE_PRESETS.minimalGeometric);

    const wrongVersion = parseStyleProfile({ ...base, schemaVersion: 99 });
    assert.equal(wrongVersion.ok, false);
    if (!wrongVersion.ok) {
      assert.equal(wrongVersion.issues[0]?.path, 'schemaVersion');
      assert.equal(wrongVersion.issues[0]?.code, 'unknown-schema-version');
    }

    const extraRoot = parseStyleProfile({ ...base, unknownProp: true });
    assert.equal(extraRoot.ok, false);

    const extraInTarget = parseStyleProfile({
      ...base,
      rules: [
        {
          ...base.rules[0]!,
          target: { layerIds: ['layer-hero'], extraTargetKey: ['x'] },
        },
      ],
    });
    assert.equal(extraInTarget.ok, false);

    const outOfRangeAnchor = parseStyleProfile({ ...base, expressionAnchor: 1.05 });
    assert.equal(outOfRangeAnchor.ok, false);

    const negativeVariation = parseStyleProfile({
      ...base,
      coherence: { ...base.coherence, maxVariation: -0.01 },
    });
    assert.equal(negativeVariation.ok, false);

    const invalidPrinciple = parseStyleProfile({
      ...base,
      rules: [{ ...base.rules[0]!, principle: 'magic-ai-sparkles' }],
    });
    assert.equal(invalidPrinciple.ok, false);

    const invalidChannel = parseStyleProfile({
      ...base,
      rules: [{ ...base.rules[0]!, channel: 'opacity' }],
    });
    assert.equal(invalidChannel.ok, false);

    assert.throws(
      () => buildArtDirectionPlan(createFixtureProject(), { ...base, integrationAnchor: 2 } as StyleProfile),
      (err: unknown) =>
        err instanceof ArtDirectionValidationError && err.issues.length > 0,
    );
  });

  test('determinismo estricto: mismo proyecto, seed y perfil producen JSON idéntico byte a byte', () => {
    const projectA = createFixtureProject(2026);
    const projectB = createFixtureProject(2026);

    const resA = applyArtDirection(projectA, STYLE_PRESETS.editorialHandmade);
    const resB = applyArtDirection(projectB, STYLE_PRESETS.editorialHandmade);

    assert.equal(JSON.stringify(resA.project), JSON.stringify(resB.project));
    assert.equal(JSON.stringify(resA.plan), JSON.stringify(resB.plan));
    assert.equal(serialize(resA.project), serialize(resB.project));
  });

  test('sensibilidad controlada al seed: varía con maxVariation > 0 e invariante con maxVariation = 0', () => {
    const p1 = createFixtureProject(100);
    const p2 = createFixtureProject(999);

    const varied1 = applyArtDirection(p1, STYLE_PRESETS.editorialHandmade);
    const varied2 = applyArtDirection(p2, STYLE_PRESETS.editorialHandmade);

    const layer1 = varied1.plan.sequences[0]?.scenes[0]?.layers[1];
    const layer2 = varied2.plan.sequences[0]?.scenes[0]?.layers[1];
    assert.ok(layer1 !== undefined && layer2 !== undefined);
    assert.notEqual(
      JSON.stringify(layer1.expression.keyframes),
      JSON.stringify(layer2.expression.keyframes),
      'Con maxVariation > 0, seeds distintos deben producir variación controlada',
    );

    const zeroVarProfile: StyleProfile = {
      ...STYLE_PRESETS.editorialHandmade,
      id: 'custom.zero-var',
      coherence: {
        seedOffset: 7,
        temporalCorrelation: 0.9,
        maxVariation: 0,
      },
    };
    const inv1 = buildArtDirectionPlan(p1, zeroVarProfile);
    const inv2 = buildArtDirectionPlan(p2, zeroVarProfile);
    assert.equal(JSON.stringify(inv1.sequences), JSON.stringify(inv2.sequences));
  });

  test('invariantes de curvas sobre los 3 presets y los 14 principios (incluye capas de 0 y 1 frame)', () => {
    const project = createFixtureProject(77);

    for (const preset of Object.values(STYLE_PRESETS)) {
      const plan: ArtDirectionPlan = buildArtDirectionPlan(project, preset);
      for (const seqPlan of plan.sequences) {
        const seq = project.sequences.find((s) => s.id === seqPlan.sequenceId)!;
        for (const scenePlan of seqPlan.scenes) {
          const scene = seq.scenes.find((sc) => sc.id === scenePlan.sceneId)!;
          for (const layerPlan of scenePlan.layers) {
            const layer = scene.layers.find((l) => l.id === layerPlan.layerId)!;
            assertCurveInvariants(
              layerPlan.expression,
              layer.durationFrames,
              `${preset.id}/${layer.id}/expression`,
            );
            assertCurveInvariants(
              layerPlan.integration,
              layer.durationFrames,
              `${preset.id}/${layer.id}/integration`,
            );
          }
        }
      }
    }

    const allPrinciplesProfile: StyleProfile = {
      schemaVersion: ART_DIRECTION_SCHEMA_VERSION,
      id: 'custom.all-14-principles',
      name: 'Todos los principios',
      family: 'custom',
      expressionAnchor: 0.95,
      integrationAnchor: 0.05,
      preferredTechniques: ['2d', '3d'],
      coherence: { seedOffset: 1, temporalCorrelation: 0.5, maxVariation: 0.2 },
      rules: ANIMATION_PRINCIPLES.map((principle, idx) => ({
        id: `rule-${principle}`,
        principle,
        channel: idx % 2 === 0 ? 'expression' : 'integration',
        intensity: 1,
        easing: 'smooth',
      })),
    };

    const extremePlan = buildArtDirectionPlan(project, allPrinciplesProfile);
    for (const seqPlan of extremePlan.sequences) {
      const seq = project.sequences.find((s) => s.id === seqPlan.sequenceId)!;
      for (const scenePlan of seqPlan.scenes) {
        const scene = seq.scenes.find((sc) => sc.id === scenePlan.sceneId)!;
        for (const layerPlan of scenePlan.layers) {
          const layer = scene.layers.find((l) => l.id === layerPlan.layerId)!;
          assertCurveInvariants(
            layerPlan.expression,
            layer.durationFrames,
            `all-principles/${layer.id}/expression`,
          );
          assertCurveInvariants(
            layerPlan.integration,
            layer.durationFrames,
            `all-principles/${layer.id}/integration`,
          );
        }
      }
    }

    const shortScenePlan = extremePlan.sequences[0]?.scenes[1];
    assert.ok(shortScenePlan !== undefined);
    assert.deepEqual(
      shortScenePlan.layers[0]?.expression.keyframes.map((k) => k.frame),
      [0, 1],
    );
    assert.deepEqual(
      shortScenePlan.layers[1]?.expression.keyframes.map((k) => k.frame),
      [0],
    );
  });

  test('filtrado por RuleTarget (sequenceIds, sceneIds, layerIds, layerKinds, techniques) y enabled: false', () => {
    const project = createFixtureProject(12);
    const targetedProfile: StyleProfile = {
      schemaVersion: ART_DIRECTION_SCHEMA_VERSION,
      id: 'custom.targeted',
      name: 'Reglas con filtros',
      family: 'ink',
      expressionAnchor: 0.4,
      integrationAnchor: 0.5,
      preferredTechniques: ['2d-guided-by-3d'],
      coherence: { seedOffset: 0, temporalCorrelation: 0, maxVariation: 0 },
      rules: [
        {
          id: 'r-disabled',
          principle: 'exaggeration',
          channel: 'expression',
          intensity: 0.9,
          enabled: false,
        },
        {
          id: 'r-hero-match',
          principle: 'anticipation',
          channel: 'expression',
          intensity: 0.6,
          target: {
            sequenceIds: ['seq-main'],
            sceneIds: ['scene-intro'],
            layerIds: ['layer-hero'],
            layerKinds: ['drawing'],
            techniques: ['2d-guided-by-3d'],
          },
        },
        {
          id: 'r-alt-3d',
          principle: 'staging',
          channel: 'integration',
          intensity: 0.5,
          target: {
            sequenceIds: ['seq-alt'],
            layerKinds: ['model3d'],
            techniques: ['3d'],
          },
        },
      ],
    };

    const plan = buildArtDirectionPlan(project, targetedProfile);
    const bgLayer = plan.sequences[0]!.scenes[0]!.layers[0]!;
    const heroLayer = plan.sequences[0]!.scenes[0]!.layers[1]!;
    const alt3dLayer = plan.sequences[1]!.scenes[0]!.layers[0]!;

    assert.deepEqual(
      bgLayer.appliedRules.map((r) => r.ruleId),
      [],
    );
    assert.match(bgLayer.rationale[0] ?? '', /Sin reglas específicas/);

    assert.deepEqual(
      heroLayer.appliedRules.map((r) => r.ruleId),
      ['r-hero-match'],
    );
    assert.deepEqual(
      alt3dLayer.appliedRules.map((r) => r.ruleId),
      ['r-alt-3d'],
    );
  });

  test('no destructividad, overwriteExisting: false y compatibilidad total con parseProject y serialize/deserialize', () => {
    const original = createFixtureProject(314);
    const originalSnapshot = JSON.stringify(original);

    const preservedResult = applyArtDirection(original, STYLE_PRESETS.cinematicHybrid, {
      overwriteExisting: false,
    });

    assert.equal(
      JSON.stringify(original),
      originalSnapshot,
      'applyArtDirection no debe mutar el proyecto original',
    );

    const heroOriginalExpr = original.sequences[0]!.scenes[0]!.layers[1]!.channels.expression!;
    const heroPreserved = preservedResult.project.sequences[0]!.scenes[0]!.layers[1]!;
    assert.deepEqual(heroPreserved.channels.expression, heroOriginalExpr);
    assert.ok(
      heroPreserved.channels.integration !== undefined,
      'Debe rellenar el canal integration faltante cuando overwriteExisting es false',
    );

    heroPreserved.channels.integration.keyframes[0]!.value = 0.999;
    assert.notEqual(
      preservedResult.plan.sequences[0]!.scenes[0]!.layers[1]!.integration.keyframes[0]!.value,
      0.999,
      'Mutar el proyecto devuelto no debe mutar el plan generado',
    );

    const overwrittenResult = applyArtDirection(original, STYLE_PRESETS.cinematicHybrid);
    const heroOverwritten = overwrittenResult.project.sequences[0]!.scenes[0]!.layers[1]!;
    assert.notDeepEqual(heroOverwritten.channels.expression, heroOriginalExpr);

    const validated = parseProject(overwrittenResult.project);
    assert.equal(validated.ok, true, 'El Project resultante debe pasar parseProject');

    const serialized = serialize(overwrittenResult.project);
    const deserialized = deserialize(serialized);
    assert.equal(deserialized.ok, true, 'El Project resultante debe pasar serialize/deserialize');
    if (deserialized.ok) {
      assert.equal(serialize(deserialized.value), serialized);
    }
  });
});
