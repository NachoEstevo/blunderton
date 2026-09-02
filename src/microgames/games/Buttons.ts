import Phaser from 'phaser';
import { Microgame, W, H, type MicrogameMeta } from '../Microgame';
import { C } from '../../core/Palette';
import { drawRoom, drawStar, drawItem, confetti, puff } from '../../entities/Props';
import { audio } from '../../core/Audio';
import type { Critter } from '../../entities/Critter';

export const ButtonsMeta: MicrogameMeta = {
  id: 'buttons',
  name: 'Wrong Buttons',
  instruction: 'PRESS IT!',
  mechanic: 'Reaction + inhibition',
  group: 'targets',
  baseDuration: 6000,
  timeoutWins: false,
  character: 'twitch',
  accident: { name: 'Knockout', desc: 'Pressed the wrong button. Met the glove.' },
};

const FLOOR = 610;
const SHAPES = ['circle', 'square', 'tri', 'star', 'diamond', 'hex'] as const;
const COLORS = [C.tomato, C.sky, C.mustard, C.mint, C.pink, C.violet, C.orange, C.lime, C.white];

interface Btn {
  c: Phaser.GameObjects.Container;
  shape: (typeof SHAPES)[number];
  color: number;
  home: { x: number; y: number };
}

export class WrongButtons extends Microgame {
  meta = ButtonsMeta;
  private twitch!: Critter;
  private btns: Btn[] = [];
  private target = 0;
  private rounds = 1;
  private doneRounds = 0;
  private screenG!: Phaser.GameObjects.Graphics;
  private screenIcon!: Phaser.GameObjects.Graphics;
  private lamp!: Phaser.GameObjects.Graphics;
  private pressTxt!: Phaser.GameObjects.Text;
  private hitByTimeout = false;

  build() {
    const g = this.gfx();
    drawRoom(g, 0xd8dee0, 0x7f8a92, FLOOR);
    // panel
    g.fillStyle(C.charcoal, 1);
    g.fillRoundedRect(470, 90, 720, 500, 24);
    g.fillStyle(C.greyDark, 1);
    g.lineStyle(5, C.charcoal, 1);
    g.fillRoundedRect(480, 100, 700, 480, 20);
    g.strokeRoundedRect(480, 100, 700, 480, 20);
    // bolts
    g.fillStyle(C.grey, 1);
    for (const [x, y] of [[500, 120], [1160, 120], [500, 560], [1160, 560]]) g.fillCircle(x, y, 7);
    // screen
    this.screenG = this.gfx();
    this.screenG.fillStyle(0x1c2b2a, 1);
    this.screenG.lineStyle(4, C.charcoal, 1);
    this.screenG.fillRoundedRect(520, 120, 620, 110, 10);
    this.screenG.strokeRoundedRect(520, 120, 620, 110, 10);
    this.pressTxt = this.text(700, 175, 'PRESS THIS  ➜', { size: 30, color: C.mint });
    this.screenIcon = this.gfx();
    this.lamp = this.gfx();
    // wall hatch (the glove lives here)
    g.fillStyle(C.tomatoDark, 1);
    g.fillRoundedRect(1200, 300, 70, 160, 8);
    g.strokeRoundedRect(1200, 300, 70, 160, 8);
    this.text(1235, 285, 'DO NOT', { size: 12, color: C.charcoal, strokeWidth: 0, shadow: false }).setAlpha(0.7);

    this.twitch = this.critter('twitch', 300, FLOOR - 42, 1.05);
    this.twitch.look(1, -0.4);
    this.twitch.setMood('focus');
    this.twitch.drawArms(1);

    const n = Math.round(this.lerpD(6, 9));
    const cols = 3;
    const rows = Math.ceil(n / cols);
    const combos: Array<[(typeof SHAPES)[number], number]> = [];
    const shapeOrder = Phaser.Utils.Array.Shuffle([...SHAPES]);
    const colorOrder = Phaser.Utils.Array.Shuffle([...COLORS]);
    for (let i = 0; i < n; i++) combos.push([shapeOrder[i % shapeOrder.length], colorOrder[i % colorOrder.length]]);
    for (let i = 0; i < n; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 600 + col * 230;
      const y = 300 + row * (rows === 2 ? 170 : 110) + (rows === 2 ? 0 : -20);
      const c = this.scene.add.container(x, y);
      const bg = this.scene.add.graphics();
      bg.fillStyle(C.charcoal, 1);
      bg.fillCircle(0, 8, 52);
      bg.fillStyle(combos[i][1], 1);
      bg.lineStyle(4, C.charcoal, 1);
      bg.fillCircle(0, 0, 52);
      bg.strokeCircle(0, 0, 52);
      bg.fillStyle(0xffffff, 0.25);
      bg.fillEllipse(-14, -20, 26, 14);
      const icon = this.scene.add.graphics();
      this.drawShape(icon, combos[i][0], C.charcoal, 0, 0, 1);
      c.add([bg, icon]);
      c.setInteractive(new Phaser.Geom.Rectangle(-60, -60, 120, 120), Phaser.Geom.Rectangle.Contains);
      this.root.add(c);
      this.btns.push({ c, shape: combos[i][0], color: combos[i][1], home: { x, y } });
    }
    this.rounds = this.d < 0.5 ? 1 : 2;
    this.pickTarget();
  }

