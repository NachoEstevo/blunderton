import Phaser from 'phaser';
import { C } from '../core/Palette';
import { audio } from '../core/Audio';

/**
 * The fuse: a burning bar at the top center. Shrinks from the right, spark at the tip,
 * turns red and pulses when time is almost out. Ticks in the last stretch.
 */
export class TimerBar extends Phaser.GameObjects.Container {
  private g: Phaser.GameObjects.Graphics;
  private spark: Phaser.GameObjects.Graphics;
  private total = 1;
  private remaining = 0;
  running = false;
  private lastTick = -1;
  private onExpire?: () => void;
  private readonly barW = 420;
  private readonly barH = 20;

  constructor(scene: Phaser.Scene) {
    super(scene, 640, 44);
    this.g = scene.add.graphics();
    this.spark = scene.add.graphics();
    this.add([this.g, this.spark]);
    this.setDepth(1000);
    this.drawSpark();
    this.draw(1);
    scene.add.existing(this);
  }

  private drawSpark() {
    const s = this.spark;
    s.clear();
    s.fillStyle(C.mustard, 1);
    s.lineStyle(3, C.charcoal, 1);
    const pts: Phaser.Geom.Point[] = [];
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? 15 : 7;
      const a = (i / 8) * Math.PI * 2;
      pts.push(new Phaser.Geom.Point(Math.cos(a) * r, Math.sin(a) * r));
    }
    s.fillPoints(pts, true);
    s.strokePoints(pts, true, true);
    s.fillStyle(C.white, 1);
    s.fillCircle(0, 0, 4);
  }

  start(ms: number, onExpire: () => void) {
    this.total = ms;
    this.remaining = ms;
    this.running = true;
    this.lastTick = -1;
    this.onExpire = onExpire;
    this.setVisible(true);
    this.draw(1);
  }

  stop() {
    this.running = false;
  }

  hide() {
    this.running = false;
    this.setVisible(false);
  }

  frac() {
    return this.total > 0 ? Math.max(0, this.remaining / this.total) : 0;
  }

  update(delta: number) {
    if (!this.running) return;
    this.remaining -= delta;
    const f = this.frac();
    this.draw(f);
    if (this.remaining <= 1500 && this.remaining > 0) {
      const tick = Math.floor(this.remaining / 250);
      if (tick !== this.lastTick) {
        this.lastTick = tick;
        audio.sfx('countdown', 1 + (6 - tick) * 0.06);
      }
    }
    if (this.remaining <= 0) {
      this.running = false;
      this.remaining = 0;
      this.onExpire?.();
    }
  }

  private draw(f: number) {
    const g = this.g;
    const w = this.barW;
    const h = this.barH;
    g.clear();
    // track
    g.fillStyle(C.charcoal, 1);
    g.fillRoundedRect(-w / 2 - 3, -h / 2 - 3 + 4, w + 6, h + 6, 12);
    g.fillStyle(C.paper, 1);
    g.lineStyle(4, C.charcoal, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    // fill
    const low = f < 0.25;
    const pulse = low ? 0.75 + 0.25 * Math.sin(performance.now() / 60) : 1;
    const color = low ? C.tomato : f < 0.5 ? C.mustard : C.mint;
    const fw = Math.max(0, w * f);
    if (fw > 2) {
      g.fillStyle(color, pulse);
      g.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, Math.max(4, fw - 6), h - 6, 7);
    }
    this.spark.setPosition(-w / 2 + fw, 0);
    this.spark.setVisible(f > 0);
    this.spark.setScale(low ? 1.1 + 0.2 * Math.sin(performance.now() / 40) : 0.9 + 0.1 * Math.sin(performance.now() / 90));
    this.spark.setRotation(performance.now() / 300);
  }
}
