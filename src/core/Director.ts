import { computeLevel, tierOf, scaledDuration, clamp01, type Tier } from './Difficulty';
import { save } from './Save';
import { evaluateUnlocks, type RunState, type Unlockable } from './Unlocks';
import { MICROGAMES, type Registered } from '../microgames/registry';
import type { GameContext, MicrogameMeta } from '../microgames/Microgame';

export interface ResolveResult {
  win: boolean;
  gain: number;
  streak: number;
  milestone: number | null; // streak milestone hit this game
  lifeLost: boolean;
  gameOver: boolean;
  newUnlocks: Unlockable[];
  newAccident: boolean;
}

export interface RunSummary {
  score: number;
  best: number;
  newBest: boolean;
  elapsed: number;
  cleared: number;
  bestStreak: number;
  unlocks: Unlockable[];
  lastCharacter: string;
}

const STARTERS = ['vending', 'cactus', 'haircut'];
const MILESTONES = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];

/**
 * Owns the run: lives, score, streak, difficulty, game selection (shuffled bag with
 * similarity avoidance), persistence and unlocks. Microgames never touch this directly.
 */
export class Director {
  lives = 3;
  score = 0;
  streak = 0;
  bestStreak = 0;
  cleared = 0;
  played = 0;
  startTime = 0;
  elapsed = 0;
  private bag: string[] = [];
  private history: string[] = [];
  private seen: Record<string, number> = {};
  clearedIds = new Set<string>();
  failedIds = new Set<string>();
  runUnlocks: Unlockable[] = [];
  firstRun = false;
  lastCharacter = 'gus';
  // debug
  private forced: string[] | null = null;
  private forcedIdx = 0;
  private finished = false;

  constructor(debugGame?: string | null) {
    if (debugGame) {
      if (debugGame === 'all') this.forced = MICROGAMES.map((m) => m.meta.id);
      else {
        const ids = debugGame.split(',').filter((id) => MICROGAMES.some((m) => m.meta.id === id));
        this.forced = ids.length ? ids : null;
      }
    }
  }

  start() {
    this.lives = 3;
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.cleared = 0;
    this.played = 0;
    this.elapsed = 0;
    this.startTime = performance.now();
    this.history = [];
    this.seen = {};
    this.clearedIds.clear();
    this.failedIds.clear();
    this.runUnlocks = [];
    this.finished = false;
    this.firstRun = save.data.stats.games === 0;
    this.bag = [];
    this.refillBag(true);
    // first-ever run opens with three especially readable games
    if (this.firstRun && !this.forced) {
      this.bag = [...STARTERS, ...this.bag.filter((id) => !STARTERS.includes(id))];
    }
    save.data.stats.games += 1;
    save.commit();
    this.runUnlocks.push(...evaluateUnlocks(this.runState()));
  }

  tick() {
    this.elapsed = performance.now() - this.startTime;
  }

  level(): number {
    const base = computeLevel(this.cleared, this.elapsed);
    return base;
  }

  tier(): Tier {
    return tierOf(this.level());
  }

