/** @jsxImportSource @revideo/2d/lib */
import {Img, Node, Txt, makeScene2D} from '@revideo/2d';
import {createRef, useScene} from '@revideo/core';

// Escena genérica de FME: dibuja UNA capa (texto o SVG) y aplica, fotograma a fotograma,
// los canales ya muestreados por el adaptador (x, y, opacity, scale, rotation). La variable `job` la
// escribe `cli.mjs`; aquí no hay lógica de curvas ni de easing (la hace el adaptador, testeada sin motor).
type Job = {
  kind: 'text' | 'svg';
  text?: string;
  svg?: string;
  fontSize?: number;
  fontFamily?: string;
  fill?: string;
  frames: number;
  tracks: {x: number[]; y: number[]; opacity: number[]; scale: number[]; rotation: number[]};
  // Gradientes expression/integration ya traducidos por @fme/art-direction (FDN-061). Opcional.
  gradients?: {
    strokeWidth: number[]; strokeOpacity: number[]; jitterX: number[]; jitterY: number[];
    shadowBlur: number[]; shadowOffset: number[]; shadowOpacity: number[];
  };
};

const vacio: Job = {kind: 'text', text: '', frames: 1, tracks: {x: [0], y: [0], opacity: [1], scale: [1], rotation: [0]}};

export default makeScene2D('fme-capa', function* (view) {
  const job = useScene().variables.get<Job>('job', vacio)();
  const nodo = createRef<Node>();
  const texto = createRef<Txt>();

  view.add(
    <Node ref={nodo}>
      {job.kind === 'svg' ? (
        <Img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(job.svg ?? '')}`} />
      ) : (
        <Txt ref={texto} text={job.text ?? ''} fill={job.fill ?? '#ffffff'} fontSize={job.fontSize ?? 96} fontFamily={job.fontFamily ? `${job.fontFamily}, sans-serif` : 'sans-serif'} />
      )}
    </Node>,
  );

  const t = job.tracks;
  for (let f = 0; f < job.frames; f++) {
    const g = job.gradients;
    nodo().position([(t.x[f] ?? 0) + (g?.jitterX[f] ?? 0), (t.y[f] ?? 0) + (g?.jitterY[f] ?? 0)]);
    if (g) {
      // expression -> contorno (solo texto) y temblor; integration -> sombra proyectada.
      if (job.kind === 'text') {
        texto().stroke(`rgba(255,107,53,${g.strokeOpacity[f] ?? 0})`);
        texto().lineWidth(g.strokeWidth[f] ?? 0);
        texto().strokeFirst(true);
      }
      nodo().shadowColor(`rgba(0,0,0,${g.shadowOpacity[f] ?? 0})`);
      nodo().shadowBlur(g.shadowBlur[f] ?? 0);
      nodo().shadowOffset([g.shadowOffset[f] ?? 0, g.shadowOffset[f] ?? 0]);
    }
    nodo().opacity(t.opacity[f] ?? 1);
    nodo().scale(t.scale[f] ?? 1);
    nodo().rotation(t.rotation[f] ?? 0);
    yield;
  }
});