  private drawShape(g: Phaser.GameObjects.Graphics, shape: (typeof SHAPES)[number], color: number, x: number, y: number, s: number) {
    g.fillStyle(color, 1);
    g.lineStyle(3 * s, C.charcoal, 1);
    const r = 22 * s;
    switch (shape) {
      case 'circle':
        g.fillCircle(x, y, r);
        break;
      case 'square':
        g.fillRect(x - r, y - r, r * 2, r * 2);
        break;
      case 'tri':
        g.fillTriangle(x - r, y + r * 0.8, x + r, y + r * 0.8, x, y - r);
        break;
      case 'star':
        drawStar(g, x, y, 5, r * 1.15, r * 0.5);
        break;
      case 'diamond':
        g.fillPoints([new Phaser.Geom.Point(x, y - r * 1.2), new Phaser.Geom.Point(x + r, y), new Phaser.Geom.Point(x, y + r * 1.2), new Phaser.Geom.Point(x - r, y)], true);
        break;
      case 'hex': {
        const pts: Phaser.Geom.Point[] = [];
        for (let i = 0; i < 6; i++) pts.push(new Phaser.Geom.Point(x + Math.cos((i / 6) * Math.PI * 2) * r, y + Math.sin((i / 6) * Math.PI * 2) * r));
        g.fillPoints(pts, true);
        break;
      }
    }
  }

  private pickTarget() {
    let t = Phaser.Math.Between(0, this.btns.length - 1);
    if (t === this.target && this.doneRounds > 0) t = (t + 1) % this.btns.length;
    this.target = t;
    const b = this.btns[t];
    this.screenIcon.clear();
    // show the target as a colored disc with the shape, like the real button
    this.screenIcon.fillStyle(b.color, 1);
    this.screenIcon.lineStyle(4, C.charcoal, 1);
    this.screenIcon.fillCircle(960, 175, 40);
    this.screenIcon.strokeCircle(960, 175, 40);
    this.drawShape(this.screenIcon, b.shape, C.charcoal, 960, 175, 0.85);
    this.tween({ targets: this.screenIcon, alpha: { from: 0.2, to: 1 }, duration: 120, yoyo: true, repeat: 2 });
    audio.sfx('ping', 1.2);
  }

  begin() {
    super.begin();
    this.btns.forEach((b, i) => b.c.on('pointerdown', () => this.press(i)));
    // distractions
    if (this.d > 0.35) {
      this.every(this.lerpD(700, 380), () => {
        const b = this.btns[Phaser.Math.Between(0, this.btns.length - 1)];
        this.tween({ targets: b.c, scale: 1.15, duration: 110, yoyo: true });
      });
    }
    if (this.d > 0.6) {
      this.every(this.lerpD(1300, 800), () => {
        const a = this.btns[Phaser.Math.Between(0, this.btns.length - 1)];
        let bb = this.btns[Phaser.Math.Between(0, this.btns.length - 1)];
        if (bb === a) bb = this.btns[(this.btns.indexOf(a) + 1) % this.btns.length];
        const ah = { ...a.home };
        const bh = { ...bb.home };
        a.home = bh;
        bb.home = ah;
        this.tween({ targets: a.c, x: bh.x, y: bh.y, duration: 350, ease: 'Sine.easeInOut' });
        this.tween({ targets: bb.c, x: ah.x, y: ah.y, duration: 350, ease: 'Sine.easeInOut' });
        audio.sfx('whoosh', 1.6);
      });
    }
  }

