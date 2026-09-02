import Phaser from 'phaser';
import { C, hex } from '../core/Palette';
import { audio } from '../core/Audio';
import { save } from '../core/Save';
import { label, title, FONT_TITLE } from '../ui/Text';
import { Button } from '../ui/Button';
import { Critter } from '../entities/Critter';
import { CHARACTERS, getCharacter } from '../entities/Characters';
import { isCharacterUnlocked } from '../core/Unlocks';
import { drawCloud } from '../entities/Props';

type BgId = 'day' | 'dusk' | 'night';

const BG: Record<BgId, { sky: number; sky2: number; hill: number; building: number; sunColor: number; unlock: string | null; name: string }> = {
  day: { sky: C.cream, sky2: C.skyLight, hill: C.mint, building: C.violet, sunColor: C.mustard, unlock: null, name: 'DAY' },
  dusk: { sky: 0xffc7a0, sky2: 0xf58fb0, hill: C.mintDark, building: 0x3a2554, sunColor: C.orange, unlock: 'bg:dusk', name: 'DUSK' },
  night: { sky: 0x2e1b45, sky2: 0x4b2e6b, hill: 0x2f6b55, building: 0x1d1030, sunColor: C.paper, unlock: 'bg:night', name: 'NIGHT' },
};

export class MenuScene extends Phaser.Scene {
  private walkers: Array<{ c: Critter; dir: number; speed: number; busy: boolean }> = [];
  private gagTimer?: Phaser.Time.TimerEvent;
  private soundBtn!: Button;
  private bgId: BgId = 'day';

  constructor() {
    super('Menu');
  }

  create() {
    this.cameras.main.fadeIn(200, 251, 241, 220);
    audio.music('menu');
    this.walkers = [];
    this.bgId = this.resolveBg();
    this.drawBackground();
    this.buildTitle();
    this.buildButtons();
    this.buildBestSign();
    this.spawnWalkers();
    this.gagTimer = this.time.addEvent({ delay: 2600, loop: true, callback: () => this.randomGag() });
    this.input.keyboard?.on('keydown-ENTER', () => this.play());
    this.input.keyboard?.on('keydown-SPACE', () => this.play());
    this.events.once('shutdown', () => {
      this.gagTimer?.remove(false);
      this.input.keyboard?.off('keydown-ENTER');
      this.input.keyboard?.off('keydown-SPACE');
    });
    // version / credit line
    label(this, 1268, 708, 'v1.0  •  a town of questionable decisions', { size: 13, color: C.paper, strokeWidth: 0, shadow: false, origin: [1, 1] }).setAlpha(0.55);
  }

  private resolveBg(): BgId {
    const wanted = save.data.menuBg as BgId;
    const spec = BG[wanted];
    if (spec && (!spec.unlock || save.has(spec.unlock))) return wanted;
    return 'day';
  }

