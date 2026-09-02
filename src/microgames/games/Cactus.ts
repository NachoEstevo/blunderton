import Phaser from 'phaser';
import { Microgame, W, H, type MicrogameMeta } from '../Microgame';
import { C } from '../../core/Palette';
import { drawRoom, drawCactus, puff } from '../../entities/Props';
import { audio } from '../../core/Audio';
import type { Critter } from '../../entities/Critter';

export const CactusMeta: MicrogameMeta = {
  id: 'cactus',
  name: 'Cactus Balloon',
  instruction: 'FLOAT!',
  mechanic: 'Steer with precision',
  group: 'steer',
  baseDuration: 7000,
  timeoutWins: false,
  character: 'bloom',
  accident: { name: 'Popped', desc: 'Balloon met cactus. Cactus won.' },
};

interface CactusObstacle {
  baseX: number;
  rects: Phaser.Geom.Rectangle[];
  g: Phaser.GameObjects.Graphics;
  swayPhase: number;
}

const FLOOR = 610;

export class CactusBalloon extends Microgame {
  meta = CactusMeta;
  private balloon!: Phaser.GameObjects.Container;
  private bx = 150;
  private by = 300;
  private tx = 150;
  private ty = 300;
  private stringG!: Phaser.GameObjects.Graphics;
  private bloom!: Critter;
  private cacti: CactusObstacle[] = [];
  private sway = 0;
  private time = 0;
  private hasPointer = false;

