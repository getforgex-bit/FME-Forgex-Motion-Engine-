/**
 * FDN-051: medición de lo que lee el router (bytes y tokens estimados).
 *
 * Método de estimación: tokens ≈ caracteres / 4 sobre la serialización JSON de lo que
 * el router recibe del registro (no es un tokenizador real). Se reportan también bytes UTF-8.
 *
 * Qué comprueba el test:
 *  - cada escenario inspecciona solo las secciones avanzadas que su requisito necesita
 *    (regresión criterio #4/#5: si el router lee una sección innecesaria, el test falla);
 *  - el total leído en avanzadas no supera leer todas las tarjetas avanzadas completas.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import {
  createConnectorRegistry,
  type AdvancedSection,
  type CardAdvanced,
  type CardSimple,
  type InspectResult,
} from '../../connectors/src/index.ts';
import { planRoute, type RouteTask, type RouterRegistry } from '../src/index.ts';

function loadJson<T>(relativePathFromTest: string): T {
  return JSON.parse(readFileSync(new URL(relativePathFromTest, import.meta.url), 'utf8')) as T;
}

const CARDS = [
  {
    nombre: 'revideo',
    simple: loadJson<CardSimple>('../../../examples/fase1/revideo/card.simple.json'),
    advanced: loadJson<CardAdvanced>('../../../examples/fase1/revideo/card.advanced.json'),
    rutaAvanzada: '../../../examples/fase1/revideo/card.advanced.json',
  },
  {
    nombre: 'blender',
    simple: loadJson<CardSimple>('../../../examples/fase1/blender/card.simple.json'),
    advanced: loadJson<CardAdvanced>('../../../examples/fase1/blender/card.advanced.json'),
    rutaAvanzada: '../../../examples/fase1/blender/card.advanced.json',
  },
  {
    nombre: 'freecut',
    simple: loadJson<CardSimple>('../../../examples/fase1/freecut/card.simple.json'),
    advanced: loadJson<CardAdvanced>('../../../examples/fase1/freecut/card.advanced.json'),
    rutaAvanzada: '../../../examples/fase1/freecut/card.advanced.json',
  },
];

const TODAS: AdvancedSection[] = ['technical', 'limits', 'permissions', 'editability', 'licenseReview'];

function crearRegistro() {
  const registro = createConnectorRegistry();
  for (const c of CARDS) registro.register(c.simple, c.advanced);
  return registro;
}

type Medida = { chars: number; bytes: number; tokensEst: number };

/** Mide una estructura serializada: caracteres, bytes UTF-8 y tokens estimados (chars/4, redondeo hacia arriba). */
function medir(objeto: unknown): Medida {
  const texto = JSON.stringify(objeto);
  return {
    chars: texto.length,
    bytes: Buffer.byteLength(texto, 'utf8'),
    tokensEst: Math.ceil(texto.length / 4),
  };
}

type Escenario = {
  titulo: string;
  tarea: RouteTask;
  /** Secciones que el requisito justifica leer. Cualquier otra lectura hace fallar el test. */
  seccionesPermitidas: AdvancedSection[];
};

const ESCENARIOS: Escenario[] = [
  {
    titulo: '«título SVG animado» (solo tarjetas simples)',
    tarea: {
      operation: 'animate.svg-title',
      requiredCapabilities: ['animate.vector'],
      requiredProduces: ['video/mp4'],
    },
    seccionesPermitidas: [],
  },
  {
    titulo: '«cámara 3D con alpha» (technical.alpha)',
    tarea: {
      operation: 'render.3d-camera',
      requiredCapabilities: ['animate.3d'],
      requiredProduces: ['image/png-sequence'],
      technical: { alpha: 'yes' },
    },
    seccionesPermitidas: ['technical'],
  },
  {
    titulo: '«título animado con alpha en MOV» (technical.alpha)',
    tarea: {
      operation: 'animate.title-alpha',
      requiredCapabilities: ['animate.vector'],
      requiredProduces: ['video/quicktime'],
      technical: { alpha: 'yes' },
    },
    seccionesPermitidas: ['technical'],
  },
  {
    titulo: '«render de vídeo con límite de FPS y licencia revisada» (limits, licenseReview)',
    tarea: {
      operation: 'render.video-limited',
      requiredCapabilities: ['render.video'],
      requiredLimits: { verifiedFps: { min: 30 } },
      policy: { checkLicense: true, requireApprovedLicense: true },
    },
    seccionesPermitidas: ['limits', 'licenseReview'],
  },
];

