import { Game } from './game.js';
import { Renderer3D } from './renderer3d.js';

const canvas = document.getElementById('game');

function resizeCanvasToDisplaySize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.floor(window.innerWidth * dpr);
  const height = Math.floor(window.innerHeight * dpr);
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
  // Pointer lock for smooth yaw
  webglCanvas.addEventListener('click', () => {
    if (document.pointerLockElement !== webglCanvas) webglCanvas.requestPointerLock();
  });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === webglCanvas) {
      window.addEventListener('mousemove', onLockedMove);
    } else {
      window.removeEventListener('mousemove', onLockedMove);
    }
  });
  function onLockedMove(e) {
    // pass relative movement to game input
    game.input.mouseDeltaX += e.movementX || 0;
    game.input.mouseDeltaY += e.movementY || 0;
  }
  function render3dLoop() {
    renderer3d.draw(game);
    requestAnimationFrame(render3dLoop);
  }
  render3dLoop();
}

window.addEventListener('load', init);

