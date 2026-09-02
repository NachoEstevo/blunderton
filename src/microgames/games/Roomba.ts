import Phaser from 'phaser';
import { Microgame, W, H, type MicrogameMeta } from '../Microgame';
import { C, darken } from '../../core/Palette';
import { puff } from '../../entities/Props';
import { audio } from '../../core/Audio';
import type { Critter } from '../../entities/Critter';

export const RoombaMeta: MicrogameMeta = {
  id: 'roomba',
  name: 'Escape the Roomba',
  instruction: 'RUN!',
  mechanic: 'Continuous movement',
  group: 'move',
  baseDuration: 7000,
  timeoutWins: true,
  character: 'twitch',
  accident: { name: 'Cleaned Up', desc: 'Defenestrated by a vacuum.' },
};

const ROOM = new Phaser.Geom.Rectangle(70, 110, W - 140, H - 180);

export class EscapeRoomba extends Microgame {
  meta = RoombaMeta;
  private twitch!: Critter;
  private roomba!: Phaser.GameObjects.Container;
  private lightG!: Phaser.GameObjects.Graphics;
  private px = 400;
  private py = 400;
  private rx = 1000;
  private ry = 300;
  private speed = 280;
  private rspeed = 170;
  private furniture: Phaser.Geom.Rectangle[] = [];
  private batteryG!: Phaser.GameObjects.Graphics;
  private turbo = 0;
  private turboT = 2;
  private time = 0;
  private trail: Phaser.GameObjects.Graphics[] = [];
  private windowRect = new Phaser.Geom.Rectangle(900, 74, 170, 44);

  build() {
    const g = this.gfx();
    g.fillStyle(0xd9c7a8, 1);
    g.fillRect(0, 0, W, H);
    // walls
    g.fillStyle(0xf1e5d0, 1);
    g.fillRect(0, 0, W, ROOM.y);
    g.lineStyle(6, C.charcoal, 1);
    g.lineBetween(0, ROOM.y, W, ROOM.y);
    // window on the top wall
    g.fillStyle(C.skyLight, 1);
    g.fillRoundedRect(this.windowRect.x, this.windowRect.y, this.windowRect.width, this.windowRect.height, 8);
    g.strokeRoundedRect(this.windowRect.x, this.windowRect.y, this.windowRect.width, this.windowRect.height, 8);
    g.lineBetween(this.windowRect.centerX, this.windowRect.y, this.windowRect.centerX, this.windowRect.y + this.windowRect.height);
    // rug
    g.fillStyle(C.tomato, 1);
    g.fillRoundedRect(360, 260, 560, 300, 20);
    g.fillStyle(C.mustard, 1);
    g.fillRoundedRect(390, 290, 500, 240, 16);
    g.fillStyle(C.tomato, 1);
    g.fillRoundedRect(420, 320, 440, 180, 12);
    g.lineStyle(4, C.charcoal, 0.6);
    g.strokeRoundedRect(360, 260, 560, 300, 20);

    // furniture (rects are collision boxes)
    const add = (r: Phaser.Geom.Rectangle, color: number, label?: string) => {
      this.furniture.push(r);
      g.fillStyle(C.charcoal, 0.25);
      g.fillRoundedRect(r.x + 6, r.y + 10, r.width, r.height, 12);
      g.fillStyle(color, 1);
      g.lineStyle(5, C.charcoal, 1);
      g.fillRoundedRect(r.x, r.y, r.width, r.height, 12);
      g.strokeRoundedRect(r.x, r.y, r.width, r.height, 12);
      if (label) this.text(r.centerX, r.centerY, label, { size: 14, color: C.charcoal, strokeWidth: 0, shadow: false }).setAlpha(0.5);
    };
    add(new Phaser.Geom.Rectangle(110, 420, 220, 110), C.sky, 'SOFA');
    add(new Phaser.Geom.Rectangle(560, 340, 170, 110), C.wood, 'TABLE');
    add(new Phaser.Geom.Rectangle(980, 160, 140, 90), C.violet, 'TV');
    add(new Phaser.Geom.Rectangle(880, 500, 90, 90), C.mintDark, 'PLANT');
    add(new Phaser.Geom.Rectangle(300, 160, 120, 80), C.grey, 'BOX');

    this.twitch = this.critter('twitch', this.px, this.py, 0.8);
    this.twitch.setMood('scared');
    this.twitch.walk(true);

    // roomba
    this.roomba = this.scene.add.container(this.rx, this.ry);
    const rg = this.scene.add.graphics();
    rg.fillStyle(C.charcoal, 1);
    rg.fillCircle(0, 4, 34);
    rg.fillStyle(C.grey, 1);
    rg.lineStyle(4, C.charcoal, 1);
    rg.fillCircle(0, 0, 34);
    rg.strokeCircle(0, 0, 34);
    rg.fillStyle(C.greyDark, 1);
    rg.fillCircle(0, 0, 22);
    rg.fillStyle(C.charcoal, 1);
    rg.fillRect(-14, 28, 28, 6);
    this.lightG = this.scene.add.graphics();
    this.batteryG = this.scene.add.graphics();
    this.roomba.add([rg, this.lightG, this.batteryG]);
    this.root.add(this.roomba);

    this.speed = this.lerpD(270, 300);
    this.rspeed = this.lerpD(165, 235);
    this.text(640, 150, 'the battery is almost dead. probably.', { size: 16, color: C.charcoal, strokeWidth: 0, shadow: false }).setAlpha(0.5);
    const hint = this.text(640, 660, 'WASD / arrows  •  or hold and drag', { size: 18, color: C.charcoal, strokeWidth: 0, shadow: false }).setAlpha(0.5);
    this.tween({ targets: hint, alpha: 0, duration: 400, delay: 2000 });
  }

