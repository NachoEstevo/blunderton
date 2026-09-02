import Phaser from 'phaser';
import { Microgame, W, type MicrogameMeta } from '../Microgame';
import { C } from '../../core/Palette';
import { drawRoom, confetti, puff } from '../../entities/Props';
import { audio } from '../../core/Audio';
import type { Critter, HairStyle } from '../../entities/Critter';

export const HaircutMeta: MicrogameMeta = {
  id: 'haircut',
  name: 'Bad Haircut',
  instruction: 'STOP!',
  mechanic: 'Timing',
  group: 'timing',
  baseDuration: 6000,
  timeoutWins: false,
  character: 'zizz',
  accident: { name: 'Bad Hair Day', desc: 'The machine had other plans.' },
};

const FLOOR = 610;
const GX = 340;
const GW = 600;
const GY = 150;

interface Zone {
  from: number;
  to: number;
  fake: boolean;
}

export class BadHaircut extends Microgame {
  meta = HaircutMeta;
  private zizz!: Critter;
  private needle!: Phaser.GameObjects.Graphics;
  private gaugeG!: Phaser.GameObjects.Graphics;
  private arm!: Phaser.GameObjects.Container;
  private pos = 0; // 0..1 along gauge
  private dir = 1;
  private speed = 0.9; // gauge widths per second
  private zones: Zone[] = [];
  private stopped = false;

