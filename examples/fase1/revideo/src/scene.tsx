/** @jsxImportSource @revideo/2d/lib */
import {Circle, Rect, Txt, makeScene2D} from '@revideo/2d';
import {all, createRef, easeInOutCubic, waitFor} from '@revideo/core';

// Escena de 3 s a 30 FPS = 90 fotogramas: un rótulo que aparece y un vector (círculo + barra) animado.
export default makeScene2D('fme-fase1', function* (view) {
  const titulo = createRef<Txt>();
  const circulo = createRef<Circle>();
  const barra = createRef<Rect>();

  view.add(
    <>
      <Txt ref={titulo} text="FME · Revideo" fill="#ffffff" fontSize={96} y={-300} opacity={0} />
      <Circle ref={circulo} size={160} fill="#ff6b35" x={-600} />
      <Rect ref={barra} width={0} height={24} fill="#35c4ff" y={200} radius={12} />
    </>,
  );

  yield* all(
    titulo().opacity(1, 0.5),
    circulo().x(600, 2.5, easeInOutCubic),
    circulo().rotation(360, 2.5, easeInOutCubic),
    barra().width(1200, 2.5, easeInOutCubic),
  );
  yield* waitFor(0.5);
});
