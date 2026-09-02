import Phaser from 'phaser';
import { Microgame, W, H, type MicrogameMeta } from '../Microgame';
import { C } from '../../core/Palette';
import { drawSky, drawCloud, puff } from '../../entities/Props';
import { audio } from '../../core/Audio';
import type { Critter } from '../../entities/Critter';

export const BridgeMeta: MicrogameMeta = {
  id: 'bridge',
  name: 'Tiny Bridge',
  instruction: 'STEADY!',
  mechanic: 'Precision with inertia',
  group: 'balance-pointer',
  baseDuration: 7000,
  timeoutWins: false,
  character: 'gus',
  accident: { name: 'Long Way Down', desc: 'The bridge was fine. The bathtub was not.' },
};

const BRIDGE_Y = 430;
const X0 = 250;
const X1 = 1030;

export class TinyBridge extends Microgame {
  meta = BridgeMeta;
  private gus!: Critter;
  private tub!: Phaser.GameObjects.Graphics;
  private bridgeG!: Phaser.GameObjects.Graphics;
  private meterG!: Phaser.GameObjects.Graphics;
  private b = 0; // balance -1..1
  private bv = 0;
  private x = X0;
  private speed = 120;
  private gravity = 3;
  private control = 6;
  private swayAmp = 0.6;
  private time = 0;
  private u = 0;
  private pointerX: number | null = null;
  private gust = 0;
  private nextGust = 1;

  build() {
    const g = this.gfx();
    drawSky(g, C.skyLight, H);
    drawCloud(g, 180, 120, 0.9);
    drawCloud(g, 1100, 90, 0.7);
    // canyon walls
    g.fillStyle(0xd9a066, 1);
    g.lineStyle(5, C.charcoal, 1);
    g.fillPoints([new Phaser.Geom.Point(0, BRIDGE_Y - 20), new Phaser.Geom.Point(X0 + 20, BRIDGE_Y - 20), new Phaser.Geom.Point(X0 - 40, H), new Phaser.Geom.Point(0, H)], true);
    g.strokePoints([new Phaser.Geom.Point(0, BRIDGE_Y - 20), new Phaser.Geom.Point(X0 + 20, BRIDGE_Y - 20), new Phaser.Geom.Point(X0 - 40, H), new Phaser.Geom.Point(0, H)], true, true);
    g.fillPoints([new Phaser.Geom.Point(W, BRIDGE_Y - 20), new Phaser.Geom.Point(X1 - 20, BRIDGE_Y - 20), new Phaser.Geom.Point(X1 + 40, H), new Phaser.Geom.Point(W, H)], true);
    g.strokePoints([new Phaser.Geom.Point(W, BRIDGE_Y - 20), new Phaser.Geom.Point(X1 - 20, BRIDGE_Y - 20), new Phaser.Geom.Point(X1 + 40, H), new Phaser.Geom.Point(W, H)], true, true);
    // canyon depth haze
    g.fillStyle(C.violet, 0.25);
    g.fillRect(X0, BRIDGE_Y + 120, X1 - X0, H - BRIDGE_Y - 120);
    // posts
    g.fillStyle(C.brownDark, 1);
    g.fillRect(X0 - 10, BRIDGE_Y - 90, 14, 80);
    g.fillRect(X1 - 4, BRIDGE_Y - 90, 14, 80);
    // sign
    g.fillStyle(C.mustard, 1);
    g.fillRoundedRect(60, BRIDGE_Y - 160, 150, 60, 8);
    g.strokeRoundedRect(60, BRIDGE_Y - 160, 150, 60, 8);
    g.fillRect(128, BRIDGE_Y - 100, 12, 80);
    this.text(135, BRIDGE_Y - 130, 'MAX 1 PERSON\nNO BATHTUBS', { size: 14, color: C.charcoal, strokeWidth: 0, shadow: false });

    this.bridgeG = this.gfx();
    this.gus = this.critter('gus', this.x, BRIDGE_Y - 44, 0.9);
    this.gus.walk(true);
    this.gus.drawArms(1);
    this.gus.setMood('smug');
    // bathtub
    this.tub = this.gfx();
    this.tub.fillStyle(C.white, 1);
    this.tub.lineStyle(5, C.charcoal, 1);
    this.tub.fillRoundedRect(-110, -40, 220, 80, { tl: 20, tr: 20, bl: 50, br: 50 });
    this.tub.strokeRoundedRect(-110, -40, 220, 80, { tl: 20, tr: 20, bl: 50, br: 50 });
    this.tub.fillStyle(C.sky, 1);
    this.tub.fillRoundedRect(-96, -32, 192, 20, 8);
    this.tub.fillStyle(C.charcoal, 1);
    this.tub.fillRect(-90, 40, 16, 16);
    this.tub.fillRect(74, 40, 16, 16);
    this.tub.fillStyle(C.grey, 1);
    this.tub.fillRect(70, -70, 10, 36);
    this.tub.fillCircle(75, -70, 9);
    // rubber duck
    this.tub.fillStyle(C.mustard, 1);
    this.tub.fillCircle(-30, -40, 12);
    this.tub.fillCircle(-18, -50, 8);
    this.tub.fillStyle(C.orange, 1);
    this.tub.fillTriangle(-10, -52, 0, -48, -10, -44);

    this.meterG = this.gfx();

    this.speed = (X1 - X0) / ((this.ctx.duration / 1000) * 0.78);
    this.gravity = this.lerpD(2.4, 4.6);
    this.control = this.lerpD(5.5, 7);
    this.swayAmp = this.lerpD(0.5, 1.3);
    this.drawBridge();
    this.drawMeter();
    const hint = this.text(640, 620, 'move left / right to lean', { size: 20, color: C.charcoal, strokeWidth: 0, shadow: false }).setAlpha(0.45);
    this.tween({ targets: hint, alpha: 0, duration: 400, delay: 1500 });
  }

