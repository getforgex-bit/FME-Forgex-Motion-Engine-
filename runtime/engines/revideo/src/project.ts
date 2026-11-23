import {makeProject} from '@revideo/core';
import scene from './scene';

// Fondo opaco (MP4). 30 FPS fijos: `fps` del proyecto Revideo no se puede cambiar por render (FDN-010).
export default makeProject({
  scenes: [scene],
  settings: {
    shared: {size: {x: 1920, y: 1080}, background: '#101820'},
    rendering: {fps: 30},
  },
});
