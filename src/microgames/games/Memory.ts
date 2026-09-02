import Phaser from 'phaser';
import { Microgame, W, H, type MicrogameMeta } from '../Microgame';
import { C } from '../../core/Palette';
import { drawRoom, drawStar, confetti } from '../../entities/Props';
import { audio } from '../../core/Audio';
import type { Critter } from '../../entities/Critter';

export const MemoryMeta: MicrogameMeta = {
  id: 'memory',
  name: 'Memory Lock',
  instruction: 'REPEAT!',
  mechanic: 'Short-term memory',
  group: 'memory',
  baseDuration: 8000,
  timeoutWins: false,
  character: 'pilar',
  accident: { name: 'Wrong Door', desc: 'Something in there was hungry.' },
};

const FLOOR = 600;
const SYMS = [
  { color: C.tomato, shape: 'tri' },
  { color: C.sky, shape: 'circle' },
  { color: C.mustard, shape: 'square' },
  { color: C.mint, shape: 'star' },
] as const;

export class MemoryLock extends Microgame {
  meta = MemoryMeta;
  private pilar!: Critter;
  private screenG!: Phaser.GameObjects.Graphics;
  private screenSym!: Phaser.GameObjects.Graphics;
  private buttons: Phaser.GameObjects.Container[] = [];
  private sequence: number[] = [];
  private entered = 0;
  private showing = true;
  private dots!: Phaser.GameObjects.Graphics;
  private doorGood!: Phaser.GameObjects.Graphics;
  private doorBad!: Phaser.GameObjects.Graphics;

