import { Game } from './game.js';
import { Renderer3D } from './renderer3d.js';

const canvas = document.getElementById('game');

function resizeCanvasToDisplaySize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.floor(canvas.clientWidth * dpr);
  const height = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function init() {
  resizeCanvasToDisplaySize();
  const game = new Game(canvas);
  const webglCanvas = document.getElementById('webgl');
  const renderer3d = new Renderer3D(webglCanvas);
  window.addEventListener('resize', () => {
    resizeCanvasToDisplaySize();
    game.handleResize();
    renderer3d.resize();
  });
  function render3dLoop() {
    renderer3d.draw(game);
    requestAnimationFrame(render3dLoop);
  }
  render3dLoop();
}

window.addEventListener('load', init);