  private drawBackground() {
    const b = BG[this.bgId];
    this.cameras.main.setBackgroundColor(hex(b.sky));
    const g = this.add.graphics();
    g.setDepth(-2);
    g.fillGradientStyle(b.sky, b.sky, b.sky2, b.sky2, 1);
    g.fillRect(0, 0, 1280, 520);
    if (this.bgId === 'night') {
      g.fillStyle(C.paper, 1);
      for (let i = 0; i < 40; i++) g.fillCircle((i * 197) % 1280, (i * 83) % 400, 1 + (i % 3));
    }
    // sun / moon (clickable: cycles unlocked backgrounds)
    const sun = this.add.graphics();
    sun.fillStyle(b.sunColor, 1);
    sun.lineStyle(5, C.charcoal, 1);
    sun.fillCircle(0, 0, 54);
    sun.strokeCircle(0, 0, 54);
    if (this.bgId === 'night') {
      sun.fillStyle(b.sky, 1);
      sun.fillCircle(20, -14, 40);
    } else {
      sun.fillStyle(C.charcoal, 1);
      sun.fillCircle(-16, -8, 5);
      sun.fillCircle(16, -8, 5);
      sun.lineStyle(4, C.charcoal, 1);
      sun.beginPath();
      sun.arc(0, 6, 18, Math.PI * 0.15, Math.PI * 0.85, false);
      sun.strokePath();
    }
    sun.setPosition(1100, 120);
    sun.setInteractive(new Phaser.Geom.Circle(0, 0, 60), Phaser.Geom.Circle.Contains);
    sun.on('pointerdown', () => this.cycleBg());
    this.tweens.add({ targets: sun, angle: 360, duration: 60000, repeat: -1 });
    const unlockedBgs = (Object.keys(BG) as BgId[]).filter((k) => !BG[k].unlock || save.has(BG[k].unlock!));
    if (unlockedBgs.length > 1) label(this, 1100, 195, `${b.name}  •  tap to change`, { size: 13, color: C.charcoal, strokeWidth: 0, shadow: false }).setAlpha(0.6);

    // clouds
    for (let i = 0; i < 4; i++) {
      const cg = this.add.graphics();
      drawCloud(cg, 0, 0, 0.7 + (i % 2) * 0.3);
      cg.setPosition(150 + i * 330, 90 + (i % 2) * 60);
      cg.setAlpha(this.bgId === 'night' ? 0.35 : 0.9);
      cg.setDepth(-1); // behind the sun and the title
      this.tweens.add({ targets: cg, x: cg.x + 1500, duration: 90000 + i * 20000, repeat: -1, onRepeat: () => cg.setX(-200) });
    }
    // skyline
    const sky = this.add.graphics();
    sky.fillStyle(b.building, 1);
    sky.lineStyle(4, C.charcoal, 1);
    const buildings = [
      [0, 380, 120, 160], [110, 340, 90, 200], [190, 400, 140, 140], [320, 300, 100, 240], [410, 380, 130, 160],
      [530, 330, 90, 210], [610, 410, 160, 130], [760, 350, 110, 190], [860, 300, 80, 240], [930, 380, 150, 160],
      [1070, 340, 100, 200], [1160, 400, 140, 140],
    ];
    for (const [x, y, w, h] of buildings) {
      sky.fillRect(x, y, w, h);
      sky.strokeRect(x, y, w, h);
      sky.fillStyle(this.bgId === 'night' ? C.mustard : C.skyLight, 1);
      for (let wy = y + 18; wy < y + h - 20; wy += 34) for (let wx = x + 14; wx < x + w - 20; wx += 30) if ((wx + wy) % 3 !== 0) sky.fillRect(wx, wy, 14, 18);
      sky.fillStyle(b.building, 1);
    }
    // hills / road
    const hill = this.add.graphics();
    hill.fillStyle(b.hill, 1);
    hill.lineStyle(6, C.charcoal, 1);
    hill.fillEllipse(300, 620, 900, 260);
    hill.strokeEllipse(300, 620, 900, 260);
    hill.fillEllipse(1000, 640, 1000, 300);
    hill.strokeEllipse(1000, 640, 1000, 300);
    hill.fillStyle(0x3d3733, 1);
    hill.fillRect(0, 610, 1280, 110);
    hill.lineStyle(6, C.charcoal, 1);
    hill.lineBetween(0, 610, 1280, 610);
    hill.fillStyle(C.mustard, 1);
    for (let x = 20; x < 1280; x += 120) hill.fillRect(x, 660, 60, 8);
    // town sign
    const sign = this.add.graphics();
    sign.fillStyle(C.wood, 1);
    sign.lineStyle(4, C.charcoal, 1);
    sign.fillRect(1010, 470, 14, 150);
    sign.strokeRect(1010, 470, 14, 150);
    sign.fillStyle(C.paper, 1);
    sign.fillRoundedRect(900, 440, 240, 90, 10);
    sign.strokeRoundedRect(900, 440, 240, 90, 10);
    label(this, 1020, 466, 'WELCOME TO BLUNDERTON', { size: 16, color: C.charcoal, strokeWidth: 0, shadow: false });
    label(this, 1020, 490, 'please do not', { size: 15, color: C.tomato, strokeWidth: 0, shadow: false });
    label(this, 1020, 512, 'pop. ~10 and falling', { size: 12, color: C.charcoal, strokeWidth: 0, shadow: false }).setAlpha(0.7);
  }

