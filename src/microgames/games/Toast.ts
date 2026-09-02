import Phaser from 'phaser';
import { Microgame, W, type MicrogameMeta } from '../Microgame';
import { C } from '../../core/Palette';
import { drawRoom, drawToast, drawBrick, puff, squash } from '../../entities/Props';
import { audio } from '../../core/Audio';
import type { Critter } from '../../entities/Critter';

export const ToastMeta: MicrogameMeta = {
  id: 'toast',
  name: 'Toast Launcher',
  instruction: 'CATCH!',
  mechanic: 'Click flying targets',
  group: 'targets',
  baseDuration: 7000,
  timeoutWins: false,
  character: 'toasty',
  accident: { name: 'Toasted', desc: 'Breakfast fought back.' },
};

const FLOOR = 600;
const TOASTER = { x: 210, y: 470 };
const TOASTY_X = 1010;

interface Flyer {
  c: Phaser.GameObjects.Container;
  t: number; // 0..1 progress
  dur: number;
  fake: boolean;
  done: boolean;
  from: { x: number; y: number };
  to: { x: number; y: number };
  peak: number;
}

export class ToastLauncher extends Microgame {
  meta = ToastMeta;
  private toasty!: Critter;
  private flyers: Flyer[] = [];
  private caught = 0;
  private total = 3;
  private spawned = 0;
  private stack: Phaser.GameObjects.Graphics[] = [];
  private toasterG!: Phaser.GameObjects.Graphics;
  private counterTxt!: Phaser.GameObjects.Text;
  private plan: Array<{ at: number; fake: boolean }> = [];
  private elapsed = 0;

  build() {
    const g = this.gfx();
    drawRoom(g, 0xfbe7c9, 0xd8b98a, FLOOR);
    // counter
    g.fillStyle(C.grey, 1);
    g.lineStyle(5, C.charcoal, 1);
    g.fillRoundedRect(80, 500, 300, 30, 8);
    g.strokeRoundedRect(80, 500, 300, 30, 8);
    g.fillStyle(C.violet, 1);
    g.fillRect(90, 530, 280, FLOOR - 530);
    g.strokeRect(90, 530, 280, FLOOR - 530);
    // modified toaster with rocket + wires
    this.toasterG = this.gfx();
    const t = this.toasterG;
    t.fillStyle(C.tomato, 1);
    t.lineStyle(5, C.charcoal, 1);
    t.fillRoundedRect(TOASTER.x - 70, TOASTER.y - 40, 140, 80, 16);
    t.strokeRoundedRect(TOASTER.x - 70, TOASTER.y - 40, 140, 80, 16);
    t.fillStyle(C.charcoal, 1);
    t.fillRoundedRect(TOASTER.x - 50, TOASTER.y - 46, 40, 12, 4);
    t.fillRoundedRect(TOASTER.x + 10, TOASTER.y - 46, 40, 12, 4);
    // rocket booster on the side
    t.fillStyle(C.greyDark, 1);
    t.fillRoundedRect(TOASTER.x - 100, TOASTER.y - 10, 40, 50, 8);
    t.strokeRoundedRect(TOASTER.x - 100, TOASTER.y - 10, 40, 50, 8);
    t.fillStyle(C.mustard, 1);
    t.fillTriangle(TOASTER.x - 92, TOASTER.y + 40, TOASTER.x - 68, TOASTER.y + 40, TOASTER.x - 80, TOASTER.y + 70);
    // warning label
    t.fillStyle(C.mustard, 1);
    t.fillRect(TOASTER.x - 30, TOASTER.y + 6, 60, 18);
    t.fillStyle(C.charcoal, 1);
    for (let i = 0; i < 4; i++) t.fillRect(TOASTER.x - 28 + i * 16, TOASTER.y + 6, 6, 18);
    this.text(TOASTER.x, TOASTER.y - 80, 'DO NOT MODIFY', { size: 14, color: C.charcoal, strokeWidth: 0, shadow: false }).setAlpha(0.6);

    this.toasty = this.critter('toasty', TOASTY_X, FLOOR - 48, 1);
    this.toasty.look(-1, 0);
    this.toasty.setMood('scared');

    this.total = Math.round(this.lerpD(2, 5));
    const window = this.ctx.duration * 0.62;
    const nFake = this.d > 0.55 ? (this.d > 0.85 ? 2 : 1) : 0;
    const events = this.total + nFake;
    for (let i = 0; i < events; i++) this.plan.push({ at: 250 + (i / events) * window + Math.random() * 150, fake: false });
    // assign fakes to non-first slots
    const idxs = Phaser.Utils.Array.Shuffle(this.plan.map((_, i) => i).filter((i) => i > 0));
    for (let i = 0; i < nFake; i++) this.plan[idxs[i]].fake = true;
    this.counterTxt = this.text(640, 104, `0 / ${this.total}`, { size: 30, color: C.mustard });
    if (nFake > 0) this.text(640, 136, 'not the bricks', { size: 16, color: C.tomato, strokeWidth: 0, shadow: false }).setAlpha(0.8);
  }

