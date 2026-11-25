import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  createConnectorRegistry,
  type AdvancedSection,
  type InspectResult,
} from '../../connectors/src/index.ts';
import { createBlenderAdapter } from '../../adapters/blender/src/index.ts';
import {
  advanced as freecutAdvanced,
  simple as freecutSimple,
} from '../../adapters/freecut/src/cards.ts';
import {
  advanced as revideoAdvanced,
  simple as revideoSimple,
} from '../../adapters/revideo/src/cards.ts';
import { planRoute, type RouterRegistry } from '../src/index.ts';

const blenderCards = createBlenderAdapter({ allowedRoots: [] });
const blenderSimple = blenderCards.simple;
const blenderAdvanced = blenderCards.advanced;

function createSpiedRealAdaptersRegistry() {
  const registry = createConnectorRegistry();
  registry.register(revideoSimple, revideoAdvanced);
  registry.register(blenderSimple, blenderAdvanced);
  registry.register(freecutSimple, freecutAdvanced);

  const inspectCalls: Array<{ id: string; sections: AdvancedSection[] }> = [];
  const spied: RouterRegistry = {
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

  return { registry: spied, inspectCalls };
}

describe('FDN-052 · Criterios #4 y #5 sobre las tarjetas reales de los 3 adaptadores', () => {
  test('criterio #4: selecciona ruta compatible consultando solo tarjetas simples (0 inspecciones avanzadas)', () => {
    // 1. Título / animación vectorial -> revideo
    {
      const { registry, inspectCalls } = createSpiedRealAdaptersRegistry();
      const plan = planRoute(registry, {
        operation: 'animate.vector',
        requiredCapabilities: ['animate.vector'],
        requiredProduces: ['video/mp4'],
      });
      assert.equal(plan.status, 'planned');
      assert.equal(plan.selected?.connectorId, 'revideo');
      assert.equal(plan.metrics.simpleCardsRead, 3);
      assert.equal(plan.metrics.advancedInspections, 0);
      assert.equal(plan.metrics.advancedSectionsRequested, 0);
      assert.equal(inspectCalls.length, 0);
      assert.ok(plan.justification.includes('revideo'));
    }

    // 2. Composición multipista -> adapter.freecut
    {
      const { registry, inspectCalls } = createSpiedRealAdaptersRegistry();
      const plan = planRoute(registry, {
        operation: 'edit.compose',
        requiredCapabilities: ['edit.compose'],
        requiredProduces: ['video/mp4'],
      });
      assert.equal(plan.status, 'planned');
      assert.equal(plan.selected?.connectorId, 'adapter.freecut');
      assert.equal(plan.metrics.simpleCardsRead, 3);
      assert.equal(plan.metrics.advancedInspections, 0);
      assert.equal(plan.metrics.advancedSectionsRequested, 0);
      assert.equal(inspectCalls.length, 0);
      assert.ok(plan.justification.includes('adapter.freecut'));
    }

    // 3. Animación 3D -> adapter.blender
    {
      const { registry, inspectCalls } = createSpiedRealAdaptersRegistry();
      const plan = planRoute(registry, {
        operation: 'render.image-sequence',
        requiredCapabilities: ['animate.3d'],
        requiredProduces: ['image/png'],
      });
      assert.equal(plan.status, 'planned');
      assert.equal(plan.selected?.connectorId, 'adapter.blender');
      assert.equal(plan.metrics.simpleCardsRead, 3);
      assert.equal(plan.metrics.advancedInspections, 0);
      assert.equal(plan.metrics.advancedSectionsRequested, 0);
      assert.equal(inspectCalls.length, 0);
      assert.ok(plan.justification.includes('adapter.blender'));
    }
  });

  test('criterio #5: consulta detalle avanzado SOLO cuando una restricción crítica lo exige', () => {
    // 1. Render vídeo con alpha: finalistas simples = revideo y adapter.freecut (nunca adapter.blender)
    {
      const { registry, inspectCalls } = createSpiedRealAdaptersRegistry();
      const plan = planRoute(registry, {
        operation: 'render.video-alpha',
        requiredCapabilities: ['render.video'],
        technical: { alpha: 'yes' },
      });

      assert.equal(plan.status, 'planned');
      assert.equal(plan.selected?.connectorId, 'revideo');
      assert.equal(plan.metrics.simpleCardsRead, 3);
      assert.equal(plan.metrics.advancedInspections, 2);
      assert.equal(plan.metrics.advancedSectionsRequested, 2);
      assert.deepEqual(
        inspectCalls.map((c) => c.id),
        ['revideo', 'adapter.freecut'],
      );
      for (const call of inspectCalls) {
        assert.deepEqual(call.sections, ['technical']);
      }
      const freecutRejection = plan.rejections.find(
        (r) => r.connectorId === 'adapter.freecut',
      );
      assert.equal(freecutRejection?.code, 'TECHNICAL_REQUIREMENT_FAILED');
      assert.equal(freecutRejection?.violatedConstraint, 'technical:alpha');
    }

    // 2. Escena 3D con alpha: SOLO inspecciona ['technical'] sobre adapter.blender
    {
      const { registry, inspectCalls } = createSpiedRealAdaptersRegistry();
      const plan = planRoute(registry, {
        operation: 'render.3d-alpha',
        requiredCapabilities: ['animate.3d'],
        technical: { alpha: 'yes' },
      });

      assert.equal(plan.status, 'planned');
      assert.equal(plan.selected?.connectorId, 'adapter.blender');
      assert.equal(plan.metrics.simpleCardsRead, 3);
      assert.equal(plan.metrics.advancedInspections, 1);
      assert.equal(plan.metrics.advancedSectionsRequested, 1);
      assert.deepEqual(inspectCalls, [
        { id: 'adapter.blender', sections: ['technical'] },
      ]);
    }

    // 3. Plan con fallback disponible entre tarjetas reales sin requisitos avanzados
    {
      const { registry, inspectCalls } = createSpiedRealAdaptersRegistry();
      const plan = planRoute(
        registry,
        {
          operation: 'render.video',
          requiredCapabilities: ['render.video'],
          requiredProduces: ['video/mp4'],
        },
        {
          mode: 'hybrid',
          preferredConnectorIds: ['revideo'],
        },
      );

      assert.equal(plan.status, 'planned');
      assert.equal(plan.selected?.connectorId, 'revideo');
      assert.deepEqual(
        plan.fallbacks.map((f) => f.connectorId),
        ['adapter.freecut'],
      );
      assert.equal(plan.fallbackStrategy.onFailureAction, 'fallback-connector');
      assert.equal(plan.metrics.simpleCardsRead, 3);
      assert.equal(plan.metrics.advancedInspections, 0);
      assert.equal(inspectCalls.length, 0);
    }
  });
});