  begin() {
    super.begin();
    audio.sfx('buzz', 1.3);
  }

  private moveWithCollision(x: number, y: number, dx: number, dy: number, r: number): [number, number] {
    let nx = x + dx;
    let ny = y + dy;
    nx = Phaser.Math.Clamp(nx, ROOM.x + r, ROOM.right - r);
    ny = Phaser.Math.Clamp(ny, ROOM.y + r, ROOM.bottom - r);
    for (const f of this.furniture) {
      const box = new Phaser.Geom.Rectangle(f.x - r, f.y - r, f.width + 2 * r, f.height + 2 * r);
      if (box.contains(nx, ny)) {
        // push out along the axis of least penetration
        const dl = nx - box.x;
        const dr = box.right - nx;
        const dt = ny - box.y;
        const db = box.bottom - ny;
        const m = Math.min(dl, dr, dt, db);
        if (m === dl) nx = box.x;
        else if (m === dr) nx = box.right;
        else if (m === dt) ny = box.y;
        else ny = box.bottom;
      }
    }
    return [nx, ny];
  }

  update(_t: number, delta: number) {
    if (!this.started || this.done) return;
    const dt = Math.min(0.05, delta / 1000);
    this.time += dt;
    // player input
    let vx = this.input.axisX();
    let vy = this.input.axisY();
    if (vx === 0 && vy === 0 && this.input.pointerDown) {
      const p = this.input.pointer;
      const dx = p.x - this.px;
      const dy = p.y - this.py;
      const len = Math.hypot(dx, dy);
      if (len > 10) {
        vx = dx / len;
        vy = dy / len;
      }
    }
    const len = Math.hypot(vx, vy) || 1;
    if (vx || vy) {
      [this.px, this.py] = this.moveWithCollision(this.px, this.py, (vx / len) * this.speed * dt, (vy / len) * this.speed * dt, 26);
      this.twitch.look(vx, vy);
    }
    this.twitch.setPosition(this.px, this.py);
    // roomba chase (+ turbo bursts at higher difficulty)
    if (this.d > 0.45) {
      this.turboT -= dt;
      if (this.turboT <= 0) {
        this.turbo = 0.5;
        this.turboT = 2.2;
        audio.sfx('rise', 1.5);
      }
    }
    this.turbo = Math.max(0, this.turbo - dt);
    const sp = this.rspeed * (this.turbo > 0 ? 1.45 : 1);
    const dx = this.px - this.rx;
    const dy = this.py - this.ry;
    const dl = Math.hypot(dx, dy) || 1;
    const before: [number, number] = [this.rx, this.ry];
    [this.rx, this.ry] = this.moveWithCollision(this.rx, this.ry, (dx / dl) * sp * dt, (dy / dl) * sp * dt, 34);
    // if blocked, slide perpendicular
    if (Math.hypot(this.rx - before[0], this.ry - before[1]) < sp * dt * 0.3) {
      const side = Math.sin(this.time * 2) > 0 ? 1 : -1;
      [this.rx, this.ry] = this.moveWithCollision(this.rx, this.ry, (-dy / dl) * sp * dt * side, (dx / dl) * sp * dt * side, 34);
    }
    this.roomba.setPosition(this.rx, this.ry);
    this.roomba.angle += 200 * dt;
    // light + battery
    this.lightG.clear();
    this.lightG.fillStyle(this.turbo > 0 ? C.tomato : C.mint, 1);
    this.lightG.fillCircle(0, 0, 6 + Math.sin(this.time * 15) * 2);
    const bat = this.scene.remainingFrac();
    this.batteryG.clear();
    this.batteryG.setRotation(-this.roomba.rotation);
    this.batteryG.fillStyle(C.charcoal, 1);
    this.batteryG.fillRoundedRect(-24, -60, 48, 16, 4);
    this.batteryG.fillRect(24, -56, 4, 8);
    this.batteryG.fillStyle(bat < 0.3 ? C.tomato : C.mint, 1);
    this.batteryG.fillRoundedRect(-21, -57, 42 * bat, 10, 3);
    // dust trail
    if (Math.random() < 0.3) {
      const d = this.gfx();
      d.fillStyle(C.white, 0.5);
      d.fillCircle(0, 0, 6);
      d.setPosition(this.rx, this.ry);
      this.root.sendToBack(d);
      this.tween({ targets: d, alpha: 0, scale: 2, duration: 500, onComplete: () => d.destroy() });
    }
    // caught?
    if (Math.hypot(this.px - this.rx, this.py - this.ry) < 46) this.lose();
  }

