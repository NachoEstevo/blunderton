import Phaser from 'phaser';
import { Microgame, W, type MicrogameMeta } from '../Microgame';
import { C } from '../../core/Palette';
import { drawRoom, drawItem, drawHeart, puff, FOODS, JUNK, type ItemKind } from '../../entities/Props';
import { audio } from '../../core/Audio';
import type { Critter } from '../../entities/Critter';

export const PlantMeta: MicrogameMeta = {
  id: 'plant',
  name: 'Hungry Plant',
  instruction: 'FEED IT!',
  mechanic: 'Drag the right things',
  group: 'dragdrop',
  baseDuration: 7500,
  timeoutWins: false,
  character: 'twitch',
  accident: { name: 'Fertilizer', desc: 'Eaten by a houseplant. Burped a shoe.' },
};

const FLOOR = 600;
const TWITCH_X = 260;
const POT_X = 1040;

interface Item {
  c: Phaser.GameObjects.Container;
  kind: ItemKind;
  food: boolean;
  home: { x: number; y: number };
  used: boolean;
}

export class HungryPlant extends Microgame {
  meta = PlantMeta;
  private twitch!: Critter;
  private head!: Phaser.GameObjects.Container;
  private mouthG!: Phaser.GameObjects.Graphics;
  private stemG!: Phaser.GameObjects.Graphics;
  private items: Item[] = [];
  private fed = 0;
  private need = 2;
  private headX = 900;
  private headY = 330;
  private lunge = 0; // extra approach from mistakes
  private time = 0;
  private mouthOpen = 0.3;
  private counterTxt!: Phaser.GameObjects.Text;

  build() {
    const g = this.gfx();
    drawRoom(g, 0xeaf3dc, 0xcdb591, FLOOR);
    // shelf
    g.fillStyle(C.wood, 1);
    g.lineStyle(5, C.charcoal, 1);
    g.fillRoundedRect(300, 150, 740, 22, 6);
    g.strokeRoundedRect(300, 150, 740, 22, 6);
    g.fillRect(330, 172, 14, 30);
    g.fillRect(996, 172, 14, 30);
    // window
    g.fillStyle(C.skyLight, 1);
    g.fillRoundedRect(80, 120, 160, 200, 12);
    g.strokeRoundedRect(80, 120, 160, 200, 12);
    g.lineBetween(160, 120, 160, 320);
    g.lineBetween(80, 220, 240, 220);
    // pot
    g.fillStyle(C.tomatoDark, 1);
    g.fillRoundedRect(POT_X - 70, FLOOR - 120, 140, 120, { tl: 8, tr: 8, bl: 30, br: 30 });
    g.strokeRoundedRect(POT_X - 70, FLOOR - 120, 140, 120, { tl: 8, tr: 8, bl: 30, br: 30 });
    g.fillStyle(C.tomato, 1);
    g.fillRoundedRect(POT_X - 80, FLOOR - 130, 160, 30, 8);
    g.strokeRoundedRect(POT_X - 80, FLOOR - 130, 160, 30, 8);

    this.twitch = this.critter('twitch', TWITCH_X, FLOOR - 42, 1.05);
    this.twitch.look(1, 0);
    this.twitch.setMood('scared');

    this.stemG = this.gfx();
    this.head = this.scene.add.container(this.headX, this.headY);
    const hg = this.scene.add.graphics();
    // leaves
    hg.fillStyle(C.mintDark, 1);
    hg.lineStyle(5, C.charcoal, 1);
    hg.fillEllipse(-70, -20, 70, 34);
    hg.strokeEllipse(-70, -20, 70, 34);
    hg.fillEllipse(-60, 30, 70, 34);
    hg.strokeEllipse(-60, 30, 70, 34);
    this.mouthG = this.scene.add.graphics();
    this.head.add([hg, this.mouthG]);
    this.root.add(this.head);
    this.drawMouth();

    // items on the shelf
    this.need = this.d < 0.5 ? 2 : 3;
    const nItems = Math.round(this.lerpD(4, 7));
    const foodsAvail = Phaser.Utils.Array.Shuffle([...FOODS]);
    const junkAvail = Phaser.Utils.Array.Shuffle([...JUNK]);
    const kinds: Array<[ItemKind, boolean]> = [];
    const nFood = Math.min(FOODS.length, this.need + (this.d > 0.6 ? 0 : 1));
    for (let i = 0; i < nFood; i++) kinds.push([foodsAvail[i], true]);
    while (kinds.length < nItems) kinds.push([junkAvail[kinds.length % junkAvail.length], false]);
    Phaser.Utils.Array.Shuffle(kinds);
    kinds.forEach(([kind, food], i) => {
      const x = 360 + ((i + 0.5) / kinds.length) * 620;
      const y = 120;
      const c = this.scene.add.container(x, y);
      const ig = this.scene.add.graphics();
      drawItem(ig, kind, 0, 0, 1);
      c.add(ig);
      c.setInteractive(new Phaser.Geom.Rectangle(-55, -55, 110, 110), Phaser.Geom.Rectangle.Contains);
      this.root.add(c);
      this.items.push({ c, kind, food, home: { x, y }, used: false });
    });
    this.counterTxt = this.text(160, 372, this.counterText(), { size: 28, color: C.mintDark });
    this.text(160, 404, 'drag food to the plant', { size: 15, color: C.charcoal, strokeWidth: 0, shadow: false }).setAlpha(0.55);
  }

