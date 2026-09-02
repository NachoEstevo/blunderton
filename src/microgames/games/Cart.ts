import Phaser from 'phaser';
import { Microgame, W, H, type MicrogameMeta } from '../Microgame';
import { C, darken } from '../../core/Palette';
import { puff, dizzyStars } from '../../entities/Props';
import { audio } from '../../core/Audio';
import type { Critter } from '../../entities/Critter';

export const CartMeta: MicrogameMeta = {
  id: 'cart',
  name: 'Runaway Cart',
  instruction: 'BRAKE!',
  mechanic: 'Hold / release',
  group: 'hold',
  baseDuration: 7000,
  timeoutWins: false,
  character: 'gus',
  accident: { name: 'Aisle 7', desc: 'Shopping cart vs. can pyramid.' },
};

const FLOOR = 610;
const PILE_X = 1060;

export class RunawayCart extends Microgame {
  meta = CartMeta;
  private cart!: Phaser.GameObjects.Container;
  private gus!: Critter;
  private wheels: Phaser.GameObjects.Graphics[] = [];
  private gaugeG!: Phaser.GameObjects.Graphics;
  private cans: Phaser.GameObjects.Graphics[] = [];
  private p = 0; // brake pressure 0..1
  private holding = false;
  private zoneLo = 0.4;
  private zoneHi = 0.62;
  private stable = 0;
  private needStable = 1.5;
  private over = 0;
  private overLimit = 0.8;
  private cartX = 160;
  private maxV = 260;
  private failMode: 'crash' | 'spin' = 'crash';
  private sparkG!: Phaser.GameObjects.Graphics;
  private hint!: Phaser.GameObjects.Text;
  private shelfG!: Phaser.GameObjects.Graphics;

  build() {
    const g = this.gfx();
    g.fillStyle(0xf4ecdc, 1);
    g.fillRect(0, 0, W, FLOOR);
    g.fillStyle(0xd7d2c8, 1);
    g.fillRect(0, FLOOR, W, H - FLOOR);
    g.lineStyle(5, C.charcoal, 1);
    g.lineBetween(0, FLOOR, W, FLOOR);
    // shelves in the background
    this.shelfG = this.gfx();
    const s = this.shelfG;
    for (let x = -40; x < W + 200; x += 240) {
      s.fillStyle(C.wood, 1);
      s.lineStyle(4, C.charcoal, 1);
      s.fillRect(x, 260, 200, 340);
      s.strokeRect(x, 260, 200, 340);
      for (let r = 0; r < 4; r++) {
        s.fillStyle(C.charcoal, 1);
        s.fillRect(x, 330 + r * 70, 200, 6);
        for (let c = 0; c < 5; c++) {
          s.fillStyle([C.tomato, C.mint, C.sky, C.mustard, C.pink][(r + c) % 5], 1);
          s.fillRoundedRect(x + 10 + c * 38, 296 + r * 70, 28, 34, 4);
        }
      }
    }
    this.text(640, 90, 'AISLE 7 — CANS & REGRETS', { size: 22, color: C.charcoal, strokeWidth: 0, shadow: false }).setAlpha(0.4);

    // can pyramid
    const rows = 5;
    for (let r = 0; r < rows; r++) {
      const count = rows - r;
      for (let i = 0; i < count; i++) {
        const c = this.gfx();
        c.fillStyle([C.tomato, C.mustard, C.mint][(r + i) % 3], 1);
        c.lineStyle(3, C.charcoal, 1);
        c.fillRoundedRect(-18, -24, 36, 48, 6);
        c.strokeRoundedRect(-18, -24, 36, 48, 6);
        c.fillStyle(C.white, 1);
        c.fillRect(-18, -8, 36, 14);
        c.setPosition(PILE_X + (i - (count - 1) / 2) * 40, FLOOR - 24 - r * 48);
        this.cans.push(c);
      }
    }

    // cart with Gus
    this.cart = this.scene.add.container(this.cartX, FLOOR);
    const body = this.scene.add.graphics();
    body.lineStyle(5, C.charcoal, 1);
    body.fillStyle(C.grey, 1);
    body.fillPoints([new Phaser.Geom.Point(-70, -110), new Phaser.Geom.Point(70, -110), new Phaser.Geom.Point(60, -40), new Phaser.Geom.Point(-60, -40)], true);
    body.strokePoints([new Phaser.Geom.Point(-70, -110), new Phaser.Geom.Point(70, -110), new Phaser.Geom.Point(60, -40), new Phaser.Geom.Point(-60, -40)], true, true);
    body.lineStyle(3, C.charcoal, 0.6);
    for (let i = -50; i <= 50; i += 20) body.lineBetween(i, -106, i * 0.85, -44);
    body.lineStyle(5, C.charcoal, 1);
    body.lineBetween(-70, -110, -95, -150); // handle
    body.lineBetween(-95, -150, -105, -150);
    body.lineBetween(-60, -40, -50, -20);
    body.lineBetween(60, -40, 50, -20);
    this.gus = this.critter('gus', 0, -130, 0.8);
    this.gus.setMood('smug');
    this.gus.look(1, 0);
    this.cart.add([this.gus, body]);
    for (const wx of [-48, 48]) {
      const w = this.scene.add.graphics();
      w.fillStyle(C.charcoal, 1);
      w.fillCircle(0, 0, 16);
      w.fillStyle(C.grey, 1);
      w.fillCircle(0, 0, 7);
      w.fillStyle(C.charcoal, 1);
      w.fillRect(-2, -14, 4, 28);
      w.setPosition(wx, -16);
      this.cart.add(w);
      this.wheels.push(w);
    }
    this.root.add(this.cart);
    this.sparkG = this.gfx();

    // gauge
    this.gaugeG = this.gfx();
    this.text(140, 120, 'BRAKE', { size: 22, color: C.charcoal, strokeWidth: 0, shadow: false }).setAlpha(0.7);
    this.hint = this.text(140, 470, 'HOLD', { size: 26, color: C.charcoal, strokeWidth: 0, shadow: false }).setAlpha(0.5);
    this.tween({ targets: this.hint, alpha: 0.15, duration: 300, yoyo: true, repeat: -1 });

    const hw = this.lerpD(0.13, 0.08);
    const center = Phaser.Math.FloatBetween(0.45, 0.65);
    this.zoneLo = center - hw;
    this.zoneHi = center + hw;
    this.needStable = this.lerpD(1.3, 1.7);
    this.overLimit = this.lerpD(0.9, 0.55);
    this.maxV = this.lerpD(240, 300);
    this.drawGauge();
  }