  onWin(): number {
    audio.sfx('buzz', 0.5);
    this.twitch.walk(false);
    // roomba sputters and dies
    this.tween({ targets: this.roomba, angle: this.roomba.angle + 60, duration: 600, ease: 'Quad.easeOut' });
    this.lightG.clear();
    puff(this.scene, this.root, this.rx, this.ry - 20, 3, C.greyDark, 10);
    const z = this.text(this.rx, this.ry - 70, 'zzz', { size: 22, color: C.charcoal, strokeWidth: 0, shadow: false });
    this.tween({ targets: z, y: this.ry - 110, alpha: 0, duration: 900 });
    this.after(500, () => {
      audio.sfx('success');
      audio.vocal('happy', 1.4);
      this.twitch.celebrate();
      this.caption('OUT OF BATTERY!', C.mint);
    });
    return 1200;
  }

  onLose(): number {
    audio.sfx('zap', 0.8);
    audio.sfx('aah', 1.6);
    this.twitch.walk(false);
    this.twitch.setMood('scream');
    // tiny robot, enormous violence: it flips Twitch through the window
    this.tween({ targets: this.roomba, scale: 1.3, duration: 120, yoyo: true });
    this.after(150, () => {
      audio.sfx('boing');
      const wx = this.windowRect.centerX;
      const wy = this.windowRect.centerY;
      this.tween({
        targets: this.twitch,
        x: wx,
        y: wy,
        angle: 720,
        scale: 0.5,
        duration: 600,
        ease: 'Quad.easeOut',
        onComplete: () => {
          audio.sfx('shatter');
          this.scene.shakeCam(0.012, 250);
          // glass shards
          for (let i = 0; i < 8; i++) {
            const s = this.gfx();
            s.fillStyle(C.skyLight, 1);
            s.lineStyle(2, C.charcoal, 1);
            s.fillTriangle(-8, 8, 8, 8, 0, -10);
            s.strokeTriangle(-8, 8, 8, 8, 0, -10);
            s.setPosition(wx, wy);
            this.tween({ targets: s, x: wx + (Math.random() - 0.5) * 300, y: wy + Math.random() * 200, angle: 360, alpha: 0, duration: 600 });
          }
          this.tween({ targets: this.twitch, y: -200, duration: 300, ease: 'Quad.easeIn' });
          this.after(300, () => {
            audio.sfx('whoosh', 0.7);
            this.roomba.angle += 30;
            puff(this.scene, this.root, this.rx, this.ry, 4, C.white, 12);
            this.caption('CLEANED UP.', C.tomato);
          });
        },
      });
    });
    return 1800;
  }
}