  private counterText() {
    return `${this.fed} / ${this.need} FED`;
  }

  private drawMouth() {
    const g = this.mouthG;
    g.clear();
    const open = this.mouthOpen;
    g.fillStyle(C.mint, 1);
    g.lineStyle(5, C.charcoal, 1);
    // upper jaw
    g.fillRoundedRect(-60, -70 - open * 30, 120, 70, { tl: 40, tr: 40, bl: 4, br: 4 });
    g.strokeRoundedRect(-60, -70 - open * 30, 120, 70, { tl: 40, tr: 40, bl: 4, br: 4 });
    // lower jaw
    g.fillRoundedRect(-60, open * 30, 120, 60, { tl: 4, tr: 4, bl: 40, br: 40 });
    g.strokeRoundedRect(-60, open * 30, 120, 60, { tl: 4, tr: 4, bl: 40, br: 40 });
    // mouth interior
    g.fillStyle(C.tomatoDark, 1);
    g.fillRect(-56, -open * 30, 112, open * 60);
    // teeth
    g.fillStyle(C.white, 1);
    for (let i = -44; i <= 44; i += 22) {
      g.fillTriangle(i - 8, -open * 30, i + 8, -open * 30, i, -open * 30 + 16);
      g.fillTriangle(i - 8 + 11, open * 30, i + 8 + 11, open * 30, i + 11, open * 30 - 16);
    }
    // eyes on the jaw
    g.fillStyle(C.white, 1);
    g.fillCircle(-30, -50 - open * 30, 10);
    g.fillCircle(30, -50 - open * 30, 10);
    g.fillStyle(C.charcoal, 1);
    g.fillCircle(-33, -50 - open * 30, 5);
    g.fillCircle(27, -50 - open * 30, 5);
  }

  begin() {
    super.begin();
    for (const it of this.items) {
      this.input.draggable(it.c, {
        onStart: () => {
          audio.sfx('tap', 0.8);
          this.root.bringToTop(it.c);
          this.scene.tweens.add({ targets: it.c, scale: 1.15, duration: 80 });
        },
        onDrag: (x, y) => it.c.setPosition(x, y),
        onDrop: (x, y) => this.drop(it, x, y),
      });
    }
  }

  private drop(it: Item, x: number, y: number) {
    if (this.done || it.used) return;
    const mx = this.head.x - 10;
    const my = this.head.y;
    if (Math.hypot(x - mx, y - my) < 110) {
      it.used = true;
      it.c.disableInteractive();
      if (it.food) {
        this.fed++;
        audio.sfx('chomp');
        this.tween({ targets: it.c, x: mx, y: my, scale: 0, duration: 120, onComplete: () => it.c.setVisible(false) });
        this.mouthOpen = 0;
        this.drawMouth();
        this.after(120, () => {
          this.mouthOpen = 0.5;
          this.drawMouth();
        });
        // heart & retreat
        const h = this.gfx();
        h.fillStyle(C.pink, 1);
        h.lineStyle(3, C.charcoal, 1);
        drawHeart(h, 0, 0, 14);
        h.setPosition(mx, my - 90);
        this.tween({ targets: h, y: my - 160, alpha: 0, duration: 600, onComplete: () => h.destroy() });
        this.lunge -= 90;
        this.counterTxt.setText(this.counterText());
        this.tween({ targets: this.counterTxt, scale: 1.3, duration: 100, yoyo: true });
        if (this.fed >= this.need) this.win();
      } else {
        audio.sfx('wrong');
        audio.sfx('pop', 0.6);
        // spit it out
        this.tween({ targets: it.c, x: mx - 320 - Math.random() * 200, y: FLOOR - 30, angle: 720, duration: 500, ease: 'Quad.easeOut' });
        this.lunge += 110;
        this.tween({ targets: this.head, angle: { from: -10, to: 10 }, duration: 60, yoyo: true, repeat: 3, onComplete: () => this.head.setAngle(0) });
        this.twitch.shake(5, 300);
        audio.sfx('aah', 1.5);
      }
    } else {
      // return home
      this.tween({ targets: it.c, x: it.home.x, y: it.home.y, scale: 1, duration: 220, ease: 'Back.easeOut' });
    }
  }

