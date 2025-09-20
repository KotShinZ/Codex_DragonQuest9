import './style.css';
import { TetrisGame } from './tetris';
import { TetrisRenderer } from './renderer';

const boardCanvas = document.getElementById('board') as HTMLCanvasElement | null;
const nextCanvas = document.getElementById('next') as HTMLCanvasElement | null;
const holdCanvas = document.getElementById('hold') as HTMLCanvasElement | null;
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');
const comboEl = document.getElementById('combo');
const backToBackEl = document.getElementById('back-to-back');
const overlayEl = document.getElementById('overlay');
const restartButton = document.getElementById('restart');

if (
  !boardCanvas ||
  !nextCanvas ||
  !holdCanvas ||
  !scoreEl ||
  !levelEl ||
  !linesEl ||
  !comboEl ||
  !backToBackEl ||
  !overlayEl ||
  !restartButton
) {
  throw new Error('必要なDOM要素が見つかりませんでした。');
}

const game = new TetrisGame();
const renderer = new TetrisRenderer({
  board: boardCanvas,
  next: nextCanvas,
  hold: holdCanvas,
  score: scoreEl,
  level: levelEl,
  lines: linesEl,
  combo: comboEl,
  backToBack: backToBackEl,
  overlay: overlayEl
});

let lastTime = performance.now();

const loop = (time: number) => {
  const delta = time - lastTime;
  lastTime = time;
  game.update(delta);
  renderer.render(game);
  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);

const isRotationKey = (code: string) => ['ArrowUp', 'KeyX', 'KeyS', 'KeyZ', 'KeyA'].includes(code);
const isHoldKey = (code: string) => ['ShiftLeft', 'ShiftRight', 'KeyC'].includes(code);

window.addEventListener('keydown', (event) => {
  if (!event.key) {
    return;
  }

  switch (event.code) {
    case 'ArrowLeft':
      event.preventDefault();
      game.move(-1);
      break;
    case 'ArrowRight':
      event.preventDefault();
      game.move(1);
      break;
    case 'ArrowDown':
      event.preventDefault();
      if (!event.repeat) {
        game.tapSoftDrop();
      }
      game.setSoftDrop(true);
      break;
    case 'Space':
      event.preventDefault();
      if (!event.repeat) {
        game.hardDrop();
      }
      break;
    case 'ArrowUp':
    case 'KeyX':
    case 'KeyS':
      if (!event.repeat) {
        event.preventDefault();
        game.rotate(true);
      }
      break;
    case 'KeyZ':
    case 'KeyA':
      if (!event.repeat) {
        event.preventDefault();
        game.rotate(false);
      }
      break;
    case 'KeyP':
    case 'Escape': {
      event.preventDefault();
      const stats = game.getStats();
      if (stats.state !== 'over') {
        game.togglePause();
      }
      break;
    }
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight':
      if (!event.repeat) {
        event.preventDefault();
        game.hold();
      }
      break;
    default:
      if (isRotationKey(event.code) || isHoldKey(event.code)) {
        event.preventDefault();
      }
      break;
  }
});

window.addEventListener('keyup', (event) => {
  if (event.code === 'ArrowDown') {
    event.preventDefault();
    game.setSoftDrop(false);
  }
});

restartButton.addEventListener('click', () => {
  game.reset();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    const stats = game.getStats();
    if (stats.state === 'playing') {
      game.togglePause();
    }
  }
});
