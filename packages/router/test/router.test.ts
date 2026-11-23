import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import {
  CONTRACT_VERSION,
  createConnectorRegistry,
  type AdvancedSection,
  type CardAdvanced,
  type CardSimple,
  type InspectResult,
} from '../../connectors/src/index.ts';
import {
  ROUTE_STEP_NAMES,
  planRoute,
  planWorkflow,
  type RouterRegistry,
} from '../src/index.ts';

function loadJson<T>(relativePathFromTest: string): T {
  const url = new URL(relativePathFromTest, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8')) as T;
}

const REVIDEO_SIMPLE = loadJson<CardSimple>(
  '../../../examples/fase1/revideo/card.simple.json',
);
const REVIDEO_ADVANCED = loadJson<CardAdvanced>(
  '../../../examples/fase1/revideo/card.advanced.json',
);
const BLENDER_SIMPLE = loadJson<CardSimple>(
  '../../../examples/fase1/blender/card.simple.json',
);
const BLENDER_ADVANCED = loadJson<CardAdvanced>(
  '../../../examples/fase1/blender/card.advanced.json',
);

const EDITOR_SIM_SIMPLE: CardSimple = {
  id: 'adapter.editor-sim',
  name: 'Editor Simulado',
  version: '0.1.0',
  contractVersion: CONTRACT_VERSION,
  capabilities: ['edit.timeline', 'compose.video', 'render.video'],
  accepts: ['video/mp4', 'image/png-sequence', 'audio/wav'],
  produces: ['video/mp4'],
  executor: 'cli',
};

const EDITOR_SIM_ADVANCED: CardAdvanced = {
  pluginId: 'adapter.editor-sim',
  technical: {
    alpha: 'no',
    depth: 'no',
    keyframes: 'yes',
  },
  limits: {
    maxWidth: 1920,
    ramPeakMB: 512,
  },
  permissions: ['fs:write-out'],
  editability: 'linked',
  licenseReview: 'approved',
};

function createBaseRegistry() {
  const registry = createConnectorRegistry();
  registry.register(REVIDEO_SIMPLE, REVIDEO_ADVANCED);
  registry.register(BLENDER_SIMPLE, BLENDER_ADVANCED);
  registry.register(EDITOR_SIM_SIMPLE, EDITOR_SIM_ADVANCED);
  return registry;
}

describe('@fme/router (FDN-050)', () => {
  test('criterio #1: «título SVG animado» elige revideo usando solo tarjetas simples y registra justificación', () => {
    const registry = createBaseRegistry();
    const inspectCalls: Array<{ id: string; sections: readonly AdvancedSection[] }> = [];
    const spiedRegistry: RouterRegistry = {
      get size() {
        return registry.size;
      },
      has: (id) => registry.has(id),
      listSimple: (filter) => registry.listSimple(filter),
      inspect: (id, sections) => {
        inspectCalls.push({ id, sections: [...sections] });
        return registry.inspect(id, sections);
      },
    };

    const plan = planRoute(spiedRegistry, {
      operation: 'animate.svg-title',
      requiredCapabilities: ['animate.vector'],
      requiredProduces: ['video/mp4'],
    });

    assert.equal(plan.status, 'planned');
    assert.equal(plan.mode, 'auto');
    assert.equal(plan.selected?.connectorId, 'revideo');
    assert.ok(plan.justification.includes('revideo'));
    assert.equal(plan.metrics.simpleCardsRead, 3);
    assert.equal(plan.metrics.advancedInspections, 0);
    assert.equal(plan.metrics.advancedSectionsRequested, 0);
    assert.equal(inspectCalls.length, 0);
    assert.deepEqual(
      plan.steps.map((s) => s.step),
      [...ROUTE_STEP_NAMES],
    );
    assert.equal(plan.fallbackStrategy.onFailureAction, 'retry-safe');
  });

  test('criterio #2: «cámara 3D con alpha» elige adapter.blender verificando alpha=yes con justificación', () => {
    const registry = createBaseRegistry();

    const plan = planRoute(registry, {
      operation: 'render.3d-camera',
      requiredCapabilities: ['animate.3d'],
      requiredProduces: ['image/png-sequence'],
      technical: { alpha: 'yes' },
    });

    assert.equal(plan.status, 'planned');
    assert.equal(plan.selected?.connectorId, 'adapter.blender');
    assert.ok(plan.justification.includes('adapter.blender'));
    assert.equal(plan.metrics.simpleCardsRead, 3);
    assert.equal(plan.metrics.advancedInspections, 1);
    assert.equal(plan.metrics.advancedSectionsRequested, 1);
    assert.deepEqual(plan.metrics.inspectedByConnector, {
      'adapter.blender': ['technical'],
    });
  });

  test('criterio #3: modo manual con herramienta incompatible es rechazado con error y motivo claro', () => {
    const registry = createBaseRegistry();

    // 1. Incompatibilidad de capacidad (pedir 3D a revideo)
    const capRejected = planRoute(
      registry,
      {
        operation: 'render.3d-camera',
        requiredCapabilities: ['animate.3d'],
      },
      { mode: 'manual', manualConnectorId: 'revideo' },
    );
    assert.equal(capRejected.status, 'rejected');
    assert.equal(capRejected.selected, null);
    assert.equal(capRejected.error?.code, 'MISSING_CAPABILITY');
    assert.equal(capRejected.error?.connectorId, 'revideo');
    assert.equal(capRejected.error?.violatedConstraint, 'capability:animate.3d');
    assert.equal(capRejected.fallbackStrategy.onFailureAction, 'escalate-user');

    // 2. Requisito técnico explícito 'no' (pedir depth='yes' a revideo, que tiene depth='no')
    const techRejected = planRoute(
      registry,
      {
        operation: 'render.with-depth',
        requiredCapabilities: ['render.video'],
        technical: { depth: 'yes' },
      },
      { mode: 'manual', manualConnectorId: 'revideo' },
    );
    assert.equal(techRejected.status, 'rejected');
    assert.equal(techRejected.error?.code, 'TECHNICAL_REQUIREMENT_FAILED');
    assert.equal(techRejected.error?.connectorId, 'revideo');
    assert.equal(techRejected.error?.violatedConstraint, 'technical:depth');

    // 3. Permiso denegado (revideo requiere spawn:chrome-headless)
    const permRejected = planRoute(
      registry,
      {
        operation: 'animate.svg-title',
        requiredCapabilities: ['animate.vector'],
        policy: { deniedPermissions: ['spawn:chrome-headless'] },
      },
      { mode: 'manual', manualConnectorId: 'revideo' },
    );
    assert.equal(permRejected.status, 'rejected');
    assert.equal(permRejected.error?.code, 'DENIED_PERMISSION');
    assert.equal(
      permRejected.error?.violatedConstraint,
      'permission:spawn:chrome-headless',
    );

    // 4. Conector manual inexistente y sin manualConnectorId
    const missingConnector = planRoute(
      registry,
      { operation: 'any' },
      { mode: 'manual', manualConnectorId: 'adapter.inexistente' },
    );
    assert.equal(missingConnector.status, 'rejected');
    assert.equal(missingConnector.error?.code, 'CONNECTOR_NOT_FOUND');

    const missingId = planRoute(registry, { operation: 'any' }, { mode: 'manual' });
    assert.equal(missingId.status, 'rejected');
    assert.equal(missingId.error?.code, 'INVALID_MANUAL_MODE');
  });

  test('criterio #4: modo híbrido con preferencias, exclusiones y planWorkflow mixto', () => {
    const registry = createBaseRegistry();
    registry.register(
      {
        id: 'adapter.vector-alt',
        name: 'Vector Alt',
        version: '1.0.0',
        contractVersion: CONTRACT_VERSION,
        capabilities: ['animate.vector', 'render.video'],
        accepts: ['application/json'],
        produces: ['video/mp4'],
        executor: 'cli',
      },
      {
        pluginId: 'adapter.vector-alt',
        technical: { alpha: 'yes', keyframes: 'yes' },
        permissions: ['fs:write-out'],
        editability: 'linked',
        licenseReview: 'approved',
      },
    );

    // Preferencia híbrida prioriza adapter.vector-alt frente a revideo, dejando revideo como fallback
    const preferredPlan = planRoute(
      registry,
      {
        operation: 'animate.vector',
        requiredCapabilities: ['animate.vector'],
        requiredProduces: ['video/mp4'],
      },
      {
        mode: 'hybrid',
        preferredConnectorIds: ['adapter.vector-alt'],
      },
    );
    assert.equal(preferredPlan.status, 'planned');
    assert.equal(preferredPlan.selected?.connectorId, 'adapter.vector-alt');
    assert.deepEqual(
      preferredPlan.fallbacks.map((f) => f.connectorId),
      ['revideo'],
    );
    assert.equal(
      preferredPlan.fallbackStrategy.onFailureAction,
      'fallback-connector',
    );
    assert.deepEqual(preferredPlan.fallbackStrategy.alternativeConnectorIds, [
      'revideo',
    ]);

    // Exclusión + allowedExecutors descarta revideo (executor='library') y elige adapter.vector-alt ('cli')
    const constrainedHybrid = planRoute(
      registry,
      {
        operation: 'animate.vector',
        requiredCapabilities: ['animate.vector'],
      },
      {
        mode: 'hybrid',
        excludedConnectorIds: ['revideo'],
        allowedExecutors: ['cli'],
      },
    );
    assert.equal(constrainedHybrid.status, 'planned');
    assert.equal(constrainedHybrid.selected?.connectorId, 'adapter.vector-alt');

    // Flujo multi-tarea: paso 1 fijado manualmente a revideo, paso 2 automático a adapter.blender, paso 3 automático a adapter.editor-sim
    const workflow = planWorkflow(
      registry,
      [
        {
          id: 'step-title',
          operation: 'animate.svg-title',
          requiredCapabilities: ['animate.vector'],
          requiredProduces: ['video/mp4'],
        },
        {
          id: 'step-3d',
          operation: 'render.3d',
          requiredCapabilities: ['animate.3d'],
          technical: { alpha: 'yes' },
        },
        {
          id: 'step-compose',
          operation: 'compose.timeline',
          requiredCapabilities: ['edit.timeline', 'compose.video'],
          requiredProduces: ['video/mp4'],
        },
      ],
      {
        mode: 'hybrid',
        pinnedByOperation: { 'step-title': 'revideo' },
      },
    );

    assert.equal(workflow.status, 'planned');
    assert.equal(workflow.tasks.length, 3);
    assert.equal(workflow.tasks[0]?.modeUsed, 'manual');
    assert.equal(workflow.tasks[0]?.plan.selected?.connectorId, 'revideo');
    assert.equal(workflow.tasks[1]?.modeUsed, 'hybrid');
    assert.equal(workflow.tasks[1]?.plan.selected?.connectorId, 'adapter.blender');
    assert.equal(workflow.tasks[2]?.modeUsed, 'hybrid');
    assert.equal(
      workflow.tasks[2]?.plan.selected?.connectorId,
      'adapter.editor-sim',
    );
  });

  test('criterio #5 y #6: alpha=unknown pide inspect(id, ["technical"]) exclusivamente y descarta al candidato', () => {
    const registry = createBaseRegistry();
    registry.register(
      {
        id: 'adapter.alpha-unknown',
        name: 'Alpha Unknown',
        version: '0.1.0',
        contractVersion: CONTRACT_VERSION,
        capabilities: ['animate.3d', 'render.image-sequence'],
        accepts: ['text/x-python'],
        produces: ['image/png-sequence'],
        executor: 'cli',
      },
      {
        pluginId: 'adapter.alpha-unknown',
        technical: { alpha: 'unknown', headless: 'yes' },
        permissions: ['fs:write-out'],
        editability: 'native',
        licenseReview: 'approved',
      },
    );
    registry.register({
      id: 'adapter.no-advanced',
      name: 'Sin Avanzada',
      version: '0.1.0',
      contractVersion: CONTRACT_VERSION,
      capabilities: ['animate.3d', 'render.image-sequence'],
      accepts: ['text/x-python'],
      produces: ['image/png-sequence'],
      executor: 'cli',
    });

    const inspectCalls: Array<{ id: string; sections: AdvancedSection[] }> = [];
    const spyRegistry: RouterRegistry = {
      get size() {
        return registry.size;
      },
      has: (id) => registry.has(id),
      listSimple: (filter) => registry.listSimple(filter),
      inspect: (id, sections): InspectResult => {
        inspectCalls.push({ id, sections: [...sections] });
        return registry.inspect(id, sections);
      },
    };

    const plan = planRoute(spyRegistry, {
      operation: 'render.3d-alpha',
      requiredCapabilities: ['animate.3d'],
      requiredProduces: ['image/png-sequence'],
      technical: { alpha: 'yes' },
    });

    // Solo los 3 finalistas 3D deben ser inspeccionados (nunca revideo ni adapter.editor-sim)
    assert.equal(plan.metrics.simpleCardsRead, 5);
    assert.equal(plan.metrics.advancedInspections, 3);
    assert.equal(plan.metrics.advancedSectionsRequested, 3);
    assert.deepEqual(
      inspectCalls.map((c) => c.id),
      ['adapter.blender', 'adapter.alpha-unknown', 'adapter.no-advanced'],
    );
    for (const call of inspectCalls) {
      assert.deepEqual(call.sections, ['technical']);
    }

    assert.equal(plan.status, 'planned');
    assert.equal(plan.selected?.connectorId, 'adapter.blender');
    assert.equal(plan.fallbacks.length, 0);

    const unknownRejection = plan.rejections.find(
      (r) => r.connectorId === 'adapter.alpha-unknown',
    );
    assert.equal(unknownRejection?.code, 'UNVERIFIED_TECHNICAL_REQUIREMENT');
    assert.equal(unknownRejection?.violatedConstraint, 'technical:alpha');

    const noAdvRejection = plan.rejections.find(
      (r) => r.connectorId === 'adapter.no-advanced',
    );
    assert.equal(noAdvRejection?.code, 'UNVERIFIED_TECHNICAL_REQUIREMENT');
  });

  test('criterio #7: restricciones duras de permisos, licencia, editabilidad, límites y disponibilidad nunca se compensan con puntuación', () => {
    const registry = createBaseRegistry();
    registry.register(
      {
        id: 'adapter.blocked-preferred',
        name: 'Blocked Preferred',
        version: '1.0.0',
        contractVersion: CONTRACT_VERSION,
        capabilities: ['animate.vector'],
        accepts: ['application/json'],
        produces: ['video/mp4'],
        executor: 'library',
      },
      {
        pluginId: 'adapter.blocked-preferred',
        technical: { alpha: 'yes' },
        limits: { ramPeakMB: 4096 },
        permissions: ['net:external', 'fs:write-out'],
        editability: 'baked',
        licenseReview: 'blocked',
      },
    );

    // 1. Licencia bloqueada rechazada aunque esté en preferredConnectorIds
    const blockedLicensePlan = planRoute(
      registry,
      {
        operation: 'animate.vector',
        requiredCapabilities: ['animate.vector'],
        policy: { checkLicense: true },
      },
      {
        mode: 'hybrid',
        preferredConnectorIds: ['adapter.blocked-preferred'],
      },
    );
    assert.equal(blockedLicensePlan.selected?.connectorId, 'revideo');
    assert.equal(
      blockedLicensePlan.rejections.find(
        (r) => r.connectorId === 'adapter.blocked-preferred',
      )?.code,
      'BLOCKED_LICENSE',
    );

    // 2. requireApprovedLicense=true rechaza blender ('pending')
    const pendingLicensePlan = planRoute(registry, {
      operation: 'render.3d',
      requiredCapabilities: ['animate.3d'],
      policy: { requireApprovedLicense: true },
    });
    assert.equal(pendingLicensePlan.status, 'rejected');
    assert.equal(pendingLicensePlan.error?.code, 'UNAPPROVED_LICENSE');

    // 3. allowedPermissions rechaza quien pida permisos fuera de la lista
    const allowedPermsPlan = planRoute(registry, {
      operation: 'animate.vector',
      requiredCapabilities: ['animate.vector'],
      policy: { allowedPermissions: ['fs:write-out'] },
    });
    assert.equal(allowedPermsPlan.status, 'rejected');
    assert.ok(
      allowedPermsPlan.rejections.every(
        (r) =>
          r.code === 'MISSING_CAPABILITY' || r.code === 'PERMISSION_NOT_ALLOWED',
      ),
    );

    // 4. requiredEditability y requiredLimits (max ramPeakMB)
    const editAndLimitsPlan = planRoute(registry, {
      operation: 'animate.vector',
      requiredCapabilities: ['animate.vector'],
      requiredEditability: ['native'],
      requiredLimits: { ramPeakMB: { max: 1500 } },
    });
    assert.equal(editAndLimitsPlan.status, 'planned');
    assert.equal(editAndLimitsPlan.selected?.connectorId, 'revideo');
    assert.equal(
      editAndLimitsPlan.rejections.find(
        (r) => r.connectorId === 'adapter.blocked-preferred',
      )?.code,
      'INSUFFICIENT_EDITABILITY',
    );

    // 5. availableConnectorIds descarta conectores no disponibles
    const availabilityPlan = planRoute(registry, {
      operation: 'animate.vector',
      requiredCapabilities: ['animate.vector'],
      availableConnectorIds: ['adapter.editor-sim'],
    });
    assert.equal(availabilityPlan.status, 'rejected');
    assert.equal(availabilityPlan.error?.code, 'CONNECTOR_UNAVAILABLE');
  });

  test('criterio #8: traza completa de 8 pasos y determinismo en empates independiente del orden de registro', () => {
    const cardA: CardSimple = {
      id: 'adapter.alpha-tie',
      name: 'Tie A',
      version: '1.0.0',
      contractVersion: CONTRACT_VERSION,
      capabilities: ['render.video'],
      accepts: ['application/json'],
      produces: ['video/mp4'],
      executor: 'cli',
    };
    const cardB: CardSimple = {
      id: 'adapter.beta-tie',
      name: 'Tie B',
      version: '1.0.0',
      contractVersion: CONTRACT_VERSION,
      capabilities: ['render.video'],
      accepts: ['application/json'],
      produces: ['video/mp4'],
      executor: 'cli',
    };

    const regAB = createConnectorRegistry();
    regAB.register(cardA);
    regAB.register(cardB);

    const regBA = createConnectorRegistry();
    regBA.register(cardB);
    regBA.register(cardA);

    const task = {
      operation: 'render.video',
      requiredCapabilities: ['render.video'],
    };

    const planAB = planRoute(regAB, task);
    const planBA = planRoute(regBA, task);

    assert.equal(planAB.status, 'planned');
    assert.equal(planAB.selected?.connectorId, 'adapter.alpha-tie');
    assert.equal(planBA.selected?.connectorId, 'adapter.alpha-tie');
    assert.deepEqual(
      planAB.fallbacks.map((f) => f.connectorId),
      ['adapter.beta-tie'],
    );
    assert.deepEqual(
      planBA.fallbacks.map((f) => f.connectorId),
      ['adapter.beta-tie'],
    );
    assert.equal(planAB.steps.length, 8);
    assert.deepEqual(
      planAB.steps.map((s) => s.step),
      [...ROUTE_STEP_NAMES],
    );
    assert.ok(planAB.steps.every((s) => s.status === 'ok'));
  });
});