  update(_t: number, delta: number) {
    if (!this.started || this.done) return;
    const dt = delta / 1000;
    this.time += dt;
    const f = 1 - this.scene.remainingFrac();
    const targetX = Phaser.Math.Linear(900, TWITCH_X + 130, f) + this.lunge;
    this.headX += (targetX - this.headX) * Math.min(1, 6 * dt);
    this.headY = 330 + Math.sin(this.time * 3) * 20;
    this.head.setPosition(this.headX, this.headY);
    this.mouthOpen = 0.3 + 0.25 * Math.sin(this.time * 6) + 0.25;
    this.drawMouth();
    this.drawStem();
    const dist = this.headX - TWITCH_X;
    this.twitch.look(1, dist < 400 ? -0.5 : 0);
    if (dist < 150) this.lose();
  }

  private drawStem() {
    const g = this.stemG;
    g.clear();
    g.lineStyle(26, C.charcoal, 1);
    g.beginPath();
    g.moveTo(POT_X, FLOOR - 120);
    const cx = (POT_X + this.headX) / 2;
    g.lineTo(cx, 200 + (this.headY - 330));
    g.lineTo(this.headX + 40, this.headY + 10);
    g.strokePath();
    g.lineStyle(16, C.mintDark, 1);
    g.beginPath();
    g.moveTo(POT_X, FLOOR - 120);
    g.lineTo(cx, 200 + (this.headY - 330));
    g.lineTo(this.headX + 40, this.headY + 10);
    g.strokePath();
  }

  onWin(): number {
    audio.sfx('success');
    this.mouthOpen = 0.1;
    this.drawMouth();
    this.tween({ targets: this.head, x: 900, y: 330, duration: 400, ease: 'Quad.easeOut', onUpdate: () => { this.headX = this.head.x; this.headY = this.head.y; this.drawStem(); } });
    this.tween({ targets: this.head, angle: { from: -6, to: 6 }, duration: 160, yoyo: true, repeat: 4 });
    this.after(500, () => {
      audio.sfx('burp', 1.4);
      const h = this.gfx();
      h.fillStyle(C.pink, 1);
      h.lineStyle(3, C.charcoal, 1);
      drawHeart(h, 0, 0, 18);
      h.setPosition(this.head.x - 60, this.head.y);
      this.tween({ targets: h, x: h.x - 120, y: h.y - 100, alpha: 0, duration: 700 });
      this.twitch.setMood('happy');
      this.twitch.celebrate();
      this.caption('FULL!', C.mint);
    });
    return 1300;
  }

  onLose(): number {
    this.twitch.stopIdle();
    this.twitch.setMood('scream');
    audio.sfx('aah', 1.6);
    this.mouthOpen = 1;
    this.drawMouth();
    const followStem = () => {
      this.headX = this.head.x;
      this.headY = this.head.y;
      this.drawStem();
    };
    this.tween({ targets: this.head, x: TWITCH_X + 30, y: FLOOR - 60, duration: 220, ease: 'Quad.easeIn', onUpdate: followStem, onComplete: () => {
      audio.sfx('chomp', 0.6);
      audio.sfx('squish');
      this.scene.shakeCam(0.01, 200);
      this.twitch.setVisible(false);
      this.mouthOpen = 0;
      this.drawMouth();
      this.tween({ targets: this.head, scaleX: 1.35, scaleY: 1.25, duration: 200, yoyo: true, ease: 'Quad.easeOut' });
      puff(this.scene, this.root, TWITCH_X, FLOOR - 40, 6, C.mint, 18);
      this.after(700, () => {
        audio.sfx('burp');
        this.mouthOpen = 0.8;
        this.drawMouth();
        const shoe = this.gfx();
        drawItem(shoe, 'shoe', 0, 0, 1);
        shoe.setPosition(this.head.x - 40, this.head.y);
        this.tween({ targets: shoe, x: 120, y: FLOOR - 30, angle: -540, duration: 700, ease: 'Quad.easeOut' });
        this.tween({ targets: this.head, y: this.head.y - 30, duration: 120, yoyo: true, onUpdate: followStem });
        this.after(250, () => this.caption('FERTILIZED.', C.mintDark));
      });
    } });
    return 2000;
  }
}

