import Phaser from 'phaser';
import { C, hex } from '../core/Palette';
import { audio } from '../core/Audio';
import { label, FONT_TITLE } from '../ui/Text';
import { Critter } from '../entities/Critter';
import { getCharacter } from '../entities/Characters';

/** Splash: the logo drops on Gus. Tap anywhere to continue (and unlock audio). */
export class TitleScene extends Phaser.Scene {
  private ready = false;
  private leaving = false;

  constructor() {
    super('Title');
  }

  create() {
    this.cameras.main.setBackgroundColor(hex(C.cream));
    this.ready = false;
    this.leaving = false;
    const g = this.add.graphics();
    // ground
    g.fillStyle(C.mint, 1);
    g.fillEllipse(640, 760, 1700, 400);
    g.lineStyle(6, C.charcoal, 1);
    g.strokeEllipse(640, 760, 1700, 400);
    // sun
    g.fillStyle(C.mustard, 1);
    g.lineStyle(5, C.charcoal, 1);
    g.fillCircle(1080, 140, 70);
    g.strokeCircle(1080, 140, 70);

    const gus = new Critter(this, 640, 525, getCharacter('gus'), 1.4);
    gus.startIdle();
    gus.look(0, -1);

    // logo: individual letters
    const word = 'BLUNDERTON';
    const letters: Phaser.GameObjects.Text[] = [];
    const spacing = 92;
    word.split('').forEach((ch, i) => {
      const x = 640 + (i - (word.length - 1) / 2) * spacing;
      const t = label(this, x, -200, ch, { size: 120, family: FONT_TITLE, weight: 'normal', color: [C.tomato, C.mustard, C.sky, C.mint, C.pink][i % 5], strokeWidth: 12 });
      t.setAngle((i % 2 ? 1 : -1) * 4);
      letters.push(t);
    });
    const plate = this.add.graphics();
    plate.fillStyle(C.charcoal, 1);
    plate.fillRoundedRect(640 - 520 + 10, 210 + 12, 1040, 170, 30);
    plate.fillStyle(C.paper, 1);
    plate.lineStyle(7, C.charcoal, 1);
    plate.fillRoundedRect(640 - 520, 210, 1040, 170, 30);
    plate.strokeRoundedRect(640 - 520, 210, 1040, 170, 30);
    plate.setAlpha(0).setY(-400);
    this.children.sendToBack(plate);
    this.children.sendToBack(g);

    // drop sequence
    this.tweens.add({ targets: plate, y: 0, alpha: 1, duration: 420, ease: 'Bounce.easeOut', delay: 150 });
    letters.forEach((t, i) => {
      this.tweens.add({
        targets: t,
        y: 295,
        duration: 420,
        delay: 250 + i * 55,
        ease: 'Bounce.easeOut',
        onComplete: () => {
          audio.sfx('tap', 0.8 + i * 0.05);
          if (i === Math.floor(word.length / 2)) {
            // the middle letter flattens Gus
            gus.flatten(90);
            audio.sfx('squish');
            this.cameras.main.shake(120, 0.008);
            this.time.delayedCall(900, () => {
              gus.unflatten(500);
              gus.setMood('dizzy');
              this.time.delayedCall(700, () => {
                gus.setMood('smug');
                gus.startIdle();
              });
            });
          }
        },
      });
    });
    const sub = label(this, 640, 414, 'population: dropping', { size: 26, color: C.charcoal, strokeWidth: 0, shadow: false });
    sub.setAlpha(0);
    this.tweens.add({ targets: sub, alpha: 0.8, duration: 400, delay: 1100 });

    const tap = label(this, 640, 660, 'TAP TO START', { size: 30, color: C.white, strokeWidth: 6 });
    tap.setAlpha(0);
    this.time.delayedCall(1200, () => {
      this.ready = true;
      this.tweens.add({ targets: tap, alpha: 1, duration: 300 });
      this.tweens.add({ targets: tap, scale: 1.08, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });

    const go = () => {
      if (this.leaving) return;
      this.leaving = true;
      audio.unlock();
      audio.sfx('ui');
      audio.music('menu');
      this.cameras.main.fadeOut(200, 251, 241, 220);
      this.time.delayedCall(210, () => this.scene.start('Menu'));
    };
    this.input.on('pointerdown', () => (this.ready ? go() : this.skipIntro()));
    this.input.keyboard?.on('keydown', () => (this.ready ? go() : this.skipIntro()));
  }

  private skipIntro() {
    // any early tap just fast-forwards to ready
    this.ready = true;
    audio.unlock();
  }
}
