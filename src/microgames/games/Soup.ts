import Phaser from 'phaser';
import { Microgame, W, H, type MicrogameMeta } from '../Microgame';
import { C } from '../../core/Palette';
import { drawRoom } from '../../entities/Props';
import { audio } from '../../core/Audio';
import type { Critter } from '../../entities/Critter';

export const SoupMeta: MicrogameMeta = {
  id: 'soup',
  name: 'Soup Disaster',
  instruction: 'BALANCE!',
  mechanic: 'Left / right balance',
  group: 'balance-keys',
  baseDuration: 7000,
  timeoutWins: false,
  character: 'rondo',
  accident: { name: 'Soup of the Day', desc: 'Became an ingredient.' },
};

const FLOOR = 600;
const TABLE_X = 1010;
const MAX_ANGLE = 0.78;

export class SoupDisaster extends Microgame {
  meta = SoupMeta;
  private rondo!: Critter;
  private pot!: Phaser.GameObjects.Container;
  private soupG!: Phaser.GameObjects.Graphics;
  private theta = 0;
  private omega = 0;
  private x = 200;
  private speed = 130;
  private gravity = 3.5;
  private torque = 7;
  private time = 0;
  private nextKick = 0.8;
  private kickMag = 0.3;
  private hold: 'left' | 'right' | null = null;
  private pads!: { l: Phaser.GameObjects.Text; r: Phaser.GameObjects.Text };

  build() {
    const g = this.gfx();
    drawRoom(g, 0xfff1d6, 0xd9c7a8, FLOOR);
    // kitchen tiles
    g.fillStyle(C.mint, 0.5);
    for (let x = 0; x < W; x += 60) for (let y = 300; y < FLOOR; y += 60) if ((x / 60 + y / 60) % 2 === 0) g.fillRect(x, y, 60, 60);
    // table
    g.fillStyle(C.wood, 1);
    g.lineStyle(5, C.charcoal, 1);
    g.fillRoundedRect(TABLE_X - 20, 400, 240, 26, 8);
    g.strokeRoundedRect(TABLE_X - 20, 400, 240, 26, 8);
    g.fillRect(TABLE_X, 426, 18, FLOOR - 426);
    g.fillRect(TABLE_X + 180, 426, 18, FLOOR - 426);
    g.strokeRect(TABLE_X, 426, 18, FLOOR - 426);
    g.strokeRect(TABLE_X + 180, 426, 18, FLOOR - 426);
    // hungry guests
    const guest = this.critter('nubbin', TABLE_X + 190, 430 - 52, 0.8);
    guest.look(-1, 0);
    guest.setMood('happy');
    this.text(TABLE_X + 100, 360, 'TABLE 1', { size: 18, color: C.charcoal, strokeWidth: 0, shadow: false }).setAlpha(0.6);

    this.rondo = this.critter('rondo', this.x, FLOOR - 58, 1);
    this.rondo.walk(true);
    this.rondo.drawArms(1);
    this.rondo.look(0, -1);

    // pot on a tray held above head
    this.pot = this.scene.add.container(this.x, FLOOR - 190);
    const pg = this.scene.add.graphics();
    pg.fillStyle(C.charcoal, 1);
    pg.fillRect(-70, 40, 140, 10); // tray
    pg.fillStyle(C.greyDark, 1);
    pg.lineStyle(5, C.charcoal, 1);
    pg.fillRoundedRect(-60, -40, 120, 80, { tl: 6, tr: 6, bl: 24, br: 24 });
    pg.strokeRoundedRect(-60, -40, 120, 80, { tl: 6, tr: 6, bl: 24, br: 24 });
    pg.fillRect(-80, -30, 20, 12);
    pg.fillRect(60, -30, 20, 12);
    pg.strokeRect(-80, -30, 20, 12);
    pg.strokeRect(60, -30, 20, 12);
    this.soupG = this.scene.add.graphics();
    this.pot.add([pg, this.soupG]);
    this.root.add(this.pot);
    // steam
    for (let i = 0; i < 3; i++) {
      const s = this.scene.add.graphics();
      s.lineStyle(4, C.white, 0.8);
      s.beginPath();
      s.moveTo(0, 0);
      s.lineTo(6, -14);
      s.lineTo(-4, -28);
      s.lineTo(4, -42);
      s.strokePath();
      s.setPosition(-30 + i * 30, -44);
      this.pot.add(s);
      this.tween({ targets: s, y: -70, alpha: 0, duration: 900, delay: i * 250, repeat: -1 });
    }

    const padsObj = this.sidePads('◀', '▶');
    this.pads = { l: padsObj.l, r: padsObj.r };

    this.speed = 800 / ((this.ctx.duration / 1000) * 0.72);
    this.gravity = this.lerpD(3.0, 5.6);
    this.torque = this.lerpD(6.5, 8.5);
    this.kickMag = this.lerpD(0.25, 0.8);
    this.drawSoup();
  }

  begin() {
    super.begin();
    this.input.onSide((side) => {
      this.omega += side === 'left' ? -0.55 : 0.55;
      this.hold = side;
      audio.sfx('tick', side === 'left' ? 0.8 : 1.1);
      (side === 'left' ? this.pads.l : this.pads.r).setAlpha(0.9);
    });
    this.input.onUp(() => (this.hold = null));
    this.input.onKeyUp((k) => {
      if (k === this.hold) this.hold = null;
    });
  }

