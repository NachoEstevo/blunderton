import Phaser from 'phaser';
import { Microgame, W, H, type MicrogameMeta } from '../Microgame';
import { C } from '../../core/Palette';
import { drawSky, drawCloud, puff, dizzyStars } from '../../entities/Props';
import { audio } from '../../core/Audio';
import type { Critter } from '../../entities/Critter';

export const UmbrellaMeta: MicrogameMeta = {
  id: 'umbrella',
  name: 'Umbrella Emergency',
  instruction: 'CRANK!',
  mechanic: 'Alternate left / right',
  group: 'tap',
  baseDuration: 6000,
  timeoutWins: false,
  character: 'mort',
  accident: { name: 'Accordioned', desc: 'Flattened by a tiny piano.' },
};

const FLOOR = 600;
const MX = 640;
const IMPACT_Y = 395; // piano bottom at impact

export class UmbrellaEmergency extends Microgame {
  meta = UmbrellaMeta;
  private mort!: Critter;
  private piano!: Phaser.GameObjects.Container;
  private shadow!: Phaser.GameObjects.Graphics;
  private canopy!: Phaser.GameObjects.Graphics;
  private opened = 0;
  private needed = 8;
  private lastSide: 'left' | 'right' | null = null;
  private padL!: Phaser.GameObjects.Graphics;
  private padR!: Phaser.GameObjects.Graphics;
  private hintL!: Phaser.GameObjects.Text;
  private hintR!: Phaser.GameObjects.Text;

  build() {
    const g = this.gfx();
    drawSky(g, C.skyLight, FLOOR);
    drawCloud(g, 220, 140, 1);
    drawCloud(g, 1000, 200, 0.8);
    g.fillStyle(C.creamDark, 1);
    g.fillRect(0, FLOOR, W, H - FLOOR);
    g.lineStyle(5, C.charcoal, 1);
    g.lineBetween(0, FLOOR, W, FLOOR);
    // sidewalk cracks
    g.lineStyle(3, C.charcoal, 0.3);
    for (let x = 80; x < W; x += 160) g.lineBetween(x, FLOOR, x + 20, H);

    this.shadow = this.gfx();
    this.mort = this.critter('mort', MX, FLOOR - 62, 1);
    this.mort.look(0, -1);
    this.mort.setMood('focus');

    // umbrella pole + canopy (drawn by opened fraction)
    const pole = this.gfx();
    pole.lineStyle(6, C.charcoal, 1);
    pole.lineBetween(MX + 30, FLOOR - 80, MX + 30, FLOOR - 200);
    this.canopy = this.gfx();
    this.drawCanopy();

    // the tiny piano of doom
    this.piano = this.scene.add.container(MX, -120);
    const p = this.scene.add.graphics();
    p.fillStyle(C.charcoal, 1);
    p.fillRoundedRect(-70, -60, 140, 70, 10);
    p.fillStyle(0x3d3733, 1);
    p.fillRoundedRect(-64, -54, 128, 50, 8);
    p.fillStyle(C.white, 1);
    p.fillRect(-60, -18, 120, 20);
    p.fillStyle(C.charcoal, 1);
    for (let i = 0; i < 9; i++) p.fillRect(-56 + i * 13, -18, 6, 12);
    p.fillRect(-64, -4, 128, 6);
    // legs
    p.fillRect(-58, 2, 8, 16);
    p.fillRect(50, 2, 8, 16);
    p.lineStyle(3, C.charcoal, 1);
    p.strokeRoundedRect(-70, -60, 140, 70, 10);
    this.piano.add(p);
    const weight = this.scene.add.text(0, -30, '2 TONS', { fontFamily: '"Trebuchet MS", sans-serif', fontSize: '16px', color: '#fff8e8', fontStyle: 'bold' }).setOrigin(0.5);
    this.piano.add(weight);
    this.root.add(this.piano);

    // pads
    this.padL = this.gfx();
    this.padR = this.gfx();
    this.hintL = this.text(180, 560, 'LEFT', { size: 40, color: C.charcoal, strokeWidth: 0, shadow: false });
    this.hintR = this.text(W - 180, 560, 'RIGHT', { size: 40, color: C.charcoal, strokeWidth: 0, shadow: false });
    this.needed = Math.round(this.lerpD(7, 12));
    this.drawPads();
  }

  private drawPads() {
    const next = this.lastSide === 'left' ? 'right' : this.lastSide === 'right' ? 'left' : null;
    for (const [g, side, x] of [
      [this.padL, 'left', 180],
      [this.padR, 'right', W - 180],
    ] as Array<[Phaser.GameObjects.Graphics, 'left' | 'right', number]>) {
      g.clear();
      const active = next === null || next === side;
      g.fillStyle(active ? C.mustard : C.charcoal, active ? 0.9 : 0.08);
      g.lineStyle(4, C.charcoal, active ? 1 : 0.2);
      g.fillRoundedRect(x - 130, 480, 260, 160, 26);
      g.strokeRoundedRect(x - 130, 480, 260, 160, 26);
    }
    this.hintL.setAlpha(next === null || next === 'left' ? 1 : 0.25);
    this.hintR.setAlpha(next === null || next === 'right' ? 1 : 0.25);
  }