  private cycleBg() {
    const ids = (Object.keys(BG) as BgId[]).filter((k) => !BG[k].unlock || save.has(BG[k].unlock!));
    if (ids.length <= 1) {
      audio.sfx('tick');
      return;
    }
    const next = ids[(ids.indexOf(this.bgId) + 1) % ids.length];
    save.data.menuBg = next;
    save.commit();
    audio.sfx('ui', 1.2);
    this.scene.restart();
  }

  private buildTitle() {
    const word = 'BLUNDERTON';
    const spacing = 74;
    word.split('').forEach((ch, i) => {
      const x = 470 + (i - (word.length - 1) / 2) * spacing;
      const t = label(this, x, 110, ch, { size: 96, family: FONT_TITLE, weight: 'normal', color: [C.tomato, C.mustard, C.sky, C.mint, C.pink][i % 5], strokeWidth: 10 });
      t.setAngle((i % 2 ? 1 : -1) * 4);
      this.tweens.add({ targets: t, y: 104, duration: 700 + i * 40, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 60 });
    });
    const sub = this.add.container(470, 178);
    const g = this.add.graphics();
    g.fillStyle(C.charcoal, 1);
    g.fillRoundedRect(-170, -20, 340, 40, 12);
    sub.add([g, label(this, 0, 0, 'tiny games • terrible decisions', { size: 20, color: C.paper, strokeWidth: 0, shadow: false })]);
    sub.setAngle(-2);
  }