  update(_t: number, delta: number) {
    if (!this.started || this.done) return;
    const dt = Math.min(0.05, delta / 1000);
    this.time += dt;
    // control: continuous torque while held (pointer or keys)
    let u = 0;
    if (this.input.isDown('left')) u -= 1;
    if (this.input.isDown('right')) u += 1;
    if (this.input.pointerDown && this.hold) u += this.hold === 'left' ? -1 : 1;
    this.omega += (this.gravity * Math.sin(this.theta) + u * this.torque) * dt;
    this.omega *= 1 - 0.8 * dt;
    // random kicks
    this.nextKick -= dt;
    if (this.nextKick <= 0) {
      this.nextKick = Phaser.Math.FloatBetween(0.6, 1.2);
      this.omega += (Math.random() < 0.5 ? -1 : 1) * this.kickMag * Phaser.Math.FloatBetween(0.5, 1);
    }
    this.theta += this.omega * dt;
    // walking
    this.x += this.speed * dt;
    this.rondo.x = this.x;
    this.pot.setPosition(this.x + Math.sin(this.theta) * 20, FLOOR - 190 + Math.sin(this.time * 14) * 3);
    this.pot.setRotation(this.theta);
    this.rondo.inner.setRotation(this.theta * 0.25);
    this.drawSoup();
    this.pads.l.setAlpha(u < 0 ? 0.9 : 0.35);
    this.pads.r.setAlpha(u > 0 ? 0.9 : 0.35);
    const danger = Math.abs(this.theta) / MAX_ANGLE;
    this.rondo.setMood(danger > 0.6 ? 'scared' : 'focus');
    if (Math.abs(this.theta) > MAX_ANGLE) {
      this.lose();
      return;
    }
    if (this.x >= TABLE_X - 70) this.win();
  }

  private drawSoup() {
    const g = this.soupG;
    g.clear();
    // soup surface stays level in world space: counter-rotate
    g.fillStyle(C.soup, 1);
    const tilt = -this.theta;
    const lvl = -28;
    const pts = [
      new Phaser.Geom.Point(-52, lvl - Math.tan(tilt) * -52),
      new Phaser.Geom.Point(52, lvl - Math.tan(tilt) * 52),
      new Phaser.Geom.Point(52, -10),
      new Phaser.Geom.Point(-52, -10),
    ];
    g.fillPoints(pts, true);
    g.fillStyle(C.tomato, 1);
    g.fillCircle(-20, lvl + 4, 6);
    g.fillStyle(C.mint, 1);
    g.fillCircle(18, lvl + 6, 5);
    // drips when tilted
    const spill = Math.max(0, Math.abs(this.theta) - 0.35);
    if (spill > 0) {
      g.fillStyle(C.soup, 1);
      const side = this.theta > 0 ? 1 : -1;
      g.fillEllipse(side * 62, -30 + spill * 40, 12, 20 + spill * 40);
    }
  }

  onWin(): number {
    this.rondo.walk(false);
    audio.sfx('ding');
    this.tween({ targets: this.pot, x: TABLE_X + 90, y: 400 - 50, rotation: 0, duration: 350, ease: 'Quad.easeOut' });
    this.rondo.inner.setRotation(0);
    this.after(350, () => {
      audio.sfx('success');
      audio.vocal('happy', 0.6);
      this.rondo.celebrate();
      this.caption('SERVED!', C.mustard);
    });
    return 1200;
  }

  onLose(): number {
    this.rondo.walk(false);
    this.rondo.setMood('scream');
    audio.sfx('aah', 0.6);
    const side = this.theta > 0 ? 1 : -1;
    // pot flies
    this.tween({ targets: this.pot, x: this.pot.x + side * 200, y: 60, angle: side * 200, duration: 450, ease: 'Quad.easeOut' });
    this.tween({ targets: this.pot, y: 200, duration: 400, delay: 450, ease: 'Quad.easeIn' });
    // soup rains down and covers everything
    this.after(500, () => {
      audio.sfx('splash');
      this.scene.shakeCam(0.008, 200);
      const drops = this.gfx();
      drops.fillStyle(C.soup, 1);
      for (let i = 0; i < 20; i++) drops.fillCircle(Phaser.Math.Between(0, W), Phaser.Math.Between(-200, 0), Phaser.Math.Between(14, 40));
      this.tween({ targets: drops, y: H + 200, duration: 500, ease: 'Quad.easeIn' });
      const cover = this.gfx();
      cover.fillStyle(C.soup, 1);
      cover.fillRect(0, -H, W, H);
      this.tween({ targets: cover, y: H, duration: 550, delay: 100, ease: 'Quad.easeIn' });
    });
    // reveal: Rondo in a bowl
    this.after(1250, () => {
      const bowl = this.scene.add.container(W / 2, H + 200);
      const bg = this.scene.add.graphics();
      bg.fillStyle(C.white, 1);
      bg.lineStyle(6, C.charcoal, 1);
      bg.fillEllipse(0, 0, 420, 160);
      bg.strokeEllipse(0, 0, 420, 160);
      bg.fillStyle(C.soup, 1);
      bg.fillEllipse(0, -8, 380, 110);
      bg.fillStyle(C.mint, 1);
      bg.fillCircle(-120, -10, 12);
      bg.fillCircle(130, 0, 10);
      bg.fillStyle(C.tomato, 1);
      bg.fillCircle(80, -20, 12);
      bowl.add(bg);
      this.root.add(bowl);
      this.rondo.setVisible(false);
      const r2 = this.critter('rondo', W / 2, H + 200 - 70, 1);
      r2.setMood('hurt');
      r2.setBodyColor(C.soup);
      this.tween({ targets: [bowl, r2], y: '-=380', duration: 500, ease: 'Back.easeOut' });
      audio.sfx('plop', 0.6);
      this.after(500, () => {
        this.caption('SOUP OF THE DAY.', C.white, 110);
        audio.sfx('hm', 0.7);
      });
    });
    return 2200;
  }
}
