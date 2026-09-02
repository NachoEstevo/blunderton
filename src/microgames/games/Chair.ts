import Phaser from 'phaser';
import { Microgame, W, H, type MicrogameMeta } from '../Microgame';
import { C, darken } from '../../core/Palette';
import { puff, dizzyStars } from '../../entities/Props';
import { audio } from '../../core/Audio';
import type { Critter } from '../../entities/Critter';

export const ChairMeta: MicrogameMeta = {
  id: 'chair',
  name: 'Office Chair Rocket',
  instruction: 'STEER!',
  mechanic: 'Lane switching',
  group: 'lanes',
  baseDuration: 7000,
  timeoutWins: true,
  character: 'fizz',
  accident: { name: 'Embedded', desc: 'Office chair, rocket, printer.' },
};

const LANES = [490, 640, 790];
const HALL_L = 340;
const HALL_R = 940;
const PLAYER_Y = 560;

type ObKind = 'printer' | 'cart' | 'plant' | 'cooler';

interface Ob {
  c: Phaser.GameObjects.Container;
  lane: number;
  kind: ObKind;
}

export class ChairRocket extends Microgame {
  meta = ChairMeta;
  private fizz!: Critter;
  private chair!: Phaser.GameObjects.Container;
  private flame!: Phaser.GameObjects.Graphics;
  private lane = 1;
  private obs: Ob[] = [];
  private speed = 450;
  private spawnEvery = 0.75;
  private spawnT = 0.4;
  private tilesG!: Phaser.GameObjects.Graphics;
  private tileOff = 0;
  private lastLanes: number[] = [];
  private doorsG!: Phaser.GameObjects.Graphics;

  build() {
    const g = this.gfx();
    g.fillStyle(0xe8e2d4, 1);
    g.fillRect(0, 0, W, H);
    // hallway floor
    g.fillStyle(0xf6efe0, 1);
    g.fillRect(HALL_L, 0, HALL_R - HALL_L, H);
    this.tilesG = this.gfx();
    // walls
    g.fillStyle(C.violet, 1);
    g.fillRect(HALL_L - 24, 0, 24, H);
    g.fillRect(HALL_R, 0, 24, H);
    this.doorsG = this.gfx();
    // side offices decoration (static)
    g.fillStyle(0xd9d2c3, 1);
    for (let y = 40; y < H; y += 180) {
      g.fillRoundedRect(60, y, 200, 110, 10);
      g.fillRoundedRect(W - 260, y + 80, 200, 110, 10);
    }
    g.fillStyle(C.charcoal, 0.15);
    for (let y = 40; y < H; y += 180) {
      g.fillRect(80, y + 20, 160, 8);
      g.fillRect(80, y + 50, 120, 8);
      g.fillRect(W - 240, y + 100, 160, 8);
      g.fillRect(W - 240, y + 130, 120, 8);
    }
    this.text(160, 700, 'HALLWAY B  •  no rockets', { size: 16, color: C.charcoal, strokeWidth: 0, shadow: false }).setAlpha(0.5);

    // chair + Fizz
    this.chair = this.scene.add.container(LANES[this.lane], PLAYER_Y);
    this.flame = this.scene.add.graphics();
    const cg = this.scene.add.graphics();
    cg.fillStyle(C.charcoal, 1);
    cg.fillRoundedRect(-44, 30, 88, 16, 6); // wheel base
    for (let i = -1; i <= 1; i++) cg.fillCircle(i * 34, 48, 8);
    cg.fillStyle(C.tomato, 1);
    cg.lineStyle(4, C.charcoal, 1);
    cg.fillRoundedRect(-46, -20, 92, 56, 14); // seat
    cg.strokeRoundedRect(-46, -20, 92, 56, 14);
    // rocket strapped to the back
    cg.fillStyle(C.greyDark, 1);
    cg.fillRoundedRect(-18, 20, 36, 50, 10);
    cg.strokeRoundedRect(-18, 20, 36, 50, 10);
    this.fizz = this.critter('fizz', 0, -40, 0.7);
    this.fizz.setMood('happy');
    this.chair.add([this.flame, cg, this.fizz]);
    this.root.add(this.chair);
    this.tween({ targets: this.chair, angle: { from: -2, to: 2 }, duration: 90, yoyo: true, repeat: -1 });

    this.speed = this.lerpD(400, 720);
    this.spawnEvery = this.lerpD(0.8, 0.46);
    this.drawTiles();
    this.sidePads('◀', '▶');
  }

