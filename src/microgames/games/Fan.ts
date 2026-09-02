import Phaser from 'phaser';
import { Microgame, W, H, type MicrogameMeta } from '../Microgame';
import { C, darken } from '../../core/Palette';
import { drawRoom, puff } from '../../entities/Props';
import { audio } from '../../core/Audio';
import type { Critter } from '../../entities/Critter';

export const FanMeta: MicrogameMeta = {
  id: 'fan',
  name: 'Fan Problem',
  instruction: 'PULL!',
  mechanic: 'Drag against the wind',
  group: 'drag',
  baseDuration: 6000,
  timeoutWins: false,
  character: 'mort',
  accident: { name: 'Air Mail', desc: 'Scarf, meet industrial fan.' },
};

const FLOOR = 600;
const FAN_X = 1080;
const FAN_Y = 340;
const FAN_R = 150;
const NECK = { x: 372, y: 330 };
const SAFE_X = 470;

export class FanProblem extends Microgame {
  meta = FanMeta;
  private mort!: Critter;
  private tip!: Phaser.GameObjects.Container;
  private tx = 720;
  private ty = 345;
  private dragging = false;
  private scarfG!: Phaser.GameObjects.Graphics;
  private blades!: Phaser.GameObjects.Graphics;
  private wind = 70;
  private gusty = false;
  private time = 0;
  private papers: Phaser.GameObjects.Graphics[] = [];
  private safeG!: Phaser.GameObjects.Graphics;

