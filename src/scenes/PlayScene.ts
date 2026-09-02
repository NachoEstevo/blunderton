import Phaser from 'phaser';
import { Director } from '../core/Director';
import { transitionScale } from '../core/Difficulty';
import { audio } from '../core/Audio';
import { C, hex } from '../core/Palette';
import { Hud } from '../ui/Hud';
import { TimerBar } from '../ui/TimerBar';
import { Transition } from '../ui/Transition';
import { label, title, FONT_TITLE } from '../ui/Text';
import type { Microgame, MicrogameHost } from '../microgames/Microgame';
import type { Registered } from '../microgames/registry';
import type { Unlockable } from '../core/Unlocks';

type State = 'loading' | 'intro' | 'playing' | 'resolving' | 'transition' | 'over';

export class PlayScene extends Phaser.Scene implements MicrogameHost {
  private director!: Director;
  private hud!: Hud;
  private timer!: TimerBar;
  private transition!: Transition;
  private current: Microgame | null = null;
  private reg: Registered | null = null;
  private state: State = 'loading';
  private debugGame: string | null = null;
  private overlay!: Phaser.GameObjects.Container;
  private unlockQueue: Unlockable[] = [];
  private unlockShowing = false;

  constructor() {
    super('Play');
  }

  init(data: { debugGame?: string | null }) {
    this.debugGame = data?.debugGame ?? null;
  }

  create() {
    this.cameras.main.setBackgroundColor(hex(C.cream));
    this.director = new Director(this.debugGame);
    this.director.captureBest();
    this.director.start();
    this.hud = new Hud(this);
    this.timer = new TimerBar(this);
    this.transition = new Transition(this);
    this.overlay = this.add.container(0, 0).setDepth(950);
    this.transition.coverInstant(C.tomato);
    this.hud.setLives(3);
    this.hud.setScore(0);
    this.hud.setStreak(0);
    audio.music('game');
    audio.setTempo(1);
    audio.setIntensity(0);
    this.events.once('shutdown', () => this.cleanup());
    if (this.director.runUnlocks.length) this.queueUnlocks(this.director.runUnlocks);
    if (this.debugGame) {
      // Developer hook (only with ?debugGame=...): lets automated tests inspect the run.
      const self = this;
      (window as unknown as { __blunderton?: unknown }).__blunderton = {
        scene: self,
        get game() {
          return self.current;
        },
        get state() {
          return self.state;
        },
        get director() {
          return self.director;
        },
      };
    }
    void this.nextGame();
  }

  private async nextGame() {
    this.state = 'loading';
    this.reg = this.director.pickNext();
    const ctx = this.director.buildContext(this.reg.meta);
    const game = this.reg.create(this, ctx);
    this.current = game;
    game.root.setDepth(10);
    game.build();
    const ts = transitionScale(this.director.level());
    await this.transition.uncover(ts);
    if (this.current !== game || !this.sys.isActive()) return;
    this.state = 'intro';
    await this.showInstruction(this.reg.meta.instruction, ts);
    if (this.current !== game || !this.sys.isActive()) return;
    this.state = 'playing';
    game.begin();
    this.timer.start(ctx.duration, () => {
      if (this.current === game && !game.done) game.onTimeout();
    });
  }

  private showInstruction(text: string, ts: number): Promise<void> {
    return new Promise((res) => {
      audio.sfx('card');
      const card = this.add.container(640, 330).setDepth(950);
      const g = this.add.graphics();
      const w = Math.max(420, text.length * 52 + 120);
      g.fillStyle(C.charcoal, 1);
      g.fillRoundedRect(-w / 2 + 8, -70 + 10, w, 140, 30);
      g.fillStyle(C.tomato, 1);
      g.lineStyle(6, C.charcoal, 1);
      g.fillRoundedRect(-w / 2, -70, w, 140, 30);
      g.strokeRoundedRect(-w / 2, -70, w, 140, 30);
      const t = title(this, 0, -4, text, { size: 92, color: C.white, strokeWidth: 10 });
      card.add([g, t]);
      card.setAngle(-4).setScale(0);
      this.tweens.add({ targets: card, scale: 1, duration: 180 * Math.max(0.7, ts), ease: 'Back.easeOut' });
      this.tweens.add({ targets: card, angle: 3, duration: 380 * ts, yoyo: true, ease: 'Sine.easeInOut' });
      this.time.delayedCall((180 + 560) * ts, () => {
        this.tweens.add({
          targets: card,
          scale: 0,
          angle: 12,
          duration: 120,
          ease: 'Quad.easeIn',
          onComplete: () => {
            card.destroy();
            res();
          },
        });
      });
    });
  }

  // ---------------------------------------------------------------- MicrogameHost
  resolve(win: boolean) {
    if (!this.current || !this.reg || this.state !== 'playing') return;
    const game = this.current;
    this.state = 'resolving';
    this.timer.stop();
    const frac = this.timer.frac();
    const res = this.director.resolve(this.reg.meta.id, win, frac);
    const hold = win ? game.onWin() : game.onLose();
    this.hud.setStreak(res.streak);
    if (win) {
      this.time.delayedCall(220, () => {
        this.hud.setScore(this.director.score, true);
        this.floatScore(res.gain);
      });
      if (res.milestone) this.time.delayedCall(450, () => this.streakBanner(res.milestone!));
    } else {
      this.time.delayedCall(350, () => this.hud.setLives(this.director.lives, true));
      audio.sfx('fail');
    }
    if (res.newUnlocks.length) this.queueUnlocks(res.newUnlocks);
    // music follows the difficulty
    const level = this.director.level();
    audio.setTempo(1 + 0.35 * level);
    audio.setIntensity(this.director.tier());

    const ts = transitionScale(level);
    this.time.delayedCall(hold, async () => {
      if (this.current !== game) return;
      if (res.gameOver) {
        this.gameOverSequence();
        return;
      }
      this.state = 'transition';
      await this.transition.cover(ts);
      if (!this.sys.isActive()) return;
      game.destroy();
      this.current = null;
      void this.nextGame();
    });
  }

