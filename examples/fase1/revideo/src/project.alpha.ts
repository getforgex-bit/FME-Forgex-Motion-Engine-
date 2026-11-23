import {makeProject} from '@revideo/core';
import scene from './scene';

// Fondo transparente para la salida con alpha. OJO: en 0.11.0 `background: null` termina como negro opaco; hace falta 'rgba(0,0,0,0)'.
export default makeProject({
  scenes: [scene],
  settings: {
    shared: {size: {x: 1280, y: 720}, background: 'rgba(0,0,0,0)'},
    rendering: {fps: 30},
  },
});