  begin() {
    super.begin();
  }

  private launch(fake: boolean) {
    audio.sfx(fake ? 'thud' : 'pop', 1.1);
    this.tween({ targets: this.toasterG, y: -14, duration: 60, yoyo: true });
    puff(this.scene, this.root, TOASTER.x, TOASTER.y - 50, 3, C.white, 10);
    const c = this.scene.add.container(TOASTER.x, TOASTER.y - 50);
    const g = this.scene.add.graphics();
    if (fake) drawBrick(g, 0, 0, 1);
    else drawToast(g, 0, 0, 1);
    c.add(g);
    c.setInteractive(new Phaser.Geom.Rectangle(-60, -60, 120, 120), Phaser.Geom.Rectangle.Contains);
    this.root.add(c);
    const f: Flyer = {
      c,
      t: 0,
      dur: this.lerpD(1.7, 0.95) * (fake ? 1.1 : 1) * 1000,
      fake,
      done: false,
      from: { x: TOASTER.x, y: TOASTER.y - 50 },
      to: fake ? { x: TOASTY_X + 120, y: FLOOR - 200 } : { x: TOASTY_X - 10, y: FLOOR - 80 },
      peak: Phaser.Math.Between(120, 260),
    };
    c.on('pointerdown', () => this.catch(f));
    this.flyers.push(f);
    this.spawned++;
  }

  private catch(f: Flyer) {
    if (this.done || f.done) return;
    f.done = true;
    f.c.disableInteractive();
    if (f.fake) {
      audio.sfx('wrong');
      this.tween({ targets: f.c, x: TOASTY_X, y: FLOOR - 120, duration: 120, onComplete: () => this.lose() });
      return;
    }
    audio.sfx('correct', 1 + this.caught * 0.1);
    this.caught++;
    this.counterTxt.setText(`${this.caught} / ${this.total}`);
    squash(this.scene, this.counterTxt, 1.3, 1.3, 80);
    // zips to the stack above Toasty's head
    const sy = FLOOR - 48 - 60 - this.stack.length * 22;
    this.tween({
      targets: f.c,
      x: TOASTY_X,
      y: sy,
      angle: 0,
      scale: 0.7,
      duration: 160,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.stack.push(f.c.list[0] as Phaser.GameObjects.Graphics);
        this.toasty.squash(1.1, 0.9, 80);
        audio.sfx('plop', 1.2);
      },
    });
    this.toasty.setMood(this.caught >= this.total ? 'happy' : 'surprised');
    if (this.caught >= this.total) this.after(200, () => this.win());
  }

  update(_t: number, delta: number) {
    if (!this.started || this.done) return;
    this.elapsed += delta;
    while (this.spawned < this.plan.length && this.elapsed >= this.plan[this.spawned].at) {
      this.launch(this.plan[this.spawned].fake);
    }
    for (const f of this.flyers) {
      if (f.done) continue;
      f.t += delta / f.dur;
      const t = Math.min(1, f.t);
      const x = Phaser.Math.Linear(f.from.x, f.to.x, t);
      const y = Phaser.Math.Linear(f.from.y, f.to.y, t) - Math.sin(t * Math.PI) * f.peak;
      f.c.setPosition(x, y);
      f.c.angle += (f.fake ? 200 : 520) * (delta / 1000);
      if (t >= 1) {
        f.done = true;
        if (f.fake) {
          // sails past harmlessly
          this.tween({ targets: f.c, x: W + 100, y: FLOOR + 100, duration: 400, onComplete: () => f.c.destroy() });
        } else {
          this.lose();
          return;
        }
      }
    }
  }

  onWin(): number {
    audio.sfx('success');
    audio.vocal('happy', 0.8);
    this.toasty.setMood('smug');
    this.tween({ targets: this.toasty.inner, angle: { from: -3, to: 3 }, duration: 200, yoyo: true, repeat: 3 });
    this.caption('BREAKFAST!', C.mustard);
    return 1100;
  }

  onLose(): number {
    audio.sfx('hit');
    audio.sfx('aah', 0.8);
    this.scene.shakeCam(0.012, 200);
    this.toasty.stopIdle();
    puff(this.scene, this.root, TOASTY_X, FLOOR - 80, 8, C.creamDark, 20);
    for (const f of this.flyers) if (!f.done) f.c.destroy();
    // stack scatters
    for (const s of this.stack) this.tween({ targets: s, y: '+=200', x: '+=' + Phaser.Math.Between(-100, 100), angle: 360, duration: 400 });
    this.toasty.spinOut(1, -1, 650);
    this.after(500, () => audio.sfx('whoosh'));
    this.after(800, () => this.caption('TOASTED.', C.tomato));
    return 1500;
  }
}
