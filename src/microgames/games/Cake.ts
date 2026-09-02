import Phaser from 'phaser';
import { Microgame, W, H, type MicrogameMeta } from '../Microgame';
import { C } from '../../core/Palette';
import { drawRoom, puff, confetti } from '../../entities/Props';
import { audio } from '../../core/Audio';
import type { Critter } from '../../entities/Critter';

export const CakeMeta: MicrogameMeta = {
  id: 'cake',
  name: 'Cake Candles',
  instruction: 'BLOW OUT!',
  mechanic: 'Scan and tap',
  group: 'targets',
  baseDuration: 6500,
  timeoutWins: false,
  character: 'nubbin',
  accident: { name: 'Well Done', desc: 'The candles were temperamental.' },
};

const FLOOR = 610;
const CAKE_Y = 420;

interface Candle {
  c: Phaser.GameObjects.Container;
  flame: Phaser.GameObjects.Graphics;
  lit: boolean;
  x: number;
}

export class CakeCandles extends Microgame {
  meta = CakeMeta;
  private nubbin!: Critter;
  private candles: Candle[] = [];
  private relightEvery = 0;
  private relightT = 0;
  private time = 0;

  build() {
    const g = this.gfx();
    drawRoom(g, 0xf9e3ec, 0xc6a9d6, FLOOR);
    // bunting
    for (let i = 0; i < 12; i++) {
      g.fillStyle([C.tomato, C.mustard, C.sky, C.mint][i % 4], 1);
      const x = 40 + i * 110;
      g.fillTriangle(x, 60, x + 60, 60, x + 30, 110);
    }
    g.lineStyle(4, C.charcoal, 1);
    g.lineBetween(0, 60, W, 60);
    // table
    g.fillStyle(C.white, 1);
    g.fillRoundedRect(240, CAKE_Y + 100, 800, 30, 10);
    g.strokeRoundedRect(240, CAKE_Y + 100, 800, 30, 10);
    g.fillStyle(C.wood, 1);
    g.fillRect(280, CAKE_Y + 130, 20, FLOOR - CAKE_Y - 130);
    g.fillRect(980, CAKE_Y + 130, 20, FLOOR - CAKE_Y - 130);

    // Nubbin peeks out from behind the cake, drooling
    this.nubbin = this.critter('nubbin', 640, CAKE_Y - 84, 0.95);
    this.nubbin.look(0, 1);
    this.nubbin.setMood('happy');

    // cake: wide, two tiers (drawn after Nubbin so it hides the body)
    const cake = this.gfx();
    cake.fillStyle(C.pink, 1);
    cake.lineStyle(5, C.charcoal, 1);
    cake.fillRoundedRect(300, CAKE_Y + 30, 680, 80, 14);
    cake.strokeRoundedRect(300, CAKE_Y + 30, 680, 80, 14);
    cake.fillStyle(C.white, 1);
    for (let x = 320; x < 980; x += 60) cake.fillCircle(x, CAKE_Y + 32, 16);
    cake.fillStyle(C.mustard, 1);
    cake.fillRoundedRect(340, CAKE_Y - 30, 600, 70, 14);
    cake.strokeRoundedRect(340, CAKE_Y - 30, 600, 70, 14);
    cake.fillStyle(C.tomato, 1);
    for (let x = 360; x < 940; x += 50) cake.fillCircle(x, CAKE_Y - 28, 12);
    this.text(640, CAKE_Y + 70, 'HAPPY BIRTHDAY, PROBABLY', { size: 20, color: C.charcoal, strokeWidth: 0, shadow: false }).setAlpha(0.6);

    const n = Math.round(this.lerpD(6, 11));
    for (let i = 0; i < n; i++) {
      const x = 380 + ((i + 0.5) / n) * 520;
      const c = this.scene.add.container(x, CAKE_Y - 30);
      const stick = this.scene.add.graphics();
      stick.fillStyle([C.sky, C.mint, C.white][i % 3], 1);
      stick.lineStyle(3, C.charcoal, 1);
      stick.fillRoundedRect(-8, -60, 16, 60, 4);
      stick.strokeRoundedRect(-8, -60, 16, 60, 4);
      stick.fillStyle(C.tomato, 1);
      stick.fillRect(-8, -50, 16, 6);
      stick.fillRect(-8, -30, 16, 6);
      stick.lineStyle(2, C.charcoal, 1);
      stick.lineBetween(0, -60, 0, -70);
      const flame = this.scene.add.graphics();
      c.add([stick, flame]);
      c.setInteractive(new Phaser.Geom.Rectangle(-35, -140, 70, 150), Phaser.Geom.Rectangle.Contains);
      this.root.add(c);
      const cd: Candle = { c, flame, lit: Math.random() < 0.6, x };
      this.candles.push(cd);
    }
    if (!this.candles.some((c) => c.lit)) this.candles[0].lit = true;
    this.relightEvery = this.d > 0.35 ? this.lerpD(1.6, 0.8) : 0;
    this.relightT = this.relightEvery;
    this.candles.forEach((c) => this.drawFlame(c, 1));
  }

