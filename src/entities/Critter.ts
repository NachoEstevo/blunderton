import Phaser from 'phaser';
import { C, darken, lighten } from '../core/Palette';
import type { CharacterDef } from './Characters';

export type Mood = 'idle' | 'happy' | 'scared' | 'dead' | 'hurt' | 'surprised' | 'smug' | 'dizzy' | 'sad' | 'focus' | 'scream';

interface MoodSpec {
  eye: number; // eye scale
  pupil: number;
  brow: number; // >0 worried (inner up), <0 angry/confident (inner down)
  mouth: 'smile' | 'grin' | 'o' | 'flat' | 'wavy' | 'frown' | 'smirk' | 'big';
  x?: boolean; // X eyes
  spiral?: boolean;
}

const MOODS: Record<Mood, MoodSpec> = {
  idle: { eye: 1, pupil: 1, brow: 0, mouth: 'smile' },
  happy: { eye: 1, pupil: 1.1, brow: -0.2, mouth: 'grin' },
  scared: { eye: 1.35, pupil: 0.5, brow: 0.6, mouth: 'o' },
  surprised: { eye: 1.3, pupil: 0.8, brow: -0.5, mouth: 'o' },
  dead: { eye: 1, pupil: 0, brow: 0, mouth: 'flat', x: true },
  hurt: { eye: 0.6, pupil: 1, brow: 0.7, mouth: 'wavy' },
  dizzy: { eye: 1.1, pupil: 0.6, brow: 0.2, mouth: 'wavy', spiral: true },
  smug: { eye: 0.7, pupil: 1, brow: -0.4, mouth: 'smirk' },
  sad: { eye: 1, pupil: 1, brow: 0.5, mouth: 'frown' },
  focus: { eye: 0.85, pupil: 0.9, brow: 0.3, mouth: 'flat' },
  scream: { eye: 1.4, pupil: 0.4, brow: 0.7, mouth: 'big' },
};

const GEOM: Record<CharacterDef['shape'], { w: number; h: number }> = {
  wide: { w: 130, h: 84 },
  tall: { w: 60, h: 140 },
  tri: { w: 120, h: 104 },
  round: { w: 104, h: 104 },
  small: { w: 66, h: 64 },
  fluff: { w: 100, h: 100 },
  box: { w: 86, h: 104 },
  noodle: { w: 58, h: 76 },
  toaster: { w: 106, h: 74 },
  chef: { w: 116, h: 96 },
};

export type HairStyle = 'default' | 'neat' | 'mohawk' | 'bald' | 'half' | 'stripe' | 'poof';

/**
 * A Blunderton resident. Drawn from primitives; animated through `inner` so that
 * external scale (character size) and internal squash/stretch never fight.
 */
export class Critter extends Phaser.GameObjects.Container {
  def: CharacterDef;
  inner: Phaser.GameObjects.Container;
  bodyG: Phaser.GameObjects.Graphics;
  hairG: Phaser.GameObjects.Graphics;
  faceG: Phaser.GameObjects.Graphics;
  eyeL: Phaser.GameObjects.Container;
  eyeR: Phaser.GameObjects.Container;
  armL: Phaser.GameObjects.Graphics;
  armR: Phaser.GameObjects.Graphics;
  feetG: Phaser.GameObjects.Graphics;
  bw: number;
  bh: number;
  mood: Mood = 'idle';
  hairStyle: HairStyle = 'default';
  private lookX = 0;
  private lookY = 0;
  private eyeR_: number;
  private blinkEvt?: Phaser.Time.TimerEvent;
  private idleTw: Phaser.Tweens.Tween[] = [];
  private jitterTw?: Phaser.Tweens.Tween;
  private sooty = false;
  private colorOverride?: number;
  /** y of the feet bottom in local space */
  get footY() {
    return this.bh / 2 + 10;
  }

  constructor(scene: Phaser.Scene, x: number, y: number, def: CharacterDef, size = 1) {
    super(scene, x, y);
    this.def = def;
    const g = GEOM[def.shape];
    this.bw = g.w;
    this.bh = g.h;
    this.eyeR_ = Phaser.Math.Clamp(this.bw * 0.1, 8, 13);

    this.inner = scene.add.container(0, 0);
    this.feetG = scene.add.graphics();
    this.armL = scene.add.graphics();
    this.armR = scene.add.graphics();
    this.bodyG = scene.add.graphics();
    this.hairG = scene.add.graphics();
    this.faceG = scene.add.graphics();
    this.eyeL = this.makeEye();
    this.eyeR = this.makeEye();
    this.inner.add([this.feetG, this.armL, this.armR, this.bodyG, this.hairG, this.faceG, this.eyeL, this.eyeR]);
    this.add(this.inner);
    this.setScale(size);
    this.drawAll();
    scene.add.existing(this);
    if (def.alwaysHappy) this.setMood('happy');
  }