  build() {
    const g = this.gfx();
    drawRoom(g, 0xdfe7ea, 0xb8a58c, FLOOR);
    // desk
    g.fillStyle(C.wood, 1);
    g.lineStyle(5, C.charcoal, 1);
    g.fillRoundedRect(180, 420, 360, 30, 8);
    g.strokeRoundedRect(180, 420, 360, 30, 8);
    g.fillRect(200, 450, 20, FLOOR - 450);
    g.fillRect(500, 450, 20, FLOOR - 450);
    // monitor
    g.fillStyle(C.charcoal, 1);
    g.fillRoundedRect(210, 330, 110, 80, 6);
    g.fillStyle(C.mint, 1);
    g.fillRect(218, 338, 94, 60);
    g.fillStyle(C.charcoal, 1);
    g.fillRect(255, 410, 20, 12);
    // safe zone
    this.safeG = this.gfx();
    this.safeG.fillStyle(C.mint, 0.25);
    this.safeG.lineStyle(4, C.mintDark, 0.8);
    this.safeG.fillRoundedRect(380, 250, SAFE_X - 380 + 30, 190, 16);
    this.safeG.strokeRoundedRect(380, 250, SAFE_X - 380 + 30, 190, 16);
    this.text(440, 232, 'TUCK IN', { size: 18, color: C.mintDark, strokeWidth: 0, shadow: false });

    // fan
    const cage = this.gfx();
    cage.fillStyle(C.charcoal, 1);
    cage.fillRect(FAN_X - 30, FAN_Y + FAN_R - 20, 60, FLOOR - (FAN_Y + FAN_R - 20));
    cage.fillRoundedRect(FAN_X - 90, FLOOR - 24, 180, 24, 8);
    cage.fillStyle(C.grey, 1);
    cage.lineStyle(6, C.charcoal, 1);
    cage.fillCircle(FAN_X, FAN_Y, FAN_R);
    cage.strokeCircle(FAN_X, FAN_Y, FAN_R);
    cage.fillStyle(0x3d3733, 1);
    cage.fillCircle(FAN_X, FAN_Y, FAN_R - 20);
    this.blades = this.gfx();
    this.blades.setPosition(FAN_X, FAN_Y);
    this.blades.fillStyle(C.greyDark, 1);
    this.blades.lineStyle(3, C.charcoal, 1);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const pts = [
        new Phaser.Geom.Point(0, 0),
        new Phaser.Geom.Point(Math.cos(a - 0.35) * (FAN_R - 30), Math.sin(a - 0.35) * (FAN_R - 30)),
        new Phaser.Geom.Point(Math.cos(a + 0.35) * (FAN_R - 30), Math.sin(a + 0.35) * (FAN_R - 30)),
      ];
      this.blades.fillPoints(pts, true);
      this.blades.strokePoints(pts, true, true);
    }
    this.blades.fillStyle(C.tomato, 1);
    this.blades.fillCircle(0, 0, 20);
    const grill = this.gfx();
    grill.lineStyle(3, C.charcoal, 0.7);
    for (let r = 30; r < FAN_R - 10; r += 26) grill.strokeCircle(FAN_X, FAN_Y, r);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      grill.lineBetween(FAN_X, FAN_Y, FAN_X + Math.cos(a) * (FAN_R - 10), FAN_Y + Math.sin(a) * (FAN_R - 10));
    }
    const warn = this.text(FAN_X, FAN_Y - FAN_R - 22, 'DANGER  •  OBVIOUSLY', { size: 16, color: C.tomato, strokeWidth: 0, shadow: false });
    warn.setAlpha(0.9);

    // wind lines
    const windG = this.gfx();
    windG.lineStyle(4, C.white, 0.7);
    for (let i = 0; i < 5; i++) windG.lineBetween(560 + i * 40, 200 + i * 70, 640 + i * 60, 200 + i * 70);
    this.tween({ targets: windG, x: 200, alpha: 0, duration: 700, repeat: -1 });

    // Mort at desk
    this.mort = this.critter('mort', 380, 400, 0.9);
    this.mort.look(1, 0);
    this.mort.setMood('focus');

    // scarf tip (grabbable)
    this.scarfG = this.gfx();
    this.tip = this.scene.add.container(this.tx, this.ty);
    const tg = this.scene.add.graphics();
    tg.fillStyle(C.tomato, 1);
    tg.lineStyle(4, C.charcoal, 1);
    tg.fillRoundedRect(-30, -22, 60, 44, 10);
    tg.strokeRoundedRect(-30, -22, 60, 44, 10);
    tg.fillStyle(C.mustard, 1);
    tg.fillRect(-18, -22, 10, 44);
    tg.fillRect(4, -22, 10, 44);
    // fringe
    tg.lineStyle(4, C.charcoal, 1);
    for (let i = -20; i <= 20; i += 10) tg.lineBetween(i, 22, i - 4, 40);
    this.tip.add(tg);
    this.tip.setInteractive(new Phaser.Geom.Rectangle(-60, -60, 120, 120), Phaser.Geom.Rectangle.Contains);
    this.root.add(this.tip);
    const ring = this.gfx();
    ring.lineStyle(3, C.charcoal, 0.3);
    ring.strokeCircle(0, 0, 54);
    this.tip.add(ring);
    this.tween({ targets: ring, scale: 1.15, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });

    this.wind = this.lerpD(60, 125);
    this.gusty = this.d > 0.4;
    // flying papers (distraction) at higher difficulty
    if (this.d > 0.5) {
      for (let i = 0; i < 5; i++) {
        const p = this.gfx();
        p.fillStyle(C.white, 1);
        p.lineStyle(2, C.charcoal, 1);
        p.fillRect(-14, -18, 28, 36);
        p.strokeRect(-14, -18, 28, 36);
        p.setPosition(Phaser.Math.Between(200, 700), Phaser.Math.Between(120, 560));
        this.papers.push(p);
      }
    }
    this.drawScarf();
  }

  begin() {
    super.begin();
    this.input.draggable(this.tip, {
      onStart: () => {
        this.dragging = true;
        audio.sfx('tap', 0.7);
      },
      onDrag: (x, y) => {
        this.tx = x;
        this.ty = y;
      },
      onDrop: () => {
        this.dragging = false;
      },
    });
  }

  update(_t: number, delta: number) {
    if (!this.started || this.done) return;
    const dt = delta / 1000;
    this.time += dt;
    this.blades.angle += 900 * dt;
    if (!this.dragging) {
      const ax = this.input.axisX();
      const ay = this.input.axisY();
      if (ax || ay) {
        this.tx += ax * 420 * dt;
        this.ty += ay * 420 * dt;
      }
      // wind pulls the tip towards the fan
      let w = this.wind;
      if (this.gusty) w *= 0.7 + 0.7 * Math.max(0, Math.sin(this.time * 3.1));
      const dirX = FAN_X - this.tx;
      const dirY = FAN_Y - this.ty;
      const len = Math.hypot(dirX, dirY) || 1;
      this.tx += (dirX / len) * w * dt;
      this.ty += (dirY / len) * w * dt * 0.6 + Math.sin(this.time * 9) * 30 * dt;
    }
    this.tx = Phaser.Math.Clamp(this.tx, 300, W - 40);
    this.ty = Phaser.Math.Clamp(this.ty, 80, FLOOR - 30);
    this.tip.setPosition(this.tx, this.ty);
    this.tip.setAngle(Math.sin(this.time * 12) * 6);
    // papers drift
    for (const p of this.papers) {
      p.x += (FAN_X - p.x) * 0.6 * dt + 40 * dt;
      p.y += Math.sin(this.time * 4 + p.x) * 60 * dt;
      p.angle += 240 * dt;
      if (p.x > FAN_X - 40) {
        p.x = Phaser.Math.Between(150, 400);
        p.y = Phaser.Math.Between(120, 560);
      }
    }
    this.drawScarf();
    // Mort is being pulled too
    const stretch = Phaser.Math.Clamp((this.tx - 700) / 400, 0, 1);
    this.mort.inner.setScale(1 + stretch * 0.25, 1 - stretch * 0.1);
    this.mort.setMood(stretch > 0.5 ? 'scared' : 'focus');
    // outcome
    const distFan = Math.hypot(this.tx - FAN_X, this.ty - FAN_Y);
    if (distFan < FAN_R - 10) {
      this.lose();
      return;
    }
    if (this.tx < SAFE_X && this.ty > 250 && this.ty < 440) this.win();
  }

  private drawScarf() {
    const g = this.scarfG;
    g.clear();
    const sag = 40 + Math.sin(this.time * 7) * 10;
    const cx = (NECK.x + this.tx) / 2;
    const cy = (NECK.y + this.ty) / 2 + sag;
    g.lineStyle(26, C.charcoal, 1);
    g.beginPath();
    g.moveTo(NECK.x, NECK.y);
    g.lineTo(cx, cy);
    g.lineTo(this.tx, this.ty);
    g.strokePath();
    g.lineStyle(18, C.tomato, 1);
    g.beginPath();
    g.moveTo(NECK.x, NECK.y);
    g.lineTo(cx, cy);
    g.lineTo(this.tx, this.ty);
    g.strokePath();
    g.lineStyle(6, C.mustard, 1);
    g.beginPath();
    g.moveTo(NECK.x, NECK.y);
    g.lineTo(cx, cy);
    g.lineTo(this.tx, this.ty);
    g.strokePath();
  }

  onWin(): number {
    audio.sfx('success');
    audio.vocal('happy', 0.7);
    this.tween({ targets: this.tip, x: NECK.x + 20, y: NECK.y + 20, scale: 0.6, duration: 200, ease: 'Quad.easeIn' });
    this.mort.inner.setScale(1);
    this.mort.celebrate();
    this.after(200, () => {
      this.scarfG.clear();
      this.caption('TUCKED!', C.mint);
    });
    return 1000;
  }

  onLose(): number {
    audio.sfx('zap', 0.5);
    audio.sfx('aah', 0.7);
    this.mort.stopIdle();
    this.mort.setMood('scream');
    this.dragging = false;
    // the scarf goes first, then Mort is yanked across the room, spins through the fan and out
    this.tween({ targets: this.tip, x: FAN_X, y: FAN_Y, scale: 0.2, duration: 150 });
    this.tween({ targets: this.mort.inner, scaleX: 1.9, scaleY: 0.7, duration: 250 });
    this.after(260, () => {
      audio.sfx('whoosh');
      this.tween({
        targets: this.mort,
        x: FAN_X - 40,
        y: FAN_Y,
        angle: 720,
        scale: 0.4,
        duration: 380,
        ease: 'Quad.easeIn',
        onComplete: () => {
          audio.sfx('hit');
          audio.sfx('spin');
          this.scene.shakeCam(0.012, 250);
          this.scarfG.clear();
          puff(this.scene, this.root, FAN_X, FAN_Y, 8, C.white, 20);
          for (const p of this.papers) this.tween({ targets: p, y: -100, duration: 400 });
          this.tween({ targets: this.mort, x: W + 300, y: -300, angle: 2000, duration: 600, ease: 'Quad.easeIn' });
          // fan sputters
          this.tween({ targets: this.blades, angle: this.blades.angle + 200, duration: 800, ease: 'Quad.easeOut' });
          this.after(300, () => this.caption('AIR MAIL.', C.tomato));
        },
      });
    });
    return 1700;
  }
}