  private drawFlame(c: Candle, size: number) {
    const g = c.flame;
    g.clear();
    if (!c.lit) return;
    const s = size * (0.9 + 0.2 * Math.sin(this.time * 20 + c.x));
    g.fillStyle(C.mustard, 1);
    g.lineStyle(3, C.charcoal, 1);
    g.fillEllipse(0, -84, 22 * s, 36 * s);
    g.strokeEllipse(0, -84, 22 * s, 36 * s);
    g.fillStyle(C.tomato, 1);
    g.fillEllipse(0, -80, 10 * s, 18 * s);
  }

  begin() {
    super.begin();
    for (const c of this.candles) c.c.on('pointerdown', () => this.tap(c));
  }

  private tap(c: Candle) {
    if (this.done) return;
    if (!c.lit) {
      audio.sfx('tick', 0.6);
      this.tween({ targets: c.c, angle: { from: -5, to: 5 }, duration: 50, yoyo: true, onComplete: () => c.c.setAngle(0) });
      return;
    }
    c.lit = false;
    c.flame.clear();
    audio.sfx('pop', 1.3);
    puff(this.scene, this.root, c.x, CAKE_Y - 120, 3, C.grey, 10);
    this.nubbin.squash(1.1, 0.9, 80);
    if (!this.candles.some((cc) => cc.lit)) this.win();
  }

  update(_t: number, delta: number) {
    if (!this.started || this.done) return;
    const dt = delta / 1000;
    this.time += dt;
    const f = 1 - this.scene.remainingFrac();
    const size = 1 + Math.max(0, f - 0.5) * 2.2; // flames swell near the end
    for (const c of this.candles) this.drawFlame(c, size);
    if (this.relightEvery > 0) {
      this.relightT -= dt;
      if (this.relightT <= 0 && this.scene.remainingFrac() > 0.2) {
        this.relightT = this.relightEvery;
        const unlit = this.candles.filter((c) => !c.lit);
        if (unlit.length > 0 && Math.random() < 0.85) {
          const c = unlit[Phaser.Math.Between(0, unlit.length - 1)];
          c.lit = true;
          audio.sfx('fire', 1.8);
          this.tween({ targets: c.c, scaleY: 1.15, duration: 80, yoyo: true });
        }
      }
    }
    if (f > 0.7) this.nubbin.setMood('scared');
  }

  onWin(): number {
    audio.sfx('success');
    this.nubbin.setMood('happy');
    // Nubbin devours the cake
    this.after(300, () => {
      audio.sfx('chomp');
      audio.vocal('happy', 0.9);
      this.tween({ targets: this.nubbin.inner, scaleX: 1.35, scaleY: 1.2, duration: 150, yoyo: true });
      for (const c of this.candles) this.tween({ targets: c.c, y: c.c.y + 60, alpha: 0, duration: 250, delay: Math.random() * 100 });
      confetti(this.scene, this.root, 640, 300, [C.pink, C.mustard, C.white], 16, 300);
      this.caption('WISH GRANTED!', C.pink);
    });
    return 1200;
  }

  onLose(): number {
    audio.sfx('fire');
    this.nubbin.stopIdle();
    this.nubbin.setMood('scream');
    // all lit candles flare into one giant flame
    const flare = this.gfx();
    flare.fillStyle(C.mustard, 1);
    flare.lineStyle(5, C.charcoal, 1);
    flare.fillTriangle(340, CAKE_Y - 40, 940, CAKE_Y - 40, 640, -200);
    flare.strokeTriangle(340, CAKE_Y - 40, 940, CAKE_Y - 40, 640, -200);
    flare.fillStyle(C.tomato, 1);
    flare.fillTriangle(440, CAKE_Y - 40, 840, CAKE_Y - 40, 640, -60);
    flare.setScale(1, 0);
    flare.setPosition(0, CAKE_Y - 40);
    flare.y = 0;
    // scale from the base: use transform origin trick
    const base = CAKE_Y - 40;
    this.tween({
      targets: flare,
      scaleY: 1,
      duration: 220,
      ease: 'Quad.easeOut',
      onUpdate: () => flare.setY(base * (1 - flare.scaleY)),
    });
    this.after(150, () => {
      audio.sfx('explode', 0.8);
      this.scene.shakeCam(0.015, 300);
      this.scene.flashCam(0xf2b63a, 120);
    });
    this.after(700, () => {
      this.tween({ targets: flare, alpha: 0, scaleY: 0.2, duration: 250, onUpdate: () => flare.setY(base * (1 - flare.scaleY)) });
      for (const c of this.candles) {
        c.lit = false;
        c.flame.clear();
        this.tween({ targets: c.c, scaleY: 0.4, alpha: 0.6, duration: 200 });
      }
      this.nubbin.soot();
      puff(this.scene, this.root, 640, CAKE_Y - 140, 8, C.greyDark, 22);
    });
    this.after(1100, () => {
      this.nubbin.blink();
      audio.sfx('hm', 0.8);
      this.caption('WELL DONE.', C.tomato);
    });
    return 1900;
  }
}