  private drawTiles() {
    const g = this.tilesG;
    g.clear();
    g.lineStyle(3, C.charcoal, 0.15);
    for (let y = -120 + (this.tileOff % 120); y < H + 120; y += 120) g.lineBetween(HALL_L, y, HALL_R, y);
    g.lineBetween(565, 0, 565, H);
    g.lineBetween(715, 0, 715, H);
    // doors on the walls scroll too
    const d = this.doorsG;
    d.clear();
    for (let y = -200 + (this.tileOff % 300); y < H + 200; y += 300) {
      d.fillStyle(C.mustard, 1);
      d.lineStyle(3, C.charcoal, 1);
      d.fillRect(HALL_L - 24, y, 24, 90);
      d.strokeRect(HALL_L - 24, y, 24, 90);
      d.fillRect(HALL_R, y + 150, 24, 90);
      d.strokeRect(HALL_R, y + 150, 24, 90);
    }
  }

  private drawFlame() {
    const g = this.flame;
    g.clear();
    const s = 0.8 + Math.random() * 0.5;
    g.fillStyle(C.mustard, 1);
    g.fillTriangle(-16, 70, 16, 70, 0, 70 + 50 * s);
    g.fillStyle(C.tomato, 1);
    g.fillTriangle(-9, 70, 9, 70, 0, 70 + 30 * s);
  }

  begin() {
    super.begin();
    audio.sfx('rocket');
    this.input.onSide((side) => this.move(side === 'left' ? -1 : 1));
    this.input.onSwipe((dir) => {
      if (dir === 'left') this.move(-1);
      if (dir === 'right') this.move(1);
    });
  }

  private move(dir: number) {
    if (this.done) return;
    const nl = Phaser.Math.Clamp(this.lane + dir, 0, 2);
    if (nl === this.lane) {
      audio.sfx('tick', 0.5);
      return;
    }
    this.lane = nl;
    audio.sfx('whoosh', 1.3);
    this.scene.tweens.killTweensOf(this.chair);
    this.tween({ targets: this.chair, x: LANES[nl], duration: 110, ease: 'Quad.easeOut' });
    this.tween({ targets: this.chair, angle: dir * 14, duration: 90, yoyo: true, onComplete: () => this.chair.setAngle(0) });
  }

  private spawn() {
    // pick lanes to block, never all three, never the same single lane 3 times
    let count = this.d > 0.5 && Math.random() < this.lerpD(0, 0.6) ? 2 : 1;
    const lanes = Phaser.Utils.Array.Shuffle([0, 1, 2]).slice(0, count);
    if (count === 1 && this.lastLanes.length >= 2 && this.lastLanes.every((l) => l === lanes[0])) lanes[0] = (lanes[0] + 1) % 3;
    this.lastLanes.push(lanes[0]);
    if (this.lastLanes.length > 2) this.lastLanes.shift();
    const kinds: ObKind[] = ['printer', 'cart', 'plant', 'cooler'];
    for (const lane of lanes) {
      const kind = kinds[Phaser.Math.Between(0, kinds.length - 1)];
      const c = this.scene.add.container(LANES[lane], -90);
      const g = this.scene.add.graphics();
      g.lineStyle(4, C.charcoal, 1);
      switch (kind) {
        case 'printer':
          g.fillStyle(C.grey, 1);
          g.fillRoundedRect(-50, -34, 100, 68, 10);
          g.strokeRoundedRect(-50, -34, 100, 68, 10);
          g.fillStyle(C.white, 1);
          g.fillRect(-36, -50, 72, 30);
          g.strokeRect(-36, -50, 72, 30);
          g.fillStyle(C.mint, 1);
          g.fillCircle(34, 18, 6);
          break;
        case 'cart':
          g.fillStyle(C.mustard, 1);
          g.fillRoundedRect(-46, -40, 92, 80, 8);
          g.strokeRoundedRect(-46, -40, 92, 80, 8);
          g.fillStyle(C.charcoal, 1);
          g.fillCircle(-34, 44, 8);
          g.fillCircle(34, 44, 8);
          g.fillStyle(C.tomato, 1);
          g.fillRect(-30, -24, 60, 14);
          break;
        case 'plant':
          g.fillStyle(C.tomatoDark, 1);
          g.fillRoundedRect(-30, 0, 60, 44, 8);
          g.strokeRoundedRect(-30, 0, 60, 44, 8);
          g.fillStyle(C.mintDark, 1);
          g.fillCircle(0, -20, 40);
          g.strokeCircle(0, -20, 40);
          g.fillStyle(C.mint, 1);
          g.fillCircle(-12, -30, 12);
          break;
        case 'cooler':
          g.fillStyle(C.greyDark, 1);
          g.fillRoundedRect(-26, -10, 52, 60, 8);
          g.strokeRoundedRect(-26, -10, 52, 60, 8);
          g.fillStyle(C.skyLight, 1);
          g.fillRoundedRect(-22, -60, 44, 54, 12);
          g.strokeRoundedRect(-22, -60, 44, 54, 12);
          break;
      }
      c.add(g);
      this.root.add(c);
      this.root.bringToTop(this.chair);
      this.obs.push({ c, lane, kind });
    }
  }

