import Phaser from 'phaser';
import { GameInput } from '../core/GameInput';
import type { Tier } from '../core/Difficulty';
import { label, type LabelOpts } from '../ui/Text';
import { C } from '../core/Palette';
import { Critter } from '../entities/Critter';
import { getCharacter } from '../entities/Characters';

export const W = 1280;
export const H = 720;

export interface MicrogameMeta {
  id: string;
  name: string;
  instruction: string; // 1-3 words shown before the game
  mechanic: string; // human readable
  group: string; // similarity group used to avoid back-to-back repeats
  baseDuration: number; // ms at difficulty 0
  timeoutWins: boolean; // survive-until-timer games
  character: string; // main character id
  accident: { name: string; desc: string };
}

export interface GameContext {
  difficulty: number; // 0..1 effective difficulty for this game
  tier: Tier;
  seen: number; // how many times this game already appeared in this run
  firstRun: boolean; // player's very first run (assist mode)
  index: number; // game index within the run
  duration: number; // ms actually granted
}

/** What a microgame needs from its host scene. */
export interface MicrogameHost extends Phaser.Scene {
  resolve(win: boolean): void;
  remainingFrac(): number;
  shakeCam(intensity?: number, dur?: number): void;
  flashCam(color?: number, dur?: number): void;
}

/**
 * Base class for every microgame. Lifecycle: build() -> (instruction card) -> begin() -> update()* -> win()/lose()
 * -> onWin()/onLose() plays the outcome and returns how long to hold before the transition -> destroy().
 * All tweens/timers created through the helpers are killed on destroy.
 */
export abstract class Microgame {
  abstract readonly meta: MicrogameMeta;
  scene: MicrogameHost;
  ctx: GameContext;
  root: Phaser.GameObjects.Container;
  input: GameInput;
  private tws: Phaser.Tweens.Tween[] = [];
  private timers: Phaser.Time.TimerEvent[] = [];
  done = false;
  started = false;

  constructor(scene: MicrogameHost, ctx: GameContext) {
    this.scene = scene;
    this.ctx = ctx;
    this.root = scene.add.container(0, 0);
    this.input = new GameInput(scene);
    this.input.enabled = false;
  }

  /** 0..1 difficulty shortcut */
  get d() {
    return this.ctx.difficulty;
  }

  /** Linear interpolation on difficulty: a at d=0, b at d=1 */
  lerpD(a: number, b: number) {
    return a + (b - a) * this.d;
  }

  abstract build(): void;
  /** Called when the instruction card leaves; enable input and motion here. */
  begin(): void {
    this.started = true;
    this.input.enabled = true;
  }
  update(_time: number, _delta: number): void {}
  /** Plays the victory beat. Return ms to hold before transition. */
  abstract onWin(): number;
  /** Plays the accident. Return ms to hold before transition. */
  abstract onLose(): number;
  /** Timer ran out. */
  onTimeout(): void {
    if (this.meta.timeoutWins) this.win();
    else this.lose();
  }

  win() {
    if (this.done) return;
    this.done = true;
    this.input.enabled = false;
    this.scene.resolve(true);
  }

  lose() {
    if (this.done) return;
    this.done = true;
    this.input.enabled = false;
    this.scene.resolve(false);
  }

  // ------------------------------------------------------------ helpers
  tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Phaser.Tweens.Tween {
    const t = this.scene.tweens.add(cfg);
    this.tws.push(t);
    return t;
  }

  counter(cfg: Phaser.Types.Tweens.NumberTweenBuilderConfig): Phaser.Tweens.Tween {
    const t = this.scene.tweens.addCounter(cfg);
    this.tws.push(t);
    return t;
  }

  after(ms: number, cb: () => void): Phaser.Time.TimerEvent {
    const t = this.scene.time.delayedCall(ms, () => {
      if (this.root.active) cb();
    });
    this.timers.push(t);
    return t;
  }

  every(ms: number, cb: () => void): Phaser.Time.TimerEvent {
    const t = this.scene.time.addEvent({ delay: ms, loop: true, callback: () => this.root.active && cb() });
    this.timers.push(t);
    return t;
  }

  gfx(): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    this.root.add(g);
    return g;
  }

  text(x: number, y: number, str: string, o: LabelOpts = {}) {
    const t = label(this.scene, x, y, str, o);
    this.root.add(t);
    return t;
  }

  critter(id: string, x: number, y: number, size = 1) {
    const c = new Critter(this.scene, x, y, getCharacter(id), size);
    this.root.add(c);
    c.startIdle();
    return c;
  }

  /** Flat background fill. */
  bg(color: number) {
    const g = this.gfx();
    g.fillStyle(color, 1);
    g.fillRect(0, 0, W, H);
    return g;
  }

  /** Short outcome caption ("SAFE!", "SPLAT.") that stamps in. */
  caption(str: string, color: number = C.white, y = 130) {
    const t = this.text(W / 2, y, str, { size: 68, color, family: 'Impact, "Arial Black", sans-serif', weight: 'normal', strokeWidth: 10 });
    t.setScale(0).setAngle(-6);
    this.tween({ targets: t, scale: 1, duration: 220, ease: 'Back.easeOut' });
    return t;
  }

  /** Touch hint pads for left/right games (also shows keyboard hint on desktop). */
  sidePads(leftLabel = '◀', rightLabel = '▶') {
    const g = this.gfx();
    g.fillStyle(C.charcoal, 0.08);
    g.fillRoundedRect(20, 560, 200, 130, 24);
    g.fillRoundedRect(W - 220, 560, 200, 130, 24);
    const l = this.text(120, 625, leftLabel, { size: 52, color: C.charcoal, strokeWidth: 0, shadow: false });
    const r = this.text(W - 120, 625, rightLabel, { size: 52, color: C.charcoal, strokeWidth: 0, shadow: false });
    l.setAlpha(0.35);
    r.setAlpha(0.35);
    return { g, l, r };
  }

  destroy() {
    this.input.destroy();
    this.tws.forEach((t) => t.stop());
    this.tws = [];
    this.timers.forEach((t) => t.remove(false));
    this.timers = [];
    this.root.destroy(true);
  }
}