  // ---------------------------------------------------------------- drawing
  private get faceY() {
    return -this.bh * (this.def.shape === 'tri' ? 0.02 : 0.14);
  }
  private get eyeSpread() {
    return Math.max(13, this.bw * 0.17);
  }

  private makeEye() {
    const c = this.scene.add.container(0, 0);
    const white = this.scene.add.graphics();
    const pupil = this.scene.add.graphics();
    c.add([white, pupil]);
    return c;
  }

  private bodyColor() {
    if (this.sooty) return C.charcoal;
    return this.colorOverride ?? this.def.color;
  }

  drawAll() {
    this.drawBody();
    this.drawHair();
    this.drawArms(0);
    this.drawFeet();
    this.drawFace();
  }

  private drawBody() {
    const g = this.bodyG;
    const { bw, bh } = this;
    const col = this.bodyColor();
    const d = this.def;
    g.clear();
    g.lineStyle(4, C.charcoal, 1);
    g.fillStyle(col, 1);
    switch (d.shape) {
      case 'wide':
        g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 34);
        g.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 34);
        break;
      case 'tall':
        g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 28);
        g.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 28);
        break;
      case 'tri': {
        const pts = [
          new Phaser.Geom.Point(0, -bh / 2),
          new Phaser.Geom.Point(bw / 2, bh / 2),
          new Phaser.Geom.Point(-bw / 2, bh / 2),
        ];
        g.fillPoints(pts, true);
        g.strokePoints(pts, true, true);
        g.fillStyle(col, 1);
        g.fillCircle(0, -bh / 2 + 2, 10);
        g.strokeCircle(0, -bh / 2 + 2, 10);
        if (d.bandana) {
          g.fillStyle(d.accent, 1);
          g.fillRect(-bw / 2 + 22, bh / 2 - 26, bw - 44, 12);
          g.fillTriangle(bw / 2 - 30, bh / 2 - 14, bw / 2 - 12, bh / 2 - 14, bw / 2 - 10, bh / 2 + 4);
        }
        break;
      }
      case 'round':
        g.fillCircle(0, 0, bw / 2);
        g.strokeCircle(0, 0, bw / 2);
        break;
      case 'small':
        g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 22);
        g.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 22);
        break;
      case 'fluff': {
        const r = bw / 2;
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          g.fillCircle(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78, r * 0.34);
          g.strokeCircle(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78, r * 0.34);
        }
        g.fillCircle(0, 0, r * 0.82);
        break;
      }
      case 'box':
        g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 10);
        g.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 10);
        if (d.tie) {
          g.fillStyle(d.accent, 1);
          g.fillTriangle(-8, 8, 8, 8, 0, 18);
          g.fillTriangle(-9, 18, 9, 18, 0, bh / 2 - 6);
          g.strokeTriangle(-9, 18, 9, 18, 0, bh / 2 - 6);
        }
        break;
      case 'noodle':
        g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 24);
        g.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 24);
        break;
      case 'toaster': {
        g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 18);
        g.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 18);
        g.fillStyle(C.charcoal, 1);
        g.fillRoundedRect(-bw / 2 + 14, -bh / 2 - 4, bw / 2 - 20, 10, 4);
        g.fillRoundedRect(6, -bh / 2 - 4, bw / 2 - 20, 10, 4);
        // lever
        g.fillStyle(d.accent, 1);
        g.fillRoundedRect(bw / 2 - 2, -bh / 2 + 16, 14, 10, 4);
        g.strokeRoundedRect(bw / 2 - 2, -bh / 2 + 16, 14, 10, 4);
        g.fillStyle(lighten(col, 0.4), 1);
        g.fillRoundedRect(-bw / 2 + 8, -bh / 2 + 12, 10, bh - 24, 4);
        break;
      }
      case 'chef':
        g.fillEllipse(0, 0, bw, bh);
        g.strokeEllipse(0, 0, bw, bh);
        g.fillStyle(C.white, 1);
        g.fillRoundedRect(-bw * 0.24, 4, bw * 0.48, bh / 2 - 8, 10);
        g.strokeRoundedRect(-bw * 0.24, 4, bw * 0.48, bh / 2 - 8, 10);
        g.fillStyle(C.charcoal, 1);
        g.fillCircle(-8, 20, 3);
        g.fillCircle(8, 20, 3);
        g.fillCircle(-8, 34, 3);
        g.fillCircle(8, 34, 3);
        break;
    }
    // hats
    g.lineStyle(4, C.charcoal, 1);
    if (d.hat === 'cap') {
      g.fillStyle(d.accent, 1);
      g.fillRoundedRect(-bw * 0.28, -bh / 2 - 22, bw * 0.56, 26, 12);
      g.strokeRoundedRect(-bw * 0.28, -bh / 2 - 22, bw * 0.56, 26, 12);
      g.fillRoundedRect(-bw * 0.28, -bh / 2 - 8, bw * 0.72, 10, 4);
      g.strokeRoundedRect(-bw * 0.28, -bh / 2 - 8, bw * 0.72, 10, 4);
    } else if (d.hat === 'chef') {
      g.fillStyle(C.white, 1);
      g.fillRoundedRect(-bw * 0.3, -bh / 2 - 26, bw * 0.6, 30, 6);
      g.strokeRoundedRect(-bw * 0.3, -bh / 2 - 26, bw * 0.6, 30, 6);
      g.fillCircle(-bw * 0.22, -bh / 2 - 30, 18);
      g.fillCircle(0, -bh / 2 - 38, 20);
      g.fillCircle(bw * 0.22, -bh / 2 - 30, 18);
      g.strokeCircle(-bw * 0.22, -bh / 2 - 30, 18);
      g.strokeCircle(0, -bh / 2 - 38, 20);
      g.strokeCircle(bw * 0.22, -bh / 2 - 30, 18);
      g.fillStyle(C.white, 1);
      g.fillRect(-bw * 0.3 + 2, -bh / 2 - 26, bw * 0.6 - 4, 12);
    } else if (d.hat === 'goggles') {
      g.fillStyle(d.accent, 1);
      g.fillRect(-bw * 0.36, -bh / 2 + 10, bw * 0.72, 8);
      g.fillStyle(C.grey, 1);
      g.fillCircle(-bw * 0.18, -bh / 2 + 14, 13);
      g.fillCircle(bw * 0.18, -bh / 2 + 14, 13);
      g.strokeCircle(-bw * 0.18, -bh / 2 + 14, 13);
      g.strokeCircle(bw * 0.18, -bh / 2 + 14, 13);
      g.fillStyle(C.white, 0.8);
      g.fillCircle(-bw * 0.18 - 4, -bh / 2 + 10, 4);
      g.fillCircle(bw * 0.18 - 4, -bh / 2 + 10, 4);
    } else if (d.hat === 'crown') {
      g.fillStyle(0xffe066, 1);
      const cy = -bh / 2 - 4;
      const pts = [
        new Phaser.Geom.Point(-30, cy),
        new Phaser.Geom.Point(-30, cy - 28),
        new Phaser.Geom.Point(-15, cy - 12),
        new Phaser.Geom.Point(0, cy - 32),
        new Phaser.Geom.Point(15, cy - 12),
        new Phaser.Geom.Point(30, cy - 28),
        new Phaser.Geom.Point(30, cy),
      ];
      g.fillPoints(pts, true);
      g.strokePoints(pts, true, true);
      g.fillStyle(C.tomato, 1);
      g.fillCircle(0, cy - 12, 5);
    }
    // toaster slot glow / eyebags come from face
  }

  private drawHair() {
    const g = this.hairG;
    const { bw, bh } = this;
    g.clear();
    g.lineStyle(4, C.charcoal, 1);
    const top = -bh / 2;
    const style = this.hairStyle;
    const hairColor = this.def.shape === 'noodle' ? darken(this.def.color, 0.55) : C.charcoal;
    if (this.def.hair === 'tuft' && style === 'default') {
      for (let i = -1; i <= 1; i++) {
        g.lineStyle(5, C.charcoal, 1);
        g.beginPath();
        g.moveTo(i * 8, top + 2);
        g.lineTo(i * 14, top - 22 - Math.abs(i) * -6);
        g.strokePath();
      }
    } else if (this.def.hair === 'spiky' && style === 'default') {
      g.fillStyle(this.def.accent, 1);
      const pts: Phaser.Geom.Point[] = [];
      const n = 5;
      for (let i = 0; i <= n; i++) {
        const x = -bw / 2 + 8 + (i / n) * (bw - 16);
        pts.push(new Phaser.Geom.Point(x, top + 4));
        if (i < n) pts.push(new Phaser.Geom.Point(x + (bw - 16) / n / 2, top - 22 - (i % 2) * 8));
      }
      g.fillPoints(pts, true);
      g.strokePoints(pts, true, true);
    } else if (this.def.hair === 'antenna' && style === 'default') {
      g.lineStyle(4, C.charcoal, 1);
      g.lineBetween(0, top - 2, 12, top - 30);
      g.fillStyle(this.def.accent, 1);
      g.fillCircle(13, top - 34, 8);
      g.strokeCircle(13, top - 34, 8);
    } else if (this.def.hair === 'wild' || style !== 'default') {
      g.fillStyle(hairColor, 1);
      switch (style) {
        case 'default': {
          // a chaotic crown of noodly spikes
          const pts: Phaser.Geom.Point[] = [];
          const n = 9;
          for (let i = 0; i <= n; i++) {
            const x = -bw / 2 - 6 + (i / n) * (bw + 12);
            pts.push(new Phaser.Geom.Point(x, top + 6));
            if (i < n) {
              const spike = 26 + ((i * 7) % 4) * 9;
              pts.push(new Phaser.Geom.Point(x + (bw + 12) / n / 2 + ((i % 2) * 8 - 4), top - spike));
            }
          }
          g.fillPoints(pts, true);
          g.strokePoints(pts, true, true);
          break;
        }
        case 'neat':
          g.fillRoundedRect(-bw / 2 - 2, top - 14, bw + 4, 22, { tl: 16, tr: 16, bl: 0, br: 0 });
          g.strokeRoundedRect(-bw / 2 - 2, top - 14, bw + 4, 22, { tl: 16, tr: 16, bl: 0, br: 0 });
          g.fillStyle(lighten(hairColor, 0.4), 1);
          g.fillEllipse(-bw / 4, top - 6, 14, 6);
          break;
        case 'mohawk': {
          const pts: Phaser.Geom.Point[] = [];
          for (let i = 0; i <= 4; i++) {
            pts.push(new Phaser.Geom.Point(-10 + i * 5, top + 2));
            if (i < 4) pts.push(new Phaser.Geom.Point(-8 + i * 5, top - 60 + Math.abs(i - 2) * 10));
          }
          g.fillStyle(C.mint, 1);
          g.fillPoints(pts, true);
          g.strokePoints(pts, true, true);
          break;
        }
        case 'bald':
          g.fillStyle(lighten(this.bodyColor(), 0.3), 1);
          g.fillEllipse(-bw / 4, top + 6, 14, 6);
          break;
        case 'half': {
          const pts: Phaser.Geom.Point[] = [];
          const n = 4;
          for (let i = 0; i <= n; i++) {
            const x = -bw / 2 - 6 + (i / n) * (bw / 2 + 6);
            pts.push(new Phaser.Geom.Point(x, top + 6));
            if (i < n) pts.push(new Phaser.Geom.Point(x + (bw / 2 + 6) / n / 2, top - 30));
          }
          g.fillPoints(pts, true);
          g.strokePoints(pts, true, true);
          break;
        }
        case 'stripe':
          g.fillRect(-6, top - 24, 12, 30);
          g.strokeRect(-6, top - 24, 12, 30);
          g.fillCircle(0, top - 26, 9);
          g.strokeCircle(0, top - 26, 9);
          break;
        case 'poof':
          g.fillStyle(C.pink, 1);
          g.fillCircle(0, top - 22, 30);
          g.strokeCircle(0, top - 22, 30);
          g.fillCircle(-24, top - 8, 14);
          g.strokeCircle(-24, top - 8, 14);
          g.fillCircle(24, top - 8, 14);
          g.strokeCircle(24, top - 8, 14);
          break;
      }
    }
  }

  drawArms(raise = 0) {
    const { bw, bh } = this;
    const col = this.bodyColor();
    const armY = this.def.shape === 'tri' ? bh * 0.1 : -bh * 0.02;
    for (const [g, side] of [
      [this.armL, -1],
      [this.armR, 1],
    ] as Array<[Phaser.GameObjects.Graphics, number]>) {
      g.clear();
      g.setPosition(side * (bw / 2 - 4), armY);
      g.lineStyle(4, C.charcoal, 1);
      g.fillStyle(col, 1);
      if (this.def.shape === 'noodle') {
        // long noodle arms
        g.lineStyle(14, C.charcoal, 1);
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(side * 26, 34 - raise * 60);
        g.lineTo(side * 18, 80 - raise * 120);
        g.strokePath();
        g.lineStyle(7, col, 1);
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(side * 26, 34 - raise * 60);
        g.lineTo(side * 18, 80 - raise * 120);
        g.strokePath();
        g.fillStyle(col, 1);
        g.fillCircle(side * 18, 80 - raise * 120, 9);
        g.lineStyle(4, C.charcoal, 1);
        g.strokeCircle(side * 18, 80 - raise * 120, 9);
      } else {
        g.fillEllipse(side * 10, 8, 30, 18);
        g.strokeEllipse(side * 10, 8, 30, 18);
      }
      g.setRotation(0);
    }
  }

  private drawFeet() {
    const g = this.feetG;
    const { bw, bh } = this;
    g.clear();
    g.lineStyle(4, C.charcoal, 1);
    g.fillStyle(darken(this.bodyColor(), 0.8), 1);
    const fy = bh / 2 + 2;
    g.fillEllipse(-bw * 0.22, fy, 30, 16);
    g.strokeEllipse(-bw * 0.22, fy, 30, 16);
    g.fillEllipse(bw * 0.22, fy, 30, 16);
    g.strokeEllipse(bw * 0.22, fy, 30, 16);
  }

  drawFace() {
    const spec = MOODS[this.mood];
    const g = this.faceG;
    const fy = this.faceY;
    const er = this.eyeR_;
    const sp = this.eyeSpread;
    g.clear();
    // eyes
    for (const [eye, side] of [
      [this.eyeL, -1],
      [this.eyeR, 1],
    ] as Array<[Phaser.GameObjects.Container, number]>) {
      eye.setPosition(side * sp, fy);
      const white = eye.list[0] as Phaser.GameObjects.Graphics;
      const pupil = eye.list[1] as Phaser.GameObjects.Graphics;
      white.clear();
      pupil.clear();
      const r = er * spec.eye;
      if (spec.x) {
        white.lineStyle(5, C.charcoal, 1);
        white.lineBetween(-r * 0.7, -r * 0.7, r * 0.7, r * 0.7);
        white.lineBetween(r * 0.7, -r * 0.7, -r * 0.7, r * 0.7);
      } else {
        white.fillStyle(C.white, 1);
        white.lineStyle(3, C.charcoal, 1);
        white.fillCircle(0, 0, r);
        white.strokeCircle(0, 0, r);
        if (spec.spiral) {
          pupil.lineStyle(3, C.charcoal, 1);
          pupil.beginPath();
          for (let t = 0; t < Math.PI * 4; t += 0.3) {
            const rr = (t / (Math.PI * 4)) * r * 0.8;
            const px = Math.cos(t) * rr;
            const py = Math.sin(t) * rr;
            if (t === 0) pupil.moveTo(px, py);
            else pupil.lineTo(px, py);
          }
          pupil.strokePath();
        } else if (spec.pupil > 0) {
          pupil.fillStyle(C.charcoal, 1);
          const pr = er * 0.48 * spec.pupil;
          const lx = this.lookX * (r - pr) * 0.7;
          const ly = this.lookY * (r - pr) * 0.7;
          pupil.fillCircle(lx, ly, pr);
          pupil.fillStyle(C.white, 1);
          pupil.fillCircle(lx - pr * 0.35, ly - pr * 0.35, pr * 0.3);
        }
        if (this.def.eyebags) {
          white.lineStyle(3, C.charcoal, 0.6);
          white.beginPath();
          white.arc(0, r * 0.4, r * 0.9, Math.PI * 0.2, Math.PI * 0.8, false);
          white.strokePath();
        }
      }
      // brows
      if (spec.brow !== 0) {
        g.lineStyle(4, C.charcoal, 1);
        const by = fy - r - 8;
        const inner = -side * 8;
        const outer = side * 8;
        const tilt = spec.brow * 8;
        g.lineBetween(side * sp + inner, by - tilt, side * sp + outer, by + tilt);
      }
    }
    // mouth
    const my = fy + er * 1.9;
    g.lineStyle(4, C.charcoal, 1);
    const mw = Math.max(14, this.bw * 0.16);
    switch (spec.mouth) {
      case 'smile':
        g.beginPath();
        g.arc(0, my - 4, mw, Math.PI * 0.15, Math.PI * 0.85, false);
        g.strokePath();
        break;
      case 'grin':
        g.fillStyle(C.charcoal, 1);
        g.slice(0, my - 2, mw * 1.2, 0, Math.PI, false);
        g.fillPath();
        g.fillStyle(C.tomato, 1);
        g.slice(0, my + 6, mw * 0.7, 0, Math.PI, false);
        g.fillPath();
        break;
      case 'o':
        g.fillStyle(C.charcoal, 1);
        g.fillEllipse(0, my + 4, mw * 0.9, mw * 1.1);
        break;
      case 'big':
        g.fillStyle(C.charcoal, 1);
        g.fillEllipse(0, my + 8, mw * 1.6, mw * 2);
        g.fillStyle(C.tomato, 1);
        g.fillEllipse(0, my + 14, mw * 0.9, mw * 0.8);
        break;
      case 'flat':
        g.lineBetween(-mw * 0.8, my + 2, mw * 0.8, my + 2);
        break;
      case 'wavy':
        g.beginPath();
        g.moveTo(-mw, my + 2);
        for (let i = 1; i <= 4; i++) g.lineTo(-mw + (i * mw * 2) / 4, my + 2 + (i % 2 ? -5 : 5));
        g.strokePath();
        break;
      case 'frown':
        g.beginPath();
        g.arc(0, my + 12, mw, Math.PI * 1.15, Math.PI * 1.85, false);
        g.strokePath();
        break;
      case 'smirk':
        g.beginPath();
        g.arc(8, my - 4, mw * 0.8, Math.PI * 0.2, Math.PI * 0.75, false);
        g.strokePath();
        break;
    }
    if (this.def.mustache && !spec.x) {
      g.fillStyle(C.charcoal, 1);
      g.fillEllipse(-14, my - 6, 26, 10);
      g.fillEllipse(14, my - 6, 26, 10);
    }
    if (this.sooty && !spec.x) {
      // soot: eyes wide white already; add smoke wisps
      g.lineStyle(3, C.greyDark, 0.8);
      g.lineBetween(-10, -this.bh / 2 - 4, -4, -this.bh / 2 - 22);
      g.lineBetween(10, -this.bh / 2 - 4, 6, -this.bh / 2 - 26);
    }
  }

  // ---------------------------------------------------------------- state
  setMood(m: Mood) {
    if (this.def.alwaysHappy && (m === 'idle' || m === 'focus')) m = 'happy';
    this.mood = m;
    this.drawFace();
    return this;
  }

  look(dx: number, dy: number) {
    this.lookX = Phaser.Math.Clamp(dx, -1, 1);
    this.lookY = Phaser.Math.Clamp(dy, -1, 1);
    this.drawFace();
    return this;
  }

  setHair(style: HairStyle) {
    this.hairStyle = style;
    this.drawHair();
    return this;
  }

  setBodyColor(c: number | undefined) {
    this.colorOverride = c;
    this.drawBody();
    this.drawArms(0);
    this.drawFeet();
  }

  /** Covered in soot: black body, big white eyes. */
  soot() {
    this.sooty = true;
    this.hairG.setVisible(false);
    this.drawBody();
    this.drawArms(0);
    this.drawFeet();
    this.setMood('surprised');
  }

  // ---------------------------------------------------------------- animation
  startIdle() {
    this.stopIdle();
    const t1 = this.scene.tweens.add({
      targets: this.inner,
      scaleY: 1.035,
      scaleX: 0.985,
      duration: 900 + Math.random() * 300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.idleTw.push(t1);
    this.blinkEvt = this.scene.time.addEvent({
      delay: 1800 + Math.random() * 2200,
      loop: true,
      callback: () => this.blink(),
    });
    if (this.def.jitter) {
      this.jitterTw = this.scene.tweens.add({
        targets: this.inner,
        x: { from: -2, to: 2 },
        duration: 60,
        yoyo: true,
        repeat: -1,
      });
    }
    return this;
  }

  stopIdle() {
    this.idleTw.forEach((t) => t.stop());
    this.idleTw = [];
    this.jitterTw?.stop();
    this.jitterTw = undefined;
    this.blinkEvt?.remove(false);
    this.blinkEvt = undefined;
    if (this.inner.active) {
      this.inner.setScale(1);
      this.inner.setPosition(0, 0);
    }
  }

  blink() {
    if (!this.active || MOODS[this.mood].x) return;
    this.scene.tweens.add({ targets: [this.eyeL, this.eyeR], scaleY: 0.1, duration: 70, yoyo: true });
  }

  /** Walking bob: small hop loop. */
  walk(on: boolean) {
    if (on) {
      const t = this.scene.tweens.add({
        targets: this.inner,
        y: -8,
        duration: 140,
        yoyo: true,
        repeat: -1,
        ease: 'Quad.easeOut',
      });
      this.idleTw.push(t);
      const t2 = this.scene.tweens.add({ targets: this.inner, angle: { from: -3, to: 3 }, duration: 280, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.idleTw.push(t2);
    } else {
      this.stopIdle();
      this.startIdle();
    }
  }

  hop(h = 30, dur = 260) {
    return this.scene.tweens.add({ targets: this.inner, y: -h, duration: dur / 2, yoyo: true, ease: 'Quad.easeOut' });
  }

  squash(sx = 1.25, sy = 0.75, dur = 100) {
    return this.scene.tweens.add({ targets: this.inner, scaleX: sx, scaleY: sy, duration: dur, yoyo: true, ease: 'Quad.easeOut' });
  }

  celebrate() {
    this.stopIdle();
    this.setMood('happy');
    this.drawArms(1);
    this.armL.setRotation(0.9);
    this.armR.setRotation(-0.9);
    this.scene.tweens.add({ targets: this.inner, y: -34, duration: 180, yoyo: true, repeat: 2, ease: 'Quad.easeOut' });
    this.scene.tweens.add({ targets: this.inner, scaleX: 0.9, scaleY: 1.12, duration: 180, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' });
    this.scene.tweens.add({ targets: [this.armL, this.armR], angle: { from: -25, to: 25 }, duration: 110, yoyo: true, repeat: 6 });
    return this;
  }

  panic() {
    this.stopIdle();
    this.setMood('scared');
    this.drawArms(1);
    this.scene.tweens.add({ targets: this.inner, x: { from: -5, to: 5 }, duration: 45, yoyo: true, repeat: -1 });
    this.scene.tweens.add({ targets: [this.armL, this.armR], angle: { from: -40, to: 40 }, duration: 90, yoyo: true, repeat: -1 });
    return this;
  }

  /** Accordion flatten. Keeps feet on the ground. */
  flatten(dur = 110) {
    this.stopIdle();
    this.setMood('dead');
    return this.scene.tweens.add({
      targets: this.inner,
      scaleY: 0.18,
      scaleX: 1.7,
      y: this.bh * 0.41,
      duration: dur,
      ease: 'Quad.easeIn',
    });
  }

  unflatten(dur = 400) {
    return this.scene.tweens.add({ targets: this.inner, scaleY: 1, scaleX: 1, y: 0, duration: dur, ease: 'Elastic.easeOut' });
  }

  /** Fly off-screen spinning. dirX: -1 left, 1 right; dirY negative goes up */
  spinOut(dirX = 1, dirY = -1, dur = 700) {
    this.stopIdle();
    this.setMood('scream');
    return this.scene.tweens.add({
      targets: this,
      x: this.x + dirX * 900,
      y: this.y + dirY * 700,
      angle: dirX * 1080,
      duration: dur,
      ease: 'Quad.easeIn',
    });
  }

  shake(intensity = 6, dur = 400) {
    return this.scene.tweens.add({
      targets: this.inner,
      x: { from: -intensity, to: intensity },
      duration: 40,
      yoyo: true,
      repeat: Math.floor(dur / 80),
      onComplete: () => this.inner.active && this.inner.setX(0),
    });
  }

  destroy(fromScene?: boolean) {
    this.stopIdle();
    if (this.scene) {
      this.scene.tweens.killTweensOf(this.inner);
      this.scene.tweens.killTweensOf([this.armL, this.armR, this.eyeL, this.eyeR]);
      this.scene.tweens.killTweensOf(this);
    }
    super.destroy(fromScene);
  }
}