  begin() {
    super.begin();
    this.input.onDown(() => (this.holding = true));
    this.input.onUp(() => (this.holding = false));
    this.input.onKey((k) => k === 'action' && (this.holding = true));
    this.input.onKeyUp((k) => k === 'action' && (this.holding = false));
  }

  update(_t: number, delta: number) {
    if (!this.started || this.done) return;
    const dt = delta / 1000;
    const hold = this.holding || this.input.isDown('action');
    this.p = Phaser.Math.Clamp(this.p + (hold ? 1.5 : -1.15) * dt, 0, 1);
    const inZone = this.p >= this.zoneLo && this.p <= this.zoneHi;
    const v = this.maxV * Math.pow(1 - this.p, 2) * (inZone ? 0.35 : 1);
    this.cartX += v * dt;
    this.cart.x = this.cartX;
    // shelves parallax
    this.shelfG.x -= v * dt * 0.3;
    if (this.shelfG.x < -240) this.shelfG.x += 240;
    for (const w of this.wheels) w.angle += v * dt * 2.5;
    // stability / over-brake
    if (inZone) {
      this.stable += dt;
      this.over = Math.max(0, this.over - dt);
    } else if (this.p > this.zoneHi) {
      this.over += dt;
      this.stable = Math.max(0, this.stable - dt * 0.5);
    } else {
      this.stable = Math.max(0, this.stable - dt * 0.5);
    }
    // sparks when over-braking
    this.sparkG.clear();
    if (this.p > this.zoneHi) {
      this.sparkG.fillStyle(C.mustard, 1);
      for (let i = 0; i < 5; i++) this.sparkG.fillCircle(this.cartX - 60 - Math.random() * 40, FLOOR - Math.random() * 30, 3 + Math.random() * 3);
      this.cart.setAngle(Math.sin(performance.now() / 20) * this.over * 4);
    } else {
      this.cart.setAngle(0);
    }
    if (hold) this.hint.setAlpha(0);
    this.drawGauge();
    if (this.stable >= this.needStable) {
      this.win();
      return;
    }
    if (this.over > this.overLimit) {
      this.failMode = 'spin';
      this.lose();
      return;
    }
    if (this.cartX + 70 >= PILE_X - 100) {
      this.failMode = 'crash';
      this.lose();
    }
  }