  build() {
    const g = this.gfx();
    drawRoom(g, 0x5a4f8a, 0x3b3358, FLOOR);
    // two doors
    this.doorBad = this.gfx();
    this.drawDoor(this.doorBad, 170, C.tomatoDark, '?');
    this.doorGood = this.gfx();
    this.drawDoor(this.doorGood, 1110, C.mintDark, 'EXIT');
    // console
    const cg = this.gfx();
    cg.fillStyle(C.charcoal, 1);
    cg.fillRoundedRect(430, 110, 420, 260, 20);
    cg.fillStyle(C.greyDark, 1);
    cg.lineStyle(5, C.charcoal, 1);
    cg.fillRoundedRect(440, 120, 400, 240, 16);
    cg.strokeRoundedRect(440, 120, 400, 240, 16);
    this.screenG = this.gfx();
    this.screenG.fillStyle(0x1c2b2a, 1);
    this.screenG.fillRoundedRect(470, 140, 340, 170, 10);
    this.screenG.lineStyle(4, C.charcoal, 1);
    this.screenG.strokeRoundedRect(470, 140, 340, 170, 10);
    this.screenSym = this.gfx();
    this.dots = this.gfx();

    this.pilar = this.critter('pilar', 640, FLOOR - 80, 0.95);
    this.pilar.look(0, -1);
    this.pilar.setMood('focus');

    // buttons
    SYMS.forEach((s, i) => {
      const b = this.scene.add.container(380 + i * 174, 470);
      const bg = this.scene.add.graphics();
      bg.fillStyle(C.charcoal, 1);
      bg.fillRoundedRect(-62, -52 + 8, 124, 104, 20);
      bg.fillStyle(C.paper, 1);
      bg.lineStyle(5, C.charcoal, 1);
      bg.fillRoundedRect(-62, -52, 124, 104, 20);
      bg.strokeRoundedRect(-62, -52, 124, 104, 20);
      const sym = this.scene.add.graphics();
      this.drawSym(sym, i, 0, 0, 1);
      const key = this.scene.add.text(48, -40, String(i + 1), { fontFamily: '"Trebuchet MS", sans-serif', fontSize: '16px', color: '#2b2622', fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0.5);
      b.add([bg, sym, key]);
      b.setInteractive(new Phaser.Geom.Rectangle(-62, -52, 124, 104), Phaser.Geom.Rectangle.Contains);
      b.setAlpha(0.35);
      this.root.add(b);
      this.buttons.push(b);
    });

    const len = this.d < 0.35 ? 3 : this.d < 0.7 ? 4 : 5;
    let last = -1;
    for (let i = 0; i < len; i++) {
      let s = Phaser.Math.Between(0, 3);
      if (s === last && Math.random() < 0.7) s = (s + 1) % 4;
      this.sequence.push(s);
      last = s;
    }
    this.drawDots();
  }

  private drawDoor(g: Phaser.GameObjects.Graphics, x: number, color: number, label: string) {
    g.fillStyle(color, 1);
    g.lineStyle(5, C.charcoal, 1);
    g.fillRoundedRect(x - 70, FLOOR - 260, 140, 260, { tl: 30, tr: 30, bl: 0, br: 0 });
    g.strokeRoundedRect(x - 70, FLOOR - 260, 140, 260, { tl: 30, tr: 30, bl: 0, br: 0 });
    g.fillStyle(C.mustard, 1);
    g.fillCircle(x + 40, FLOOR - 130, 8);
    const t = this.text(x, FLOOR - 300, label, { size: 26, color: C.white });
    t.setDepth(1);
  }

  private drawSym(g: Phaser.GameObjects.Graphics, i: number, x: number, y: number, s: number) {
    const sym = SYMS[i];
    g.fillStyle(sym.color, 1);
    g.lineStyle(4 * s, C.charcoal, 1);
    const r = 28 * s;
    switch (sym.shape) {
      case 'tri':
        g.fillTriangle(x - r, y + r * 0.8, x + r, y + r * 0.8, x, y - r);
        g.strokeTriangle(x - r, y + r * 0.8, x + r, y + r * 0.8, x, y - r);
        break;
      case 'circle':
        g.fillCircle(x, y, r);
        g.strokeCircle(x, y, r);
        break;
      case 'square':
        g.fillRoundedRect(x - r, y - r, r * 2, r * 2, 6 * s);
        g.strokeRoundedRect(x - r, y - r, r * 2, r * 2, 6 * s);
        break;
      case 'star':
        drawStar(g, x, y, 5, r * 1.1, r * 0.5);
        break;
    }
  }

  private drawDots() {
    const g = this.dots;
    g.clear();
    const n = this.sequence.length;
    for (let i = 0; i < n; i++) {
      const x = 640 + (i - (n - 1) / 2) * 34;
      g.fillStyle(i < this.entered ? C.mint : C.charcoal, i < this.entered ? 1 : 0.5);
      g.lineStyle(3, C.charcoal, 1);
      g.fillCircle(x, 335, 9);
      g.strokeCircle(x, 335, 9);
    }
  }

  begin() {
    super.begin();
    // show the sequence
    const showMs = this.lerpD(380, 270);
    this.sequence.forEach((s, i) => {
      this.after(200 + i * (showMs + 90), () => {
        this.screenSym.clear();
        this.drawSym(this.screenSym, s, 640, 225, 1.8);
        audio.sfx('ping', 0.8 + s * 0.15);
      });
      this.after(200 + i * (showMs + 90) + showMs, () => this.screenSym.clear());
    });
    const total = 200 + this.sequence.length * (showMs + 90) + 100;
    this.after(total, () => {
      this.showing = false;
      this.screenSym.clear();
      const t = this.text(640, 225, 'YOUR TURN', { size: 32, color: C.mint });
      this.tween({ targets: t, scale: 1.1, duration: 300, yoyo: true, repeat: -1 });
      this.buttons.forEach((b) => this.tween({ targets: b, alpha: 1, duration: 150 }));
      audio.sfx('ding', 1.2);
    });
    this.buttons.forEach((b, i) => {
      b.on('pointerdown', () => this.press(i));
    });
    this.input.onKey((k) => {
      const idx = ['1', '2', '3', '4'].indexOf(k);
      if (idx >= 0) this.press(idx);
    });
  }

  private press(i: number) {
    if (this.done || this.showing) return;
    const b = this.buttons[i];
    this.tween({ targets: b, scaleY: 0.85, duration: 60, yoyo: true });
    if (this.sequence[this.entered] === i) {
      this.entered++;
      audio.sfx('correct', 1 + this.entered * 0.12);
      this.drawDots();
      this.pilar.hop(14, 160);
      if (this.entered >= this.sequence.length) this.win();
    } else {
      audio.sfx('wrong');
      this.lose();
    }
  }

  onWin(): number {
    audio.sfx('success');
    this.pilar.setMood('happy');
    // exit door swings open, Pilar walks out
    this.tween({ targets: this.doorGood, scaleX: 0.15, x: 1110 * 0.85, duration: 250, ease: 'Quad.easeIn' });
    audio.sfx('boing', 0.8);
    this.after(250, () => {
      this.pilar.walk(true);
      this.tween({ targets: this.pilar, x: 1110, duration: 700, ease: 'Sine.easeIn' });
      confetti(this.scene, this.root, 640, 300, [C.mint, C.sky, C.mustard], 10, 200);
      this.caption('UNLOCKED!', C.mint);
      audio.vocal('happy', 1.1);
    });
    return 1200;
  }

  onLose(): number {
    this.pilar.stopIdle();
    this.pilar.setMood('surprised');
    this.pilar.look(-1, 0);
    audio.sfx('alarm');
    const flash = this.gfx();
    flash.fillStyle(C.tomato, 0.35);
    flash.fillRect(0, 0, W, H);
    this.tween({ targets: flash, alpha: 0, duration: 400 });
    // wrong door bursts open, a tentacle whips out
    this.after(400, () => {
      audio.sfx('slam');
      this.scene.shakeCam(0.01, 200);
      this.tween({ targets: this.doorBad, scaleX: 0.1, x: 170 * 0.9, duration: 120 });
      const tent = this.gfx();
      tent.lineStyle(34, C.charcoal, 1);
      tent.beginPath();
      tent.moveTo(0, 0);
      tent.lineTo(160, -60);
      tent.lineTo(330, 10);
      tent.lineTo(460, -30);
      tent.strokePath();
      tent.lineStyle(24, C.violet, 1);
      tent.beginPath();
      tent.moveTo(0, 0);
      tent.lineTo(160, -60);
      tent.lineTo(330, 10);
      tent.lineTo(460, -30);
      tent.strokePath();
      tent.fillStyle(C.pink, 1);
      for (let i = 1; i < 6; i++) tent.fillCircle(i * 80, -10 + (i % 2) * 20, 7);
      tent.setPosition(170, FLOOR - 150);
      tent.setScale(0, 1);
      this.tween({ targets: tent, scaleX: 1, duration: 200, ease: 'Quad.easeOut', onComplete: () => {
        audio.sfx('squish', 0.8);
        this.pilar.setMood('scream');
        audio.sfx('aah', 0.9);
        this.tween({ targets: this.pilar.inner, scaleX: 1.5, scaleY: 0.8, duration: 120 });
        this.tween({ targets: [tent], scaleX: 0, duration: 260, delay: 150, ease: 'Quad.easeIn' });
        this.tween({ targets: this.pilar, x: 170, duration: 260, delay: 150, ease: 'Quad.easeIn', onComplete: () => {
          this.pilar.setVisible(false);
          this.tween({ targets: this.doorBad, scaleX: 1, x: 0, duration: 100 });
          audio.sfx('slam');
          this.after(150, () => {
            audio.sfx('chomp', 0.5);
            this.caption('WRONG DOOR.', C.tomato);
          });
        } });
      } });
    });
    return 1800;
  }
}