  remainingFrac() {
    return this.timer.frac();
  }

  shakeCam(intensity = 0.01, dur = 200) {
    this.cameras.main.shake(dur, intensity);
  }

  flashCam(color = 0xffffff, dur = 100) {
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    this.cameras.main.flash(dur, r, g, b);
  }

  // ---------------------------------------------------------------- feedback
  private floatScore(gain: number) {
    const t = label(this, 640, 210, `+${gain}`, { size: 54, color: C.mustard, family: FONT_TITLE, weight: 'normal', strokeWidth: 8 });
    t.setDepth(960).setScale(0.5);
    this.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: 150, alpha: 0, duration: 600, delay: 250, ease: 'Quad.easeIn', onComplete: () => t.destroy() });
  }

  private streakBanner(n: number) {
    audio.sfx('streak');
    const c = this.add.container(640, 300).setDepth(960);
    const g = this.add.graphics();
    g.fillStyle(C.charcoal, 1);
    g.fillRoundedRect(-230 + 6, -50 + 8, 460, 100, 24);
    g.fillStyle(n >= 20 ? C.pink : n >= 10 ? C.violet : C.mustard, 1);
    g.lineStyle(5, C.charcoal, 1);
    g.fillRoundedRect(-230, -50, 460, 100, 24);
    g.strokeRoundedRect(-230, -50, 460, 100, 24);
    const t = title(this, 0, -2, `${n} STREAK!`, { size: 60, strokeWidth: 8 });
    c.add([g, t]);
    c.setScale(0).setAngle(6);
    this.tweens.add({ targets: c, scale: 1, angle: -3, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, scale: 0, alpha: 0, duration: 200, delay: 800, ease: 'Quad.easeIn', onComplete: () => c.destroy() });
    this.cameras.main.flash(80, 255, 255, 255);
  }

  private queueUnlocks(list: Unlockable[]) {
    this.unlockQueue.push(...list);
    this.showNextUnlock();
  }

  private showNextUnlock() {
    if (this.unlockShowing || this.unlockQueue.length === 0 || !this.sys.isActive()) return;
    const u = this.unlockQueue.shift()!;
    this.unlockShowing = true;
    audio.sfx('unlock');
    const c = this.add.container(230, 760).setDepth(1001);
    const g = this.add.graphics();
    g.fillStyle(C.charcoal, 1);
    g.fillRoundedRect(-210 + 5, -36 + 6, 420, 72, 18);
    g.fillStyle(C.mint, 1);
    g.lineStyle(4, C.charcoal, 1);
    g.fillRoundedRect(-210, -36, 420, 72, 18);
    g.strokeRoundedRect(-210, -36, 420, 72, 18);
    const kind = u.kind === 'character' ? 'NEW RESIDENT' : u.kind === 'skin' ? 'NEW LOOK' : u.kind === 'background' ? 'NEW VIEW' : 'NEW STICKER';
    const a = label(this, -190, -14, kind, { size: 14, color: C.charcoal, strokeWidth: 0, shadow: false, origin: [0, 0.5] });
    const b = label(this, -190, 12, u.name, { size: 26, color: C.white, origin: [0, 0.5], strokeWidth: 5 });
    c.add([g, a, b]);
    this.tweens.add({ targets: c, y: 660, duration: 300, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: c,
      y: 780,
      duration: 250,
      delay: 2200,
      ease: 'Quad.easeIn',
      onComplete: () => {
        c.destroy();
        this.unlockShowing = false;
        this.showNextUnlock();
      },
    });
  }

  private gameOverSequence() {
    this.state = 'over';
    audio.music(null);
    audio.sfx('gameover');
    const summary = this.director.finish();
    const stamp = this.add.container(640, 330).setDepth(970);
    const g = this.add.graphics();
    g.fillStyle(C.charcoal, 1);
    g.fillRoundedRect(-330 + 8, -80 + 10, 660, 160, 24);
    g.fillStyle(C.tomato, 1);
    g.lineStyle(8, C.charcoal, 1);
    g.fillRoundedRect(-330, -80, 660, 160, 24);
    g.strokeRoundedRect(-330, -80, 660, 160, 24);
    const t = title(this, 0, -4, 'GAME OVER', { size: 104, strokeWidth: 12 });
    stamp.add([g, t]);
    stamp.setScale(3).setAlpha(0).setAngle(-8);
    this.tweens.add({
      targets: stamp,
      scale: 1,
      alpha: 1,
      duration: 220,
      ease: 'Quad.easeIn',
      onComplete: () => {
        audio.sfx('slam');
        this.cameras.main.shake(250, 0.015);
      },
    });
    this.time.delayedCall(1700, () => {
      this.cameras.main.fadeOut(250, 43, 38, 34);
      this.time.delayedCall(260, () => this.scene.start('GameOver', summary));
    });
  }

  update(time: number, delta: number) {
    this.director.tick();
    this.hud.update();
    this.timer.update(delta);
    if (this.state === 'playing' && this.current) this.current.update(time, delta);
  }

  private cleanup() {
    this.current?.destroy();
    this.current = null;
  }
}