  private buildButtons() {
    const play = new Button(this, 470, 290, 'PLAY', () => this.play(), { w: 320, h: 92, color: C.tomato, size: 46 });
    this.tweens.add({ targets: play, scale: 1.04, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    new Button(this, 330, 390, 'COLLECTION', () => this.go('Collection'), { w: 240, h: 66, color: C.violet, size: 26 });
    new Button(this, 610, 390, 'HOW TO PLAY', () => this.go('HowTo'), { w: 240, h: 66, color: C.sky, size: 26 });
    this.soundBtn = new Button(this, 470, 470, audio.muted ? 'SOUND: OFF' : 'SOUND: ON', () => this.toggleSound(), { w: 220, h: 54, color: C.mustard, size: 22, sound: 'tick' });
  }

  private toggleSound() {
    const on = audio.toggle();
    this.soundBtn.setLabel(on ? 'SOUND: ON' : 'SOUND: OFF');
    if (on) audio.sfx('ui');
  }

  private buildBestSign() {
    const c = this.add.container(1100, 300);
    const g = this.add.graphics();
    g.fillStyle(C.charcoal, 1);
    g.fillRoundedRect(-120 + 6, -50 + 8, 240, 100, 18);
    g.fillStyle(C.mustard, 1);
    g.lineStyle(5, C.charcoal, 1);
    g.fillRoundedRect(-120, -50, 240, 100, 18);
    g.strokeRoundedRect(-120, -50, 240, 100, 18);
    c.add([g, label(this, 0, -22, 'BEST SCORE', { size: 16, color: C.charcoal, strokeWidth: 0, shadow: false }), title(this, 0, 14, save.data.best.toLocaleString(), { size: 46, strokeWidth: 7 })]);
    c.setAngle(3);
    const s = save.data.stats;
    if (s.games > 0) {
      const t = label(this, 1100, 378, `${s.games} runs  •  ${s.cleared} cleared  •  best streak ${s.longestStreak}`, { size: 13, color: C.paper, strokeWidth: 0, shadow: false });
      const pill = this.add.graphics();
      pill.fillStyle(C.charcoal, 0.85);
      pill.fillRoundedRect(1100 - t.width / 2 - 12, 378 - 13, t.width + 24, 26, 13);
      this.children.moveBelow(pill, t);
    }
  }

  private spawnWalkers() {
    const unlocked = CHARACTERS.filter((c) => isCharacterUnlocked(c.id));
    const pool = unlocked.length ? unlocked : [CHARACTERS[0]];
    const picks = Phaser.Utils.Array.Shuffle([...pool]).slice(0, Math.min(5, pool.length));
    picks.forEach((def, i) => {
      const c = new Critter(this, 160 + i * 240, 610 - 50, getCharacter(def.id), 0.75);
      c.y = 610 - c.footY * 0.75 + 4;
      c.startIdle();
      c.walk(true);
      const dir = i % 2 ? -1 : 1;
      c.setScale(0.75 * dir, 0.75);
      this.walkers.push({ c, dir, speed: 40 + Math.random() * 40, busy: false });
    });
  }

  private randomGag() {
    const free = this.walkers.filter((w) => !w.busy);
    if (!free.length) return;
    const w = free[Phaser.Math.Between(0, free.length - 1)];
    w.busy = true;
    const c = w.c;
    const gag = Phaser.Math.Between(0, 3);
    const done = (ms: number) => this.time.delayedCall(ms, () => {
      if (!c.active) return;
      w.busy = false;
      c.setMood('idle');
      c.walk(true);
    });
    switch (gag) {
      case 0: // trip
        c.walk(false);
        c.setMood('surprised');
        this.tweens.add({ targets: c, angle: 90 * -w.dir, y: c.y + 30, duration: 260, ease: 'Quad.easeIn', onComplete: () => audio.sfx('thud', 1.4) });
        this.tweens.add({ targets: c, angle: 0, y: c.y, duration: 350, delay: 900, ease: 'Back.easeOut' });
        done(1400);
        break;
      case 1: { // flowerpot
        c.walk(false);
        const pot = this.add.graphics();
        pot.fillStyle(C.tomatoDark, 1);
        pot.lineStyle(3, C.charcoal, 1);
        pot.fillRoundedRect(-22, -20, 44, 40, 6);
        pot.strokeRoundedRect(-22, -20, 44, 40, 6);
        pot.fillStyle(C.mint, 1);
        pot.fillCircle(0, -30, 18);
        pot.setPosition(c.x, -60);
        this.tweens.add({
          targets: pot,
          y: c.y - 60,
          duration: 500,
          ease: 'Quad.easeIn',
          onComplete: () => {
            audio.sfx('hit', 1.5);
            c.flatten(90);
            this.tweens.add({ targets: pot, y: c.y + 30, angle: 90, duration: 200, ease: 'Bounce.easeOut' });
            this.time.delayedCall(800, () => {
              c.unflatten(400);
              c.setMood('dizzy');
              this.tweens.add({ targets: pot, alpha: 0, duration: 300, delay: 300, onComplete: () => pot.destroy() });
            });
          },
        });
        done(1900);
        break;
      }
      case 2: // happy hop
        c.setMood('happy');
        c.hop(40, 300);
        audio.sfx('boing', 1.3);
        done(600);
        break;
      case 3: // sudden panic about nothing
        c.walk(false);
        c.panic();
        audio.sfx('aah', 1.2);
        done(900);
        break;
    }
  }

  update(_t: number, delta: number) {
    const dt = delta / 1000;
    for (const w of this.walkers) {
      if (w.busy) continue;
      w.c.x += w.dir * w.speed * dt;
      if (w.c.x > 1240 || w.c.x < 40) {
        w.dir *= -1;
        w.c.setScale(0.75 * w.dir, 0.75);
      }
    }
  }

  private play() {
    if (!this.scene.isActive()) return;
    audio.sfx('ui', 1.3);
    this.cameras.main.fadeOut(150, 43, 38, 34);
    this.time.delayedCall(160, () => this.scene.start('Play', { debugGame: null }));
  }

  private go(key: string) {
    this.cameras.main.fadeOut(120, 251, 241, 220);
    this.time.delayedCall(130, () => this.scene.start(key));
  }
}
