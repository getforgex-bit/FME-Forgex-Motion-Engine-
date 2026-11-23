/** @jsxImportSource @revideo/2d/lib */
import {Node, SVG, Txt, makeScene2D} from '@revideo/2d';
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
};

const vacio: Job = {kind: 'text', text: '', frames: 1, tracks: {x: [0], y: [0], opacity: [1], scale: [1], rotation: [0]}};

export default makeScene2D('fme-capa', function* (view) {
  const job = useScene().variables.get<Job>('job', vacio)();
  const nodo = createRef<Node>();

  view.add(
    <Node ref={nodo}>
      {job.kind === 'svg' ? (
        <SVG svg={job.svg ?? ''} />
      ) : (
        <Txt text={job.text ?? ''} fill={job.fill ?? '#ffffff'} fontSize={job.fontSize ?? 96} fontFamily={job.fontFamily ? `${job.fontFamily}, sans-serif` : 'sans-serif'} />
      )}
    </Node>,
  );

  const t = job.tracks;
  for (let f = 0; f < job.frames; f++) {
    nodo().position([t.x[f] ?? 0, t.y[f] ?? 0]);
    nodo().opacity(t.opacity[f] ?? 1);
    nodo().scale(t.scale[f] ?? 1);
    nodo().rotation(t.rotation[f] ?? 0);
    yield;
  }
});