  build() {
    const g = this.gfx();
    drawRoom(g, C.creamDark, C.wood, FLOOR);
    // door / safe zone
    g.fillStyle(C.mint, 1);
    g.lineStyle(5, C.charcoal, 1);
    g.fillRoundedRect(1150, 120, 110, FLOOR - 120, { tl: 40, tr: 0, br: 0, bl: 0 });
    g.strokeRoundedRect(1150, 120, 110, FLOOR - 120, { tl: 40, tr: 0, br: 0, bl: 0 });
    g.fillStyle(C.charcoal, 1);
    g.fillCircle(1180, 380, 8);
    this.text(1205, 200, 'SAFE', { size: 26, color: C.white });
    // ceiling beam (cacti hang from it at higher difficulty)
    g.fillStyle(C.wood, 1);
    g.fillRect(0, 62, W, 14);
    g.lineStyle(4, C.charcoal, 1);
    g.lineBetween(0, 76, W, 76);
    this.text(640, 668, 'CACTUS ROOM  •  mind the cacti', { size: 20, color: C.charcoal, strokeWidth: 0, shadow: false }).setAlpha(0.35);

    // cacti layout: alternate floor / ceiling, with guaranteed passage
    const n = Math.round(this.lerpD(4, 8));
    this.sway = this.d > 0.45 ? this.lerpD(0, 30) : 0;
    const x0 = 380;
    const x1 = 1040;
    for (let i = 0; i < n; i++) {
      const x = x0 + ((i + 0.5) / n) * (x1 - x0) + (Math.random() - 0.5) * 30;
      const cg = this.gfx();
      const rects: Phaser.Geom.Rectangle[] = [];
      const fromCeiling = i % 3 === 2 && this.d > 0.3;
      if (fromCeiling) {
        // drawn upright from baseY 0 then flipped, so it hangs from the ceiling line (below the HUD)
        const CEIL = 76;
        const h = Phaser.Math.Between(160, Math.round(this.lerpD(240, 310)));
        cg.setScale(1, -1);
        cg.setPosition(0, CEIL);
        drawCactus(cg, x, 0, h, 46, h > 200);
        rects.push(new Phaser.Geom.Rectangle(x - 23, CEIL, 46, h));
        if (h > 200) rects.push(new Phaser.Geom.Rectangle(x - 52, CEIL + h * 0.55 - 40, 104, 60));
      } else {
        const h = Phaser.Math.Between(150, Math.round(this.lerpD(300, 380)));
        drawCactus(cg, x, FLOOR, h, 46, h > 90);
        rects.push(new Phaser.Geom.Rectangle(x - 23, FLOOR - h, 46, h));
        if (h > 90) rects.push(new Phaser.Geom.Rectangle(x - 52, FLOOR - h * 0.55 - 40, 104, 60));
      }
      this.cacti.push({ baseX: x, rects, g: cg, swayPhase: Math.random() * Math.PI * 2 });
    }

    // Bloom holding the string
    this.bloom = this.critter('bloom', 150, FLOOR - 58, 0.95);
    this.bloom.look(0, -1);
    this.stringG = this.gfx();

    // balloon
    this.balloon = this.scene.add.container(this.bx, this.by);
    const bg = this.scene.add.graphics();
    bg.fillStyle(C.pink, 1);
    bg.lineStyle(4, C.charcoal, 1);
    bg.fillEllipse(0, 0, 66, 78);
    bg.strokeEllipse(0, 0, 66, 78);
    bg.fillStyle(C.white, 0.7);
    bg.fillEllipse(-14, -18, 14, 22);
    bg.fillStyle(C.pink, 1);
    bg.fillTriangle(-8, 38, 8, 38, 0, 46);
    bg.strokeTriangle(-8, 38, 8, 38, 0, 46);
    this.balloon.add(bg);
    this.root.add(this.balloon);
    this.tween({ targets: this.balloon, angle: { from: -4, to: 4 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // faint guide arrow
    const arrow = this.text(640, 300, '➜', { size: 60, color: C.charcoal, strokeWidth: 0, shadow: false }).setAlpha(0.12);
    this.tween({ targets: arrow, x: 700, duration: 600, yoyo: true, repeat: -1 });
  }

  begin() {
    super.begin();
    this.input.onMove((p) => {
      this.hasPointer = true;
      this.tx = p.x;
      this.ty = p.y;
    });
    this.input.onDown((p) => {
      this.hasPointer = true;
      this.tx = p.x;
      this.ty = p.y;
    });
  }

  update(_t: number, dt: number) {
    if (!this.started || this.done) return;
    this.time += dt / 1000;
    const kx = this.input.axisX();
    const ky = this.input.axisY();
    if (kx || ky) {
      this.tx += kx * 520 * (dt / 1000);
      this.ty += ky * 520 * (dt / 1000);
      this.hasPointer = true;
    }
    if (this.hasPointer) {
      this.tx = Phaser.Math.Clamp(this.tx, 40, W - 40);
      this.ty = Phaser.Math.Clamp(this.ty, 60, FLOOR - 50);
      const k = 1 - Math.pow(0.001, dt / 1000); // ~lerp 0.35 per frame at 60fps
      this.bx += (this.tx - this.bx) * k;
      this.by += (this.ty - this.by) * k;
    }
    this.balloon.setPosition(this.bx, this.by);
    // Bloom follows below
    const targetX = Phaser.Math.Clamp(this.bx - 20, 120, 1100);
    this.bloom.x += (targetX - this.bloom.x) * 0.12;
    this.bloom.look((this.bx - this.bloom.x) / 200, -1);
    // string
    this.stringG.clear();
    this.stringG.lineStyle(3, C.charcoal, 1);
    this.stringG.beginPath();
    this.stringG.moveTo(this.bx, this.by + 44);
    const mx = (this.bx + this.bloom.x) / 2 + 20;
    const my = (this.by + this.bloom.y) / 2 + 30;
    this.stringG.lineTo(mx, my);
    this.stringG.lineTo(this.bloom.x + 30, this.bloom.y - 10);
    this.stringG.strokePath();
    // sway cacti
    if (this.sway > 0) {
      for (const c of this.cacti) {
        const off = Math.sin(this.time * 2.2 + c.swayPhase) * this.sway;
        c.g.x = off;
      }
    }
    // collision
    const circle = new Phaser.Geom.Circle(this.bx, this.by, 30);
    for (const c of this.cacti) {
      for (const r of c.rects) {
        const rr = new Phaser.Geom.Rectangle(r.x + c.g.x, r.y, r.width, r.height);
        if (Phaser.Geom.Intersects.CircleToRectangle(circle, rr)) {
          this.lose();
          return;
        }
      }
    }
    if (this.bx > 1165) this.win();
  }

  onWin(): number {
    audio.sfx('success');
    audio.vocal('happy', 1.2);
    this.tween({ targets: this.balloon, y: this.by - 40, duration: 500, yoyo: true, ease: 'Sine.easeInOut' });
    this.bloom.celebrate();
    this.caption('SAFE!', C.mint);
    return 900;
  }

  onLose(): number {
    audio.sfx('pop', 0.9);
    audio.sfx('explode', 1.4);
    this.scene.shakeCam(0.006, 150);
    const bx = this.bx;
    const by = this.by;
    this.balloon.setVisible(false);
    this.stringG.clear();
    // shards
    const shards: Phaser.GameObjects.Graphics[] = [];
    for (let i = 0; i < 7; i++) {
      const s = this.gfx();
      s.fillStyle(C.pink, 1);
      s.lineStyle(3, C.charcoal, 1);
      s.fillTriangle(-10, 8, 10, 8, 0, -14);
      s.strokeTriangle(-10, 8, 10, 8, 0, -14);
      s.setPosition(bx, by);
      const a = (i / 7) * Math.PI * 2;
      this.tween({ targets: s, x: bx + Math.cos(a) * 90, y: by + Math.sin(a) * 60, angle: 180, duration: 180, ease: 'Quad.easeOut' });
      shards.push(s);
    }
    this.bloom.stopIdle();
    // beat: Bloom slowly looks up... then the shreds land on the head
    this.after(250, () => this.bloom.setMood('surprised').look(0, -1));
    this.after(500, () => {
      for (const s of shards) {
        this.tween({
          targets: s,
          x: this.bloom.x + (Math.random() - 0.5) * 60,
          y: this.bloom.y - 60 + Math.random() * 20,
          angle: 360,
          duration: 450,
          ease: 'Quad.easeIn',
        });
      }
    });
    this.after(950, () => {
      this.bloom.setMood('sad');
      this.bloom.squash(1.1, 0.9, 120);
      audio.sfx('oh', 1.3);
      puff(this.scene, this.root, this.bloom.x, this.bloom.y - 40, 3, C.pink, 12);
    });
    this.after(1000, () => this.caption('POP.', C.pink));
    return 1500;
  }
}