  private drawCanopy() {
    const g = this.canopy;
    const f = this.opened / this.needed;
    g.clear();
    const cx = MX + 30;
    const cy = FLOOR - 200;
    const spread = 20 + f * 130;
    const sag = 10 + f * 50;
    g.fillStyle(C.tomato, 1);
    g.lineStyle(4, C.charcoal, 1);
    g.beginPath();
    g.moveTo(cx - spread, cy + sag);
    g.lineTo(cx, cy - 20 - f * 20);
    g.lineTo(cx + spread, cy + sag);
    // scalloped bottom
    const n = 4;
    for (let i = n; i >= 0; i--) {
      const x = cx - spread + ((i) / n) * spread * 2;
      g.lineTo(x, cy + sag + (i % 2 === 0 ? 0 : 10 * f));
    }
    g.closePath();
    g.fillPath();
    g.strokePath();
    g.fillStyle(C.mustard, 1);
    if (f > 0.2) g.fillTriangle(cx - spread * 0.5, cy + sag, cx, cy - 20 - f * 20, cx - spread * 0.1, cy + sag);
    g.fillStyle(C.charcoal, 1);
    g.fillCircle(cx, cy - 22 - f * 20, 5);
  }

  begin() {
    super.begin();
    this.input.onSide((side) => this.crank(side));
  }

  private crank(side: 'left' | 'right') {
    if (this.done) return;
    if (side === this.lastSide) {
      audio.sfx('tick', 0.6);
      this.mort.squash(1.05, 0.95, 60);
      return;
    }
    this.lastSide = side;
    this.opened = Math.min(this.needed, this.opened + 1);
    audio.sfx('tap', 0.8 + (this.opened / this.needed) * 0.8);
    this.mort.squash(1.12, 0.9, 70);
    this.mort.inner.setX(side === 'left' ? -6 : 6);
    this.drawCanopy();
    this.drawPads();
    if (this.opened >= this.needed) this.win();
  }

  update() {
    if (!this.started || this.done) return;
    const f = 1 - this.scene.remainingFrac();
    const y = Phaser.Math.Linear(-120, IMPACT_Y - 60, Math.pow(f, 1.15));
    this.piano.setPosition(MX, y);
    this.piano.setAngle(Math.sin(f * 20) * 4);
    this.shadow.clear();
    this.shadow.fillStyle(C.charcoal, 0.25 * f + 0.05);
    this.shadow.fillEllipse(MX, FLOOR - 2, 60 + f * 130, 14 + f * 18);
    if (f > 0.6) this.mort.setMood('scared');
  }

  onWin(): number {
    this.mort.setMood('smug');
    // piano completes its fall onto the canopy, bounces off
    const startY = this.piano.y;
    this.tween({
      targets: this.piano,
      y: IMPACT_Y - 110,
      duration: Math.max(120, (IMPACT_Y - 110 - startY) * 0.9),
      ease: 'Quad.easeIn',
      onComplete: () => {
        audio.sfx('boing');
        audio.sfx('piano', 1.6);
        this.scene.shakeCam(0.004, 120);
        this.tween({ targets: this.canopy, scaleY: 0.75, y: 30, duration: 90, yoyo: true });
        this.tween({ targets: this.piano, x: W + 200, y: -300, angle: 540, duration: 700, ease: 'Quad.easeOut' });
        this.after(200, () => {
          this.mort.celebrate();
          this.caption('BOING!', C.mustard);
          audio.vocal('happy', 0.7);
        });
      },
    });
    return 1200;
  }

  onLose(): number {
    // last beat: piano lands
    this.tween({
      targets: this.piano,
      y: IMPACT_Y - 30,
      duration: 90,
      ease: 'Quad.easeIn',
      onComplete: () => {
        audio.sfx('piano');
        audio.sfx('slam');
        this.scene.shakeCam(0.02, 350);
        this.mort.flatten(90);
        this.canopy.setVisible(false);
        puff(this.scene, this.root, MX, FLOOR - 10, 10, C.creamDark, 24);
        this.tween({ targets: this.piano, y: FLOOR - 40, duration: 100, ease: 'Bounce.easeOut' });
        this.after(350, () => {
          dizzyStars(this.scene, this.root, MX, FLOOR - 110, 1200);
          this.caption('FLAT.', C.tomato);
          audio.sfx('oh', 0.7);
        });
      },
    });
    return 1600;
  }
}
