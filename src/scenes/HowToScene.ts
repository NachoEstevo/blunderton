import Phaser from 'phaser';
import { C, hex } from '../core/Palette';
import { label, title } from '../ui/Text';
import { Button } from '../ui/Button';
import { audio } from '../core/Audio';

export class HowToScene extends Phaser.Scene {
  constructor() {
    super('HowTo');
  }

  create() {
    this.cameras.main.setBackgroundColor(hex(C.cream));
    this.cameras.main.fadeIn(150, 251, 241, 220);
    title(this, 640, 70, 'HOW TO PLAY', { size: 72, color: C.tomato, strokeWidth: 9 });
    label(this, 640, 140, 'Survive as many microgames as possible.', { size: 30, color: C.charcoal, strokeWidth: 0, shadow: false });
    label(this, 640, 180, 'Three mistakes and you are done.', { size: 30, color: C.charcoal, strokeWidth: 0, shadow: false });
    label(this, 640, 222, 'Read the word. Look at the screen. You have a few seconds. Good luck.', { size: 18, color: C.charcoal, strokeWidth: 0, shadow: false }).setAlpha(0.6);

    const demos: Array<[string, string, (c: Phaser.GameObjects.Container) => void]> = [
      ['TAP', 'click / touch', (c) => this.demoTap(c)],
      ['DRAG', 'hold and move', (c) => this.demoDrag(c)],
      ['HOLD', 'press and keep pressing', (c) => this.demoHold(c)],
      ['MOVE', 'arrows / WASD / touch sides', (c) => this.demoMove(c)],
    ];
    demos.forEach(([name, sub, fn], i) => {
      const x = 200 + i * 293;
      const y = 400;
      const c = this.add.container(x, y);
      const g = this.add.graphics();
      g.fillStyle(C.charcoal, 1);
      g.fillRoundedRect(-120 + 6, -110 + 8, 240, 220, 24);
      g.fillStyle([C.mustard, C.sky, C.mint, C.pink][i], 1);
      g.lineStyle(5, C.charcoal, 1);
      g.fillRoundedRect(-120, -110, 240, 220, 24);
      g.strokeRoundedRect(-120, -110, 240, 220, 24);
      c.add(g);
      const inner = this.add.container(0, 10);
      c.add(inner);
      fn(inner);
      c.add(label(this, 0, -80, name, { size: 34, strokeWidth: 6 }));
      c.add(label(this, 0, 92, sub, { size: 14, color: C.charcoal, strokeWidth: 0, shadow: false }));
    });

    new Button(this, 640, 620, 'BACK', () => this.back(), { w: 220, h: 64, color: C.violet, size: 28 });
    this.input.keyboard?.on('keydown-ESC', () => this.back());
    this.input.keyboard?.on('keydown-ENTER', () => this.back());
    this.events.once('shutdown', () => {
      this.input.keyboard?.off('keydown-ESC');
      this.input.keyboard?.off('keydown-ENTER');
    });
  }

  private hand(c: Phaser.GameObjects.Container, x: number, y: number) {
    const h = this.add.graphics();
    h.fillStyle(C.paper, 1);
    h.lineStyle(4, C.charcoal, 1);
    h.fillRoundedRect(-18, 0, 36, 40, 12);
    h.strokeRoundedRect(-18, 0, 36, 40, 12);
    h.fillRoundedRect(-8, -30, 16, 40, 8);
    h.strokeRoundedRect(-8, -30, 16, 40, 8);
    h.setPosition(x, y);
    c.add(h);
    return h;
  }

