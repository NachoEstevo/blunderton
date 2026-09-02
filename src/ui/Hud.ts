import Phaser from 'phaser';
import { C } from '../core/Palette';
import { label, FONT_TITLE } from './Text';
import { save } from '../core/Save';

/** Lives (three little residents), score and streak. Lives on top of everything. */
export class Hud extends Phaser.GameObjects.Container {
  private lifeTokens: Phaser.GameObjects.Container[] = [];
  private scoreTxt: Phaser.GameObjects.Text;
  private streakTxt: Phaser.GameObjects.Text;
  private streakFlame: Phaser.GameObjects.Graphics;
  private shownScore = 0;
  private targetScore = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    // lives
    for (let i = 0; i < 3; i++) {
      const t = this.makeToken(52 + i * 54, 44);
      this.lifeTokens.push(t);
      this.add(t);
    }
    // score
    const scoreLabel = label(scene, 1240, 22, 'SCORE', { size: 15, color: C.charcoal, strokeWidth: 0, shadow: false, origin: [1, 0.5] });
    scoreLabel.setAlpha(0.7);
    this.scoreTxt = label(scene, 1244, 52, '0', { size: 40, family: FONT_TITLE, weight: 'normal', origin: [1, 0.5], strokeWidth: 7 });
    this.streakFlame = scene.add.graphics();
    this.streakTxt = label(scene, 1240, 96, '', { size: 22, color: C.mustard, origin: [1, 0.5], strokeWidth: 5 });
    this.streakTxt.setAlpha(0);
    this.add([scoreLabel, this.scoreTxt, this.streakFlame, this.streakTxt]);
    this.setDepth(1000);
    scene.add.existing(this);
  }

  private makeToken(x: number, y: number) {
    const c = this.scene.add.container(x, y);
    const g = this.scene.add.graphics();
    this.drawToken(g, true);
    c.add(g);
    return c;
  }

  private drawToken(g: Phaser.GameObjects.Graphics, alive: boolean) {
    g.clear();
    g.lineStyle(4, C.charcoal, 1);
    g.fillStyle(alive ? C.mustard : C.grey, 1);
    g.fillRoundedRect(-20, -18, 40, 36, 14);
    g.strokeRoundedRect(-20, -18, 40, 36, 14);
    if (alive) {
      g.fillStyle(C.white, 1);
      g.fillCircle(-8, -4, 7);
      g.fillCircle(8, -4, 7);
      g.fillStyle(C.charcoal, 1);
      g.fillCircle(-7, -3, 3.5);
      g.fillCircle(9, -3, 3.5);
      g.lineStyle(3, C.charcoal, 1);
      g.beginPath();
      g.arc(0, 4, 8, Math.PI * 0.15, Math.PI * 0.85, false);
      g.strokePath();
    } else {
      g.lineStyle(3, C.charcoal, 1);
      g.lineBetween(-12, -8, -4, 0);
      g.lineBetween(-4, -8, -12, 0);
      g.lineBetween(4, -8, 12, 0);
      g.lineBetween(12, -8, 4, 0);
      g.lineBetween(-6, 8, 6, 8);
      // bandage
      g.fillStyle(C.white, 1);
      g.fillRect(6, -18, 12, 10);
      g.lineStyle(2, C.charcoal, 1);
      g.strokeRect(6, -18, 12, 10);
    }
  }

  setLives(n: number, animateLoss = false) {
    this.lifeTokens.forEach((t, i) => {
      const alive = i < n;
      const g = t.list[0] as Phaser.GameObjects.Graphics;
      const wasAlive = (t as unknown as { alive?: boolean }).alive ?? true;
      (t as unknown as { alive?: boolean }).alive = alive;
      if (alive !== wasAlive) {
        if (!alive && animateLoss) {
          this.scene.tweens.add({
            targets: t,
            scaleX: 1.6,
            scaleY: 0.4,
            duration: 120,
            yoyo: true,
            ease: 'Quad.easeOut',
            onComplete: () => this.drawToken(g, false),
          });
          this.scene.tweens.add({ targets: t, angle: -15, duration: 200, delay: 240 });
        } else {
          this.drawToken(g, alive);
          t.setAngle(0);
        }
      }
    });
  }

  setScore(score: number, pop = false) {
    this.targetScore = score;
    if (pop) {
      this.scene.tweens.add({ targets: this.scoreTxt, scale: 1.25, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
    } else {
      this.shownScore = score;
      this.scoreTxt.setText(String(score));
    }
  }

  setStreak(streak: number) {
    const show = streak >= 3;
    const hot = streak >= 10 && save.has('sticker:hot');
    this.streakTxt.setText(show ? `${streak} STREAK` : '');
    this.streakTxt.setColor(hot ? '#ff6f3a' : streak >= 10 ? '#f58fb0' : '#f2b63a');
    this.scene.tweens.add({ targets: this.streakTxt, alpha: show ? 1 : 0, duration: 200 });
    this.streakFlame.clear();
    if (hot) {
      const fx = 1240 - this.streakTxt.width - 14;
      this.streakFlame.setPosition(fx, 96);
      this.streakFlame.fillStyle(C.tomato, 1);
      this.streakFlame.fillTriangle(-9, 10, 9, 10, 0, -14);
      this.streakFlame.fillStyle(C.mustard, 1);
      this.streakFlame.fillTriangle(-5, 10, 5, 10, 0, -4);
    }
    if (show) this.scene.tweens.add({ targets: this.streakTxt, scale: 1.3, duration: 100, yoyo: true });
  }

  update() {
    if (this.shownScore !== this.targetScore) {
      const diff = this.targetScore - this.shownScore;
      const step = Math.max(1, Math.ceil(Math.abs(diff) * 0.2));
      this.shownScore += Math.sign(diff) * Math.min(step, Math.abs(diff));
      this.scoreTxt.setText(String(this.shownScore));
    }
  }
}