  begin() {
    super.begin();
    this.input.onMove((p) => (this.pointerX = p.x));
    this.input.onDown((p) => (this.pointerX = p.x));
  }

  update(_t: number, delta: number) {
    if (!this.started || this.done) return;
    const dt = Math.min(0.05, delta / 1000);
    this.time += dt;
    // control input: pointer offset from center or keys
    let u = this.input.axisX();
    if (u === 0 && this.pointerX !== null) u = Phaser.Math.Clamp((this.pointerX - 640) / 260, -1, 1);
    this.u = u;
    // wind gusts
    this.nextGust -= dt;
    if (this.nextGust <= 0) {
      this.nextGust = Phaser.Math.FloatBetween(0.9, 1.8);
      this.gust = (Math.random() < 0.5 ? -1 : 1) * this.swayAmp * Phaser.Math.FloatBetween(0.6, 1.2);
      audio.sfx('wind', 1);
    }
    this.gust *= 1 - 1.5 * dt;
    const sway = Math.sin(this.time * 2.3) * this.swayAmp * 0.6 + this.gust;
    this.bv += (this.gravity * this.b + sway - u * this.control) * dt;
    this.bv *= 1 - 1.2 * dt;
    this.b += this.bv * dt;
    // progress
    this.x += this.speed * dt;
    this.gus.x = this.x;
    const dip = Math.sin(((this.x - X0) / (X1 - X0)) * Math.PI) * 40;
    this.gus.y = BRIDGE_Y - 44 + dip + Math.sin(this.time * 6) * 4;
    this.gus.inner.setRotation(this.b * 0.55);
    this.tub.setPosition(this.x + this.b * 30, this.gus.y - 100);
    this.tub.setRotation(this.b * 0.85);
    this.gus.setMood(Math.abs(this.b) > 0.6 ? 'scared' : 'smug');
    this.drawBridge();
    this.drawMeter();
    if (Math.abs(this.b) > 1) {
      this.lose();
      return;
    }
    if (this.x >= X1 - 10) this.win();
  }