  private demoTap(c: Phaser.GameObjects.Container) {
    const btn = this.add.graphics();
    btn.fillStyle(C.tomato, 1);
    btn.lineStyle(4, C.charcoal, 1);
    btn.fillCircle(0, 0, 34);
    btn.strokeCircle(0, 0, 34);
    btn.setPosition(0, 20);
    c.add(btn);
    const h = this.hand(c, 24, -30);
    this.tweens.add({
      targets: h,
      y: -6,
      duration: 220,
      yoyo: true,
      repeat: -1,
      repeatDelay: 500,
      ease: 'Quad.easeIn',
      onYoyo: () => {
        this.tweens.add({ targets: btn, scale: 0.85, duration: 80, yoyo: true });
        const ring = this.add.graphics();
        ring.lineStyle(4, C.white, 1);
        ring.strokeCircle(0, 0, 36);
        ring.setPosition(0, 20);
        c.add(ring);
        this.tweens.add({ targets: ring, scale: 1.6, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
      },
    });
  }

  private demoDrag(c: Phaser.GameObjects.Container) {
    const path = this.add.graphics();
    path.lineStyle(4, C.charcoal, 0.3);
    path.lineBetween(-70, 20, 70, 20);
    path.strokeCircle(70, 20, 30);
    c.add(path);
    const obj = this.add.graphics();
    obj.fillStyle(C.mustard, 1);
    obj.lineStyle(4, C.charcoal, 1);
    obj.fillRoundedRect(-22, -22, 44, 44, 10);
    obj.strokeRoundedRect(-22, -22, 44, 44, 10);
    obj.setPosition(-70, 20);
    c.add(obj);
    const h = this.hand(c, -60, -10);
    this.tweens.add({ targets: [obj], x: 70, duration: 900, yoyo: true, repeat: -1, hold: 400, repeatDelay: 400, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: [h], x: 80, duration: 900, yoyo: true, repeat: -1, hold: 400, repeatDelay: 400, ease: 'Sine.easeInOut' });
  }

  private demoHold(c: Phaser.GameObjects.Container) {
    const ring = this.add.graphics();
    ring.setPosition(0, 20);
    c.add(ring);
    const h = this.hand(c, 22, -10);
    const t = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 1200,
      repeat: -1,
      repeatDelay: 500,
      onUpdate: () => {
        const v = t.getValue() ?? 0;
        ring.clear();
        ring.lineStyle(10, C.charcoal, 0.2);
        ring.strokeCircle(0, 0, 40);
        ring.lineStyle(10, C.tomato, 1);
        ring.beginPath();
        ring.arc(0, 0, 40, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v, false);
        ring.strokePath();
        h.setY(v > 0 && v < 1 ? -2 : -10);
      },
    });
  }

  private demoMove(c: Phaser.GameObjects.Container) {
    const keys = this.add.graphics();
    keys.fillStyle(C.paper, 1);
    keys.lineStyle(3, C.charcoal, 1);
    for (const [x, y] of [[0, -30], [-40, 10], [0, 10], [40, 10]]) {
      keys.fillRoundedRect(x - 17, y - 17, 34, 34, 6);
      keys.strokeRoundedRect(x - 17, y - 17, 34, 34, 6);
    }
    keys.fillStyle(C.charcoal, 1);
    keys.fillTriangle(-8, -22, 8, -22, 0, -36);
    keys.fillTriangle(-32, 10, -32, 2, -46, 10);
    keys.fillTriangle(-32, 10, -32, 18, -46, 10);
    keys.fillTriangle(32, 10, 32, 2, 46, 10);
    keys.fillTriangle(32, 10, 32, 18, 46, 10);
    keys.fillTriangle(-8, 2, 8, 2, 0, 16);
    keys.setPosition(0, -20);
    c.add(keys);
    const dot = this.add.graphics();
    dot.fillStyle(C.tomato, 1);
    dot.lineStyle(3, C.charcoal, 1);
    dot.fillCircle(0, 0, 14);
    dot.strokeCircle(0, 0, 14);
    dot.setPosition(-60, 60);
    c.add(dot);
    this.tweens.add({ targets: dot, x: 60, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private back() {
    audio.sfx('ui');
    this.cameras.main.fadeOut(120, 251, 241, 220);
    this.time.delayedCall(130, () => this.scene.start('Menu'));
  }
}