type Lectura = { conector: string; secciones: AdvancedSection[]; medida: Medida };

function ejecutarEscenario(escenario: Escenario) {
  const registro = crearRegistro();
  const lecturas: Lectura[] = [];
  const espiado: RouterRegistry = {
    get size() {
      return registro.size;
    },
    has: (id) => registro.has(id),
    listSimple: (filtro) => registro.listSimple(filtro),
    inspect: (id, secciones) => {
      const resultado: InspectResult = registro.inspect(id, secciones);
      lecturas.push({ conector: id, secciones: [...secciones], medida: medir(resultado.sections) });
      return resultado;
    },
  };

  const plan = planRoute(espiado, escenario.tarea);
  const simplesLeidas = registro.listSimple().map((e) => e.card);
  return {
    plan,
    lecturas,
    simple: medir(simplesLeidas),
    avanzado: lecturas.reduce(
      (acc, l) => ({
        chars: acc.chars + l.medida.chars,
        bytes: acc.bytes + l.medida.bytes,
        tokensEst: acc.tokensEst + l.medida.tokensEst,
      }),
      { chars: 0, bytes: 0, tokensEst: 0 },
    ),
  };
}

/** Base de comparación: leer todas las tarjetas avanzadas completas (las 5 secciones de cada conector). */
function lecturaCompletaAvanzadas(): { porConector: Record<string, Medida>; total: Medida } {
  const registro = crearRegistro();
  const porConector: Record<string, Medida> = {};
  const total = { chars: 0, bytes: 0, tokensEst: 0 };
  for (const c of CARDS) {
    const m = medir(registro.inspect(c.simple.id, TODAS).sections);
    porConector[c.nombre] = m;
    total.chars += m.chars;
    total.bytes += m.bytes;
    total.tokensEst += m.tokensEst;
  }
  return { porConector, total };
}

describe('FDN-051 · tokens leídos por el router', () => {
  const base = lecturaCompletaAvanzadas();

  for (const escenario of ESCENARIOS) {
    test(`escenario ${escenario.titulo}: solo secciones necesarias`, () => {
      const r = ejecutarEscenario(escenario);
      assert.equal(r.plan.metrics.simpleCardsRead, CARDS.length);

      for (const l of r.lecturas) {
        const extra = l.secciones.filter((s) => !escenario.seccionesPermitidas.includes(s));
        assert.deepEqual(
          extra,
          [],
          `el router leyó secciones no necesarias de «${l.conector}»: ${extra.join(', ')}`,
        );
      }
      assert.ok(
        r.avanzado.tokensEst <= base.total.tokensEst,
        'la lectura avanzada no puede superar leer todas las tarjetas completas',
      );
    });
  }

  test('informe: tabla de números reales', () => {
    const filas = ESCENARIOS.map((e) => {
      const r = ejecutarEscenario(e);
      return {
        escenario: e.titulo,
        secciones: r.lecturas.map((l) => `${l.conector}:[${l.secciones.join(',')}]`).join(' ') || '—',
        simpleTokens: r.simple.tokensEst,
        simpleBytes: r.simple.bytes,
        avanzadaTokens: r.avanzado.tokensEst,
        avanzadaBytes: r.avanzado.bytes,
        totalTokens: r.simple.tokensEst + r.avanzado.tokensEst,
      };
    });
    const linea = (s: string) => console.log(s);
    linea('--- FDN-051 · medición (tokens = chars/4, JSON serializado) ---');
    linea(
      `Base: las 3 tarjetas avanzadas completas → ${base.total.bytes} B, ${base.total.chars} caracteres, ${base.total.tokensEst} tokens est.`,
    );
    for (const f of filas) {
      linea(
        `${f.escenario} | lecturas: ${f.secciones} | simple: ${f.simpleTokens} tok / ${f.simpleBytes} B | avanzada: ${f.avanzadaTokens} tok / ${f.avanzadaBytes} B | total: ${f.totalTokens} tok`,
      );
    }
    assert.ok(filas.length === ESCENARIOS.length);
  });
});