  private press(i: number) {
    if (this.done) return;
    const b = this.btns[i];
    this.tween({ targets: b.c, scaleY: 0.8, scaleX: 1.1, duration: 70, yoyo: true });
    this.twitch.squash(1.1, 0.9, 70);
    if (i === this.target) {
      audio.sfx('correct', 1 + this.doneRounds * 0.2);
      this.doneRounds++;
      this.lamp.clear();
      this.lamp.fillStyle(C.mint, 1);
      this.lamp.fillCircle(1120, 175, 14);
      if (this.doneRounds >= this.rounds) this.win();
      else this.after(150, () => this.pickTarget());
    } else {
      audio.sfx('wrong');
      this.hitByTimeout = false;
      this.lose();
    }
  }

  onTimeout() {
    this.hitByTimeout = true;
    this.lose();
  }

  onWin(): number {
    audio.sfx('success');
    // machine works: a conveyor pushes out a rubber duck with a crown
    const duck = this.gfx();
    drawItem(duck, 'duck', 0, 0, 1.3);
    duck.fillStyle(0xffe066, 1);
    duck.lineStyle(3, C.charcoal, 1);
    duck.fillTriangle(0, -40, 20, -40, 10, -60);
    duck.fillTriangle(20, -40, 40, -40, 30, -60);
    duck.fillRect(0, -44, 40, 8);
    duck.setPosition(1120, 560);
    this.tween({ targets: duck, x: 1050, y: FLOOR - 40, duration: 500, ease: 'Bounce.easeOut' });
    audio.sfx('plop');
    this.after(400, () => {
      audio.vocal('happy', 1.4);
      this.twitch.celebrate();
      confetti(this.scene, this.root, 830, 300, [C.mint, C.sky, C.mustard], 14, 260);
      this.caption('IT WORKS!', C.mint);
    });
    return 1200;
  }

  onLose(): number {
    audio.sfx('alarm');
    this.lamp.clear();
    this.lamp.fillStyle(C.tomato, 1);
    this.lamp.fillCircle(1120, 175, 14);
    this.twitch.stopIdle();
    this.twitch.setMood('scared');
    this.twitch.look(1, 0);
    if (this.hitByTimeout) {
      this.screenIcon.clear();
      this.pressTxt.setText('TOO SLOW').setColor('#e84a3a').setX(830);
    } else {
      this.pressTxt.setText('WRONG!').setColor('#e84a3a');
    }
    // hatch opens; a giant boxing glove on a spring punches Twitch off-screen
    this.after(450, () => {
      audio.sfx('boing', 0.6);
      const glove = this.scene.add.container(1235, 380);
      const gg = this.scene.add.graphics();
      // spring
      gg.lineStyle(8, C.charcoal, 1);
      gg.beginPath();
      for (let i = 0; i < 12; i++) gg.lineTo(i * 20, i % 2 ? -20 : 20);
      gg.strokePath();
      const fist = this.scene.add.graphics();
      fist.fillStyle(C.tomato, 1);
      fist.lineStyle(6, C.charcoal, 1);
      fist.fillRoundedRect(-80, -70, 150, 140, 50);
      fist.strokeRoundedRect(-80, -70, 150, 140, 50);
      fist.fillRoundedRect(-20, 40, 90, 50, 20);
      fist.strokeRoundedRect(-20, 40, 90, 50, 20);
      fist.fillStyle(C.white, 1);
      fist.fillRoundedRect(-60, -40, 20, 60, 8);
      glove.add([gg, fist]);
      glove.setScale(-0.2, 1);
      this.root.add(glove);
      this.tween({
        targets: glove,
        scaleX: -1,
        x: 1235,
        duration: 260,
        ease: 'Quad.easeIn',
        onComplete: () => {
          // spring extends: glove flies across
          this.tween({ targets: glove, x: 420, duration: 160, ease: 'Quad.easeIn', onComplete: () => {
            audio.sfx('hit');
            audio.sfx('aah', 1.5);
            this.scene.shakeCam(0.02, 300);
            puff(this.scene, this.root, 320, FLOOR - 60, 8, C.creamDark, 22);
            this.twitch.spinOut(-1, -0.6, 600);
            this.tween({ targets: glove, x: 1235, duration: 500, delay: 200, ease: 'Sine.easeInOut' });
            this.after(500, () => this.caption('KNOCKOUT.', C.tomato));
          } });
        },
      });
    });
    return 2000;
  }
}