  private drawBridge() {
    const g = this.bridgeG;
    g.clear();
    const n = 20;
    // ropes
    g.lineStyle(4, C.brownDark, 1);
    for (const off of [-60, -20]) {
      g.beginPath();
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = X0 + t * (X1 - X0);
        const y = BRIDGE_Y + off + Math.sin(t * Math.PI) * 40 + Math.sin(this.time * 2.3 + t * 6) * 6 * this.swayAmp;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokePath();
    }
    // planks
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = X0 + t * (X1 - X0);
      const y = BRIDGE_Y + Math.sin(t * Math.PI) * 40 + Math.sin(this.time * 2.3 + t * 6) * 6 * this.swayAmp;
      g.fillStyle(i % 2 ? C.wood : 0xc98d55, 1);
      g.lineStyle(3, C.charcoal, 1);
      g.fillRect(x - 16, y - 8, 32, 16);
      g.strokeRect(x - 16, y - 8, 32, 16);
      g.lineStyle(2, C.brownDark, 1);
      g.lineBetween(x, y - 8, x, y - 20);
      g.lineBetween(x, y - 20, x, y - 60);
    }
  }

  private drawMeter() {
    const g = this.meterG;
    g.clear();
    const cx = 640;
    const y = 100;
    const w = 320;
    g.fillStyle(C.charcoal, 1);
    g.fillRoundedRect(cx - w / 2 - 4, y - 14 + 5, w + 8, 36, 12);
    g.fillStyle(C.paper, 1);
    g.lineStyle(4, C.charcoal, 1);
    g.fillRoundedRect(cx - w / 2, y - 14, w, 28, 10);
    g.strokeRoundedRect(cx - w / 2, y - 14, w, 28, 10);
    g.fillStyle(C.mint, 0.5);
    g.fillRect(cx - w * 0.15, y - 10, w * 0.3, 20);
    g.fillStyle(C.tomato, 0.35);
    g.fillRect(cx - w / 2 + 4, y - 10, w * 0.12, 20);
    g.fillRect(cx + w / 2 - 4 - w * 0.12, y - 10, w * 0.12, 20);
    const bx = cx + Phaser.Math.Clamp(this.b, -1, 1) * (w / 2 - 14);
    g.fillStyle(C.mustard, 1);
    g.fillCircle(bx, y, 13);
    g.strokeCircle(bx, y, 13);
    // lean arrow
    if (Math.abs(this.u) > 0.1) {
      g.fillStyle(C.charcoal, 0.6);
      const dir = Math.sign(this.u);
      g.fillTriangle(cx + dir * (w / 2 + 20), y - 10, cx + dir * (w / 2 + 20), y + 10, cx + dir * (w / 2 + 34), y);
    }
  }

  onWin(): number {
    this.gus.walk(false);
    this.gus.inner.setRotation(0);
    audio.sfx('success');
    // puts the tub down and sits in it
    this.tween({ targets: this.tub, x: X1 + 120, y: BRIDGE_Y - 60, rotation: 0, duration: 300, ease: 'Quad.easeOut' });
    this.tween({ targets: this.gus, x: X1 + 120, y: BRIDGE_Y - 100, duration: 350, ease: 'Quad.easeOut' });
    this.after(350, () => {
      audio.sfx('splash', 0.6);
      audio.vocal('happy', 0.6);
      this.gus.setMood('smug');
      this.gus.celebrate();
      this.caption('CROSSED!', C.mint);
    });
    return 1200;
  }

  onLose(): number {
    this.gus.walk(false);
    this.gus.setMood('scream');
    audio.sfx('fall');
    audio.sfx('aah', 0.5);
    const side = Math.sign(this.b) || 1;
    this.tween({ targets: this.gus, y: H + 200, x: this.gus.x + side * 60, angle: side * 540, duration: 1000, ease: 'Quad.easeIn' });
    this.tween({ targets: this.tub, y: H + 300, x: this.tub.x + side * 120, angle: side * 300, duration: 1100, ease: 'Quad.easeIn' });
    // comedy beat: silence... then a tiny thud far below
    this.after(1500, () => {
      audio.sfx('thud', 0.5);
      puff(this.scene, this.root, this.x, H - 10, 4, C.creamDark, 10);
      const t = this.text(this.x, H - 40, '...ow', { size: 18, color: C.charcoal, strokeWidth: 0, shadow: false });
      this.tween({ targets: t, y: H - 80, alpha: 0, duration: 800 });
    });
    this.after(1800, () => {
      audio.sfx('splash', 0.4);
      this.caption('LONG WAY DOWN.', C.sky);
    });
    return 2400;
  }
}
