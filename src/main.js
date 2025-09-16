import { Game } from './game.js';

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
  window.addEventListener('resize', () => {
    resizeCanvasToDisplaySize();
    game.handleResize();
  });
}

window.addEventListener('load', init);