  update(_t: number, delta: number) {
    if (!this.started || this.done) return;
    const dt = delta / 1000;
    this.tileOff += this.speed * dt;
    this.drawTiles();
    this.drawFlame();
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      // stop spawning right before the end so the finish is clean
      if (this.scene.remainingFrac() > 0.12) this.spawn();
      this.spawnT = this.spawnEvery;
    }
    const pr = new Phaser.Geom.Rectangle(this.chair.x - 36, PLAYER_Y - 60, 72, 110);
    for (const o of this.obs) {
      o.c.y += this.speed * dt;
      if (o.c.y > H + 120) {
        o.c.destroy();
        continue;
      }
      const or = new Phaser.Geom.Rectangle(o.c.x - 40, o.c.y - 40, 80, 80);
      if (Phaser.Geom.Intersects.RectangleToRectangle(pr, or)) {
        this.crashInto(o);
        return;
      }
    }
    this.obs = this.obs.filter((o) => o.c.active);
  }

  private crashObj: Ob | null = null;
  private crashInto(o: Ob) {
    this.crashObj = o;
    this.lose();
  }

  onWin(): number {
    audio.sfx('screech', 0.6);
    // finish mat
    const mat = this.gfx();
    mat.fillStyle(C.mint, 1);
    mat.lineStyle(4, C.charcoal, 1);
    mat.fillRoundedRect(HALL_L + 20, -80, HALL_R - HALL_L - 40, 60, 10);
    mat.strokeRoundedRect(HALL_L + 20, -80, HALL_R - HALL_L - 40, 60, 10);
    const label = this.text(640, -50, 'END OF HALL', { size: 24, color: C.white });
    this.tween({ targets: [mat, label], y: PLAYER_Y + 40, duration: 350, ease: 'Quad.easeOut' });
    this.scene.tweens.killTweensOf(this.chair);
    this.chair.setAngle(0);
    puff(this.scene, this.root, this.chair.x, PLAYER_Y + 60, 8, C.creamDark, 18);
    this.flame.clear();
    this.after(350, () => {
      audio.sfx('success');
      audio.vocal('happy', 0.9);
      this.fizz.setMood('smug');
      this.fizz.celebrate();
      this.caption('MADE IT!', C.mint);
    });
    return 1200;
  }

  onLose(): number {
    audio.sfx('crunch');
    audio.sfx('hit');
    this.scene.shakeCam(0.02, 350);
    this.scene.tweens.killTweensOf(this.chair);
    const o = this.crashObj;
    this.fizz.stopIdle();
    this.fizz.setMood('dead');
    this.flame.clear();
    // Fizz gets embedded in the obstacle, wheels roll on
    if (o) {
      this.tween({ targets: o.c, y: PLAYER_Y - 60, scaleX: 1.25, scaleY: 0.85, duration: 100 });
      this.tween({ targets: this.fizz, y: -110, scaleX: 0.9, scaleY: 0.5, duration: 120, ease: 'Quad.easeIn' });
    }
    puff(this.scene, this.root, this.chair.x, PLAYER_Y - 30, 10, C.creamDark, 22);
    for (let i = -1; i <= 1; i++) {
      const w = this.gfx();
      w.fillStyle(C.charcoal, 1);
      w.fillCircle(0, 0, 8);
      w.setPosition(this.chair.x + i * 34, PLAYER_Y + 48);
      this.tween({ targets: w, y: H + 60, x: w.x + i * 80, angle: 720, duration: 700, ease: 'Quad.easeIn' });
    }
    this.after(300, () => {
      dizzyStars(this.scene, this.root, this.chair.x, PLAYER_Y - 130, 1200);
      audio.sfx('oh', 1.1);
      this.caption('EMBEDDED.', C.tomato);
    });
    return 1600;
  }
}

