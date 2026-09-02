import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene';
import { MenuScene } from './scenes/MenuScene';
import { HowToScene } from './scenes/HowToScene';
import { CollectionScene } from './scenes/CollectionScene';
import { PlayScene } from './scenes/PlayScene';
import { GameOverScene } from './scenes/GameOverScene';
import { audio } from './core/Audio';
import { hex, C } from './core/Palette';

const params = new URLSearchParams(location.search);
const debugGame = params.get('debugGame');

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: hex(C.cream),
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  render: { antialias: true, roundPixels: false, pixelArt: false },
  input: { activePointers: 3, keyboard: true, mouse: true, touch: true },
  fps: { target: 60, smoothStep: true },
  scene: [TitleScene, MenuScene, HowToScene, CollectionScene, PlayScene, GameOverScene],
});

// Audio can only start after a user gesture; unlock on the first one, wherever it happens.
const unlock = () => audio.unlock();
window.addEventListener('pointerdown', unlock, { passive: true });
window.addEventListener('keydown', unlock);
window.addEventListener('touchstart', unlock, { passive: true });

// Debug entry: ?debugGame=fan (single game on repeat) or ?debugGame=all (every game in order).
if (debugGame) {
  game.events.once('ready', () => {
    game.scene.stop('Title');
    game.scene.start('Play', { debugGame });
  });
}

// Prevent the page from scrolling/zooming on touch gestures over the canvas.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