  private drawGauge() {
    const g = this.gaugeG;
    g.clear();
    const x = 120;
    const y = 150;
    const w = 40;
    const h = 300;
    g.fillStyle(C.charcoal, 1);
    g.fillRoundedRect(x - 4, y - 4 + 5, w + 8, h + 8, 12);
    g.fillStyle(C.paper, 1);
    g.lineStyle(4, C.charcoal, 1);
    g.fillRoundedRect(x, y, w, h, 10);
    g.strokeRoundedRect(x, y, w, h, 10);
    // zone
    g.fillStyle(C.mint, 1);
    g.fillRect(x + 3, y + h - this.zoneHi * h, w - 6, (this.zoneHi - this.zoneLo) * h);
    g.fillStyle(C.tomato, 0.35);
    g.fillRect(x + 3, y + 3, w - 6, h - this.zoneHi * h - 3);
    // needle
    const ny = y + h - this.p * h;
    g.fillStyle(C.charcoal, 1);
    g.fillTriangle(x - 16, ny - 10, x - 16, ny + 10, x + 2, ny);
    g.fillTriangle(x + w + 16, ny - 10, x + w + 16, ny + 10, x + w - 2, ny);
    g.lineStyle(3, C.charcoal, 1);
    g.lineBetween(x, ny, x + w, ny);
    // stability ring
    const f = Math.min(1, this.stable / this.needStable);
    g.lineStyle(8, C.charcoal, 0.15);
    g.strokeCircle(x + w / 2, y + h + 50, 22);
    if (f > 0) {
      g.lineStyle(8, C.mint, 1);
      g.beginPath();
      g.arc(x + w / 2, y + h + 50, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f, false);
      g.strokePath();
    }
  }

  onWin(): number {
    audio.sfx('screech', 0.8);
    this.gus.setMood('smug');
    this.tween({ targets: this.cart, angle: -8, duration: 150, yoyo: true, ease: 'Quad.easeOut' });
    puff(this.scene, this.root, this.cartX - 40, FLOOR - 10, 6, C.creamDark, 18);
    // the top can wobbles and drops. Just one. Gus pretends not to notice.
    this.after(400, () => {
      const top = this.cans[this.cans.length - 1];
      audio.sfx('plop', 1.2);
      this.tween({ targets: top, angle: 90, y: FLOOR - 18, x: top.x - 40, duration: 350, ease: 'Bounce.easeOut' });
      this.gus.look(-1, 0);
    });
    this.after(700, () => {
      this.caption('STOPPED!', C.mint);
      audio.sfx('success');
    });
    return 1200;
  }

  onLose(): number {
    this.gus.stopIdle();
    if (this.failMode === 'spin') {
      audio.sfx('screech');
      this.gus.setMood('scared');
      this.tween({ targets: this.cart, angle: 720, x: PILE_X - 120, duration: 800, ease: 'Quad.easeIn', onComplete: () => this.crash() });
      return 2100;
    }
    this.gus.setMood('scream');
    audio.sfx('aah');
    this.tween({ targets: this.cart, x: PILE_X - 40, duration: 220, ease: 'Quad.easeIn', onComplete: () => this.crash() });
    return 1600;
  }

  private crash() {
    audio.sfx('crunch');
    audio.sfx('explode', 1.6);
    this.scene.shakeCam(0.02, 350);
    for (const c of this.cans) {
      const a = Phaser.Math.FloatBetween(-Math.PI, 0);
      const d = Phaser.Math.Between(120, 420);
      this.tween({ targets: c, x: c.x + Math.cos(a) * d, y: Math.min(FLOOR - 24, c.y + Math.sin(a) * d + 300), angle: Phaser.Math.Between(-720, 720), duration: 700, ease: 'Quad.easeOut' });
    }
    this.tween({ targets: this.cart, angle: -30, y: FLOOR - 20, duration: 200, ease: 'Quad.easeOut' });
    this.gus.setMood('dizzy');
    // a can lands on Gus' head
    this.after(300, () => {
      const c = this.cans[0];
      this.scene.tweens.killTweensOf(c);
      c.setPosition(this.cart.x - 10, -60);
      this.tween({ targets: c, y: FLOOR - 250, angle: 0, duration: 260, ease: 'Bounce.easeOut', onComplete: () => audio.sfx('plop', 0.7) });
      dizzyStars(this.scene, this.root, this.cart.x, FLOOR - 230, 1200);
      this.caption('CLEAN-UP, AISLE 7', C.tomato);
    });
  }
}
