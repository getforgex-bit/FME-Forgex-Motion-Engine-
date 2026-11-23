import {makeProject} from '@revideo/core';
import scene from './scene';

export default makeProject({
  scenes: [scene],
  settings: {
    shared: {size: {x: 1280, y: 720}, background: '#101820'},
    rendering: {fps: 30},
  },
});