  build() {
    const g = this.gfx();
    drawRoom(g, 0xf7e4ea, 0xc9c1b8, FLOOR);
    // mirror
    g.fillStyle(C.skyLight, 1);
    g.lineStyle(6, C.charcoal, 1);
    g.fillRoundedRect(940, 260, 240, 300, 24);
    g.strokeRoundedRect(940, 260, 240, 300, 24);
    g.fillStyle(C.white, 0.5);
    g.fillRoundedRect(960, 280, 30, 200, 10);
    // barber pole
    g.fillStyle(C.white, 1);
    g.fillRoundedRect(120, 300, 40, 260, 14);
    g.strokeRoundedRect(120, 300, 40, 260, 14);
    g.fillStyle(C.tomato, 1);
    for (let y = 310; y < 540; y += 40) g.fillRect(124, y, 32, 14);
    g.fillStyle(C.sky, 1);
    for (let y = 330; y < 550; y += 40) g.fillRect(124, y, 32, 8);
    // chair
    g.fillStyle(C.tomato, 1);
    g.fillRoundedRect(540, 430, 200, 40, 10);
    g.strokeRoundedRect(540, 430, 200, 40, 10);
    g.fillStyle(C.charcoal, 1);
    g.fillRect(630, 470, 20, FLOOR - 470);
    g.fillRoundedRect(590, FLOOR - 16, 100, 16, 6);

    this.zizz = this.critter('zizz', 640, 430 - 40, 1.05);
    this.zizz.setMood('focus');
    this.zizz.look(0, -1);

    // machine arm with clippers above head, hanging from a rail on the right
    const rail = this.gfx();
    rail.fillStyle(C.charcoal, 1);
    rail.fillRect(600, 232, W - 600, 12);
    this.arm = this.scene.add.container(640, 250);
    const ag = this.scene.add.graphics();
    ag.fillStyle(C.charcoal, 1);
    ag.fillRect(-8, -20, 16, 20);
    ag.fillStyle(C.greyDark, 1);
    ag.lineStyle(4, C.charcoal, 1);
    ag.fillRoundedRect(-40, 0, 80, 60, 10);
    ag.strokeRoundedRect(-40, 0, 80, 60, 10);
    ag.fillStyle(C.charcoal, 1);
    for (let i = -30; i <= 30; i += 12) ag.fillRect(i - 3, 58, 6, 14);
    ag.fillStyle(C.tomato, 1);
    ag.fillCircle(0, 30, 10);
    this.arm.add(ag);
    this.root.add(this.arm);
    this.tween({ targets: this.arm, x: { from: 600, to: 680 }, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // gauge
    this.gaugeG = this.gfx();
    this.needle = this.gfx();
    this.text(640, GY - 40, 'AUTO-BARBER 3000', { size: 20, color: C.charcoal, strokeWidth: 0, shadow: false }).setAlpha(0.6);

    const zw = this.lerpD(0.2, 0.11);
    const center = Phaser.Math.FloatBetween(0.2 + zw, 0.8 - zw);
    this.zones.push({ from: center - zw / 2, to: center + zw / 2, fake: false });
    if (this.d > 0.5) {
      // fake zones with a red stripe: same color, a tell for the attentive
      const nFake = this.d > 0.8 ? 2 : 1;
      for (let i = 0; i < nFake && i < 4; i++) {
        let c = 0;
        let tries = 0;
        do {
          c = Phaser.Math.FloatBetween(0.1 + zw, 0.9 - zw);
          tries++;
        } while (tries < 20 && this.zones.some((z) => Math.abs(z.from + (z.to - z.from) / 2 - c) < zw * 1.6));
        if (tries < 20) this.zones.push({ from: c - zw / 2, to: c + zw / 2, fake: true });
      }
    }
    this.speed = this.lerpD(0.85, 1.9);
    this.pos = Math.random();
    this.drawGauge();
    this.drawNeedle();
  }

  private drawGauge() {
    const g = this.gaugeG;
    g.clear();
    g.fillStyle(C.charcoal, 1);
    g.fillRoundedRect(GX - 6, GY - 6 + 6, GW + 12, 56, 14);
    g.fillStyle(C.paper, 1);
    g.lineStyle(5, C.charcoal, 1);
    g.fillRoundedRect(GX, GY, GW, 50, 12);
    g.strokeRoundedRect(GX, GY, GW, 50, 12);
    for (const z of this.zones) {
      g.fillStyle(C.mint, 1);
      g.fillRect(GX + z.from * GW, GY + 4, (z.to - z.from) * GW, 42);
      if (z.fake) {
        g.fillStyle(C.tomato, 1);
        const x = GX + z.from * GW;
        const w = (z.to - z.from) * GW;
        g.fillTriangle(x, GY + 46, x + w, GY + 4, x + w, GY + 12);
        g.fillTriangle(x, GY + 46, x, GY + 38, x + w, GY + 4);
      } else {
        // scissors icon
        g.lineStyle(3, C.charcoal, 1);
        const cx = GX + ((z.from + z.to) / 2) * GW;
        g.strokeCircle(cx - 6, GY + 36, 5);
        g.strokeCircle(cx + 6, GY + 36, 5);
        g.lineBetween(cx - 4, GY + 32, cx + 8, GY + 12);
        g.lineBetween(cx + 4, GY + 32, cx - 8, GY + 12);
      }
    }
    g.lineStyle(2, C.charcoal, 0.3);
    for (let i = 1; i < 10; i++) g.lineBetween(GX + (i / 10) * GW, GY + 40, GX + (i / 10) * GW, GY + 50);
  }

  private drawNeedle() {
    const g = this.needle;
    g.clear();
    const x = GX + this.pos * GW;
    g.fillStyle(C.tomato, 1);
    g.lineStyle(3, C.charcoal, 1);
    g.fillTriangle(x - 14, GY - 22, x + 14, GY - 22, x, GY + 2);
    g.strokeTriangle(x - 14, GY - 22, x + 14, GY - 22, x, GY + 2);
    g.fillRect(x - 2, GY, 4, 50);
    g.fillTriangle(x - 14, GY + 72, x + 14, GY + 72, x, GY + 48);
    g.strokeTriangle(x - 14, GY + 72, x + 14, GY + 72, x, GY + 48);
  }

  begin() {
    super.begin();
    this.input.onAction(() => this.stop());
  }

  update(_t: number, delta: number) {
    if (!this.started || this.done || this.stopped) return;
    const dt = delta / 1000;
    this.pos += this.dir * this.speed * dt;
    if (this.pos > 1) {
      this.pos = 2 - this.pos;
      this.dir = -1;
    } else if (this.pos < 0) {
      this.pos = -this.pos;
      this.dir = 1;
    }
    this.drawNeedle();
  }

  private stop() {
    if (this.done || this.stopped) return;
    this.stopped = true;
    this.scene.tweens.killTweensOf(this.arm);
    audio.sfx('tap');
    // a hair of lenience on the real zone edges: feels fair, still demands timing
    const grace = 0.012;
    const z = this.zones.find((zz) => this.pos >= zz.from - (zz.fake ? 0 : grace) && this.pos <= zz.to + (zz.fake ? 0 : grace));
    if (z && !z.fake) this.win();
    else this.lose();
  }

  onWin(): number {
    audio.sfx('buzz');
    this.tween({ targets: this.arm, y: 310, duration: 200, ease: 'Quad.easeIn' });
    this.after(200, () => {
      for (let i = 0; i < 3; i++) this.after(i * 130, () => audio.sfx('snip', 1 + i * 0.1));
      this.zizz.shake(3, 350);
    });
    this.after(600, () => {
      this.zizz.setHair('neat');
      this.tween({ targets: this.arm, y: 250, duration: 200 });
      audio.sfx('ding');
      audio.vocal('happy', 1.4);
      confetti(this.scene, this.root, 640, 320, [C.white, C.mint, C.sky], 12, 180);
      this.zizz.setMood('smug');
      this.caption('FRESH!', C.mint);
    });
    return 1200;
  }

  onLose(): number {
    audio.sfx('buzz', 0.7);
    this.tween({ targets: this.arm, y: 320, duration: 160, ease: 'Quad.easeIn' });
    this.after(160, () => {
      audio.sfx('zap', 0.6);
      this.zizz.shake(8, 400);
      puff(this.scene, this.root, 640, 330, 8, C.tomatoDark, 12);
      for (let i = 0; i < 5; i++) this.after(i * 80, () => audio.sfx('snip', 0.7 + Math.random() * 0.6));
    });
    this.after(650, () => {
      const styles: HairStyle[] = ['bald', 'mohawk', 'half', 'stripe', 'poof'];
      this.zizz.setHair(styles[Phaser.Math.Between(0, styles.length - 1)]);
      this.tween({ targets: this.arm, y: 250, duration: 200 });
      this.zizz.setMood('surprised');
      this.zizz.look(1, 0);
    });
    // beat: looks at the mirror... screams
    this.after(1150, () => {
      this.zizz.setMood('scream');
      audio.sfx('aah', 1.3);
      this.zizz.drawArms(1);
      this.tween({ targets: this.zizz.inner, y: -20, duration: 90, yoyo: true, repeat: 3 });
      this.caption('OH NO.', C.tomato);
    });
    return 1900;
  }
}

