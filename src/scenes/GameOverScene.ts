import Phaser from 'phaser';
import { C, hex } from '../core/Palette';
import { label, title, FONT_TITLE } from '../ui/Text';
import { Button } from '../ui/Button';
import { audio } from '../core/Audio';
import { Critter } from '../entities/Critter';
import { getCharacter } from '../entities/Characters';
import { dizzyStars, confetti } from '../entities/Props';
import type { RunSummary } from '../core/Director';

export class GameOverScene extends Phaser.Scene {
  private summary!: RunSummary;

  constructor() {
    super('GameOver');
  }

  init(data: RunSummary) {
    this.summary = data;
  }

  create() {
    const s = this.summary;
    this.cameras.main.setBackgroundColor(hex(C.violetDark));
    this.cameras.main.fadeIn(250, 43, 38, 34);
    const bg = this.add.graphics();
    bg.fillStyle(C.violet, 0.5);
    for (let i = 0; i < 14; i++) bg.fillRect(i * 100, 0, 40, 720);
    // ground
    bg.fillStyle(C.charcoal, 1);
    bg.fillRect(0, 600, 1280, 120);
    bg.fillStyle(C.paper, 0.15);
    bg.fillRect(0, 600, 1280, 4);

    // the fallen resident, lying down with stars
    const root = this.add.container(0, 0);
    const cr = new Critter(this, 230, 540, getCharacter(s.lastCharacter), 1.2);
    cr.setMood('dizzy');
    cr.setAngle(-90);
    root.add(cr);
    this.tweens.add({ targets: cr, y: 546, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    dizzyStars(this, root, 230, 440, 60000);
    label(this, 230, 640, 'they will be fine. probably.', { size: 14, color: C.paper, strokeWidth: 0, shadow: false }).setAlpha(0.6);

    // stamp
    const stamp = this.add.container(640, 90);
    const g = this.add.graphics();
    g.fillStyle(C.charcoal, 1);
    g.fillRoundedRect(-270 + 8, -50 + 10, 540, 100, 20);
    g.fillStyle(C.tomato, 1);
    g.lineStyle(6, C.charcoal, 1);
    g.fillRoundedRect(-270, -50, 540, 100, 20);
    g.strokeRoundedRect(-270, -50, 540, 100, 20);
    stamp.add([g, title(this, 0, -2, 'GAME OVER', { size: 72, strokeWidth: 9 })]);
    stamp.setAngle(-3);

    // score block
    label(this, 640, 170, 'SCORE', { size: 18, color: C.paper, strokeWidth: 0, shadow: false }).setAlpha(0.7);
    const scoreTxt = title(this, 640, 222, '0', { size: 96, color: C.mustard, strokeWidth: 10 });
    const cnt = this.tweens.addCounter({
      from: 0,
      to: s.score,
      duration: Math.min(1400, 300 + s.score / 8),
      ease: 'Quad.easeOut',
      onUpdate: () => scoreTxt.setText(Math.round(cnt.getValue() ?? 0).toLocaleString()),
      onComplete: () => {
        scoreTxt.setText(s.score.toLocaleString());
        if (s.newBest) {
          audio.sfx('highscore');
          const nb = this.add.container(640, 290);
          const bgc = this.add.graphics();
          bgc.fillStyle(C.mint, 1);
          bgc.lineStyle(4, C.charcoal, 1);
          bgc.fillRoundedRect(-140, -24, 280, 48, 14);
          bgc.strokeRoundedRect(-140, -24, 280, 48, 14);
          nb.add([bgc, label(this, 0, 0, 'NEW BEST!', { size: 30, family: FONT_TITLE, weight: 'normal', strokeWidth: 6 })]);
          nb.setScale(0).setAngle(4);
          this.tweens.add({ targets: nb, scale: 1, duration: 250, ease: 'Back.easeOut' });
          this.tweens.add({ targets: nb, angle: -4, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          confetti(this, root, 640, 220, undefined, 30, 500);
        } else {
          label(this, 640, 290, `BEST  ${s.best.toLocaleString()}`, { size: 24, color: C.paper, strokeWidth: 0, shadow: false }).setAlpha(0.8);
        }
      },
    });
    for (let i = 0; i < 6; i++) this.time.delayedCall(i * 120, () => audio.sfx('tick', 1 + i * 0.1));

    // stats row
    const mins = Math.floor(s.elapsed / 60000);
    const secs = Math.floor((s.elapsed % 60000) / 1000);
    const stats: Array<[string, string]> = [
      ['TIME', `${mins}:${secs.toString().padStart(2, '0')}`],
      ['CLEARED', String(s.cleared)],
      ['BEST STREAK', String(s.bestStreak)],
    ];
    stats.forEach(([k, v], i) => {
      const x = 500 + i * 140;
      const y = 370;
      const c = this.add.container(x, y);
      const cg = this.add.graphics();
      cg.fillStyle(C.paper, 1);
      cg.lineStyle(4, C.charcoal, 1);
      cg.fillRoundedRect(-62, -40, 124, 80, 14);
      cg.strokeRoundedRect(-62, -40, 124, 80, 14);
      c.add([cg, label(this, 0, -18, k, { size: 12, color: C.charcoal, strokeWidth: 0, shadow: false }), title(this, 0, 12, v, { size: 34, color: C.charcoal, strokeWidth: 0, shadow: false })]);
      c.setScale(0);
      this.tweens.add({ targets: c, scale: 1, duration: 250, delay: 400 + i * 120, ease: 'Back.easeOut' });
    });

    // unlocks
    if (s.unlocks.length) {
      label(this, 1030, 160, 'UNLOCKED THIS RUN', { size: 16, color: C.paper, strokeWidth: 0, shadow: false }).setAlpha(0.7);
      s.unlocks.slice(0, 5).forEach((u, i) => {
        const c = this.add.container(1030, 205 + i * 62);
        const cg = this.add.graphics();
        cg.fillStyle(C.mint, 1);
        cg.lineStyle(4, C.charcoal, 1);
        cg.fillRoundedRect(-120, -26, 240, 52, 14);
        cg.strokeRoundedRect(-120, -26, 240, 52, 14);
        const kind = u.kind === 'character' ? 'resident' : u.kind;
        c.add([cg, label(this, -108, -9, kind.toUpperCase(), { size: 11, color: C.charcoal, strokeWidth: 0, shadow: false, origin: [0, 0.5] }), label(this, -108, 10, u.name, { size: 20, strokeWidth: 4, origin: [0, 0.5] })]);
        c.setScale(0);
        this.tweens.add({ targets: c, scale: 1, duration: 250, delay: 900 + i * 150, ease: 'Back.easeOut', onStart: () => audio.sfx('unlock') });
      });
      if (s.unlocks.length > 5) label(this, 1030, 205 + 5 * 62, `+${s.unlocks.length - 5} more in the collection`, { size: 13, color: C.paper, strokeWidth: 0, shadow: false }).setAlpha(0.7);
    }

    // buttons
    const retry = new Button(this, 640, 500, 'RETRY', () => this.retry(), { w: 320, h: 88, color: C.tomato, size: 44 });
    this.time.delayedCall(1200, () => retry.wiggle());
    new Button(this, 470, 590, 'COLLECTION', () => this.go('Collection'), { w: 220, h: 60, color: C.violet, size: 24 });
    new Button(this, 810, 590, 'MAIN MENU', () => this.go('Menu'), { w: 220, h: 60, color: C.sky, size: 24 });
    label(this, 640, 650, 'Enter / Space to retry', { size: 13, color: C.paper, strokeWidth: 0, shadow: false }).setAlpha(0.5);

    const kb = this.input.keyboard;
    const onRetry = () => this.retry();
    kb?.on('keydown-ENTER', onRetry);
    kb?.on('keydown-SPACE', onRetry);
    this.events.once('shutdown', () => {
      kb?.off('keydown-ENTER', onRetry);
      kb?.off('keydown-SPACE', onRetry);
    });
    this.time.delayedCall(2200, () => audio.music('menu'));
  }

  private leaving = false;
  private retry() {
    if (this.leaving) return;
    this.leaving = true;
    audio.sfx('ui', 1.3);
    this.cameras.main.fadeOut(120, 43, 38, 34);
    this.time.delayedCall(130, () => this.scene.start('Play', { debugGame: null }));
  }

  private go(key: string) {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(120, 43, 38, 34);
    this.time.delayedCall(130, () => this.scene.start(key));
  }
}