  private refillBag(first = false) {
    const ids = MICROGAMES.map((m) => m.meta.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    if (!first) {
      const last = this.history[this.history.length - 1];
      if (ids[0] === last && ids.length > 1) [ids[0], ids[1]] = [ids[1], ids[0]];
    }
    this.bag.push(...ids);
  }

  private conflicts(id: string): boolean {
    const last = this.history[this.history.length - 1];
    if (!last) return false;
    if (last === id) return true;
    const a = MICROGAMES.find((m) => m.meta.id === id)!.meta.group;
    const b = MICROGAMES.find((m) => m.meta.id === last)!.meta.group;
    return a === b;
  }

  pickNext(): Registered {
    let id: string;
    if (this.forced) {
      id = this.forced[this.forcedIdx % this.forced.length];
      this.forcedIdx++;
    } else {
      if (this.bag.length === 0) this.refillBag();
      let idx = 0;
      if (this.conflicts(this.bag[0])) {
        const alt = this.bag.findIndex((g) => !this.conflicts(g));
        if (alt > 0) idx = alt;
      }
      id = this.bag.splice(idx, 1)[0];
    }
    this.history.push(id);
    const reg = MICROGAMES.find((m) => m.meta.id === id)!;
    this.lastCharacter = reg.meta.character;
    return reg;
  }

  buildContext(meta: MicrogameMeta): GameContext {
    const seen = this.seen[meta.id] ?? 0;
    this.seen[meta.id] = seen + 1;
    const level = this.level();
    // returning games come back a bit meaner than the global level alone
    const difficulty = clamp01(level + seen * 0.07);
    let duration = scaledDuration(meta.baseDuration, difficulty);
    if (this.firstRun && this.played < 3) duration += 1500;
    return {
      difficulty,
      tier: tierOf(level),
      seen,
      firstRun: this.firstRun,
      index: this.played,
      duration,
    };
  }

  private runState(): RunState {
    return {
      score: this.score,
      streak: this.streak,
      bestStreak: this.bestStreak,
      elapsed: this.elapsed,
      clearedIds: this.clearedIds,
      failedIds: this.failedIds,
      started: true,
    };
  }

  /** Register a game outcome. remainingFrac is the timer fraction left (speed bonus). */
  resolve(id: string, win: boolean, remainingFrac: number): ResolveResult {
    this.tick();
    this.played += 1;
    let gain = 0;
    let milestone: number | null = null;
    let lifeLost = false;
    let newAccident = false;
    const stats = save.data.stats;
    if (win) {
      this.cleared += 1;
      this.streak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.clearedIds.add(id);
      const tier = this.tier();
      const speed = Math.round(clamp01(remainingFrac) * 100);
      const streakBonus = Math.min(this.streak, 20) * 10;
      gain = 100 + speed + streakBonus + tier * 25;
      if (MILESTONES.includes(this.streak)) {
        milestone = this.streak;
        gain += this.streak * 20;
      }
      gain = Math.round(gain / 10) * 10;
      this.score += gain;
      stats.cleared += 1;
      stats.clearedById[id] = (stats.clearedById[id] ?? 0) + 1;
    } else {
      this.streak = 0;
      this.lives -= 1;
      lifeLost = true;
      this.failedIds.add(id);
      stats.failed += 1;
      stats.failedById[id] = (stats.failedById[id] ?? 0) + 1;
      newAccident = save.witnessAccident(id);
    }
    stats.longestStreak = Math.max(stats.longestStreak, this.bestStreak);
    if (this.score > save.data.best) save.data.best = this.score;
    save.commit();
    const newUnlocks = evaluateUnlocks(this.runState());
    this.runUnlocks.push(...newUnlocks);
    return {
      win,
      gain,
      streak: this.streak,
      milestone,
      lifeLost,
      gameOver: this.lives <= 0,
      newUnlocks,
      newAccident,
    };
  }

  /** Close the run and persist. Safe to call once. */
  finish(): RunSummary {
    this.tick();
    const stats = save.data.stats;
    this.finished = true;
    stats.longestTime = Math.max(stats.longestTime, this.elapsed);
    stats.longestStreak = Math.max(stats.longestStreak, this.bestStreak);
    const newBest = this.score > 0 && this.score > this.bestBefore;
    save.data.best = Math.max(save.data.best, this.score);
    save.commit();
    const more = evaluateUnlocks(this.runState());
    this.runUnlocks.push(...more);
    return {
      score: this.score,
      best: save.data.best,
      newBest,
      elapsed: this.elapsed,
      cleared: this.cleared,
      bestStreak: this.bestStreak,
      unlocks: this.runUnlocks,
      lastCharacter: this.lastCharacter,
    };
  }

  /** Best score before this run began (captured at start). */
  bestBefore = 0;
  captureBest() {
    this.bestBefore = save.data.best;
  }
}
