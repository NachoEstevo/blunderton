import { save, type SaveData } from './Save';

export type UnlockKind = 'character' | 'skin' | 'background' | 'sticker';

export interface RunState {
  score: number;
  streak: number;
  bestStreak: number;
  elapsed: number; // ms
  clearedIds: Set<string>;
  failedIds: Set<string>;
  started: boolean;
}

export interface Unlockable {
  id: string;
  kind: UnlockKind;
  name: string;
  desc: string; // how to unlock
  check: (s: SaveData, r: RunState) => boolean;
}

const clearedAny = (s: SaveData, r: RunState, ids: string[]) =>
  ids.some((id) => (s.stats.clearedById[id] ?? 0) > 0 || r.clearedIds.has(id));
const failedAny = (s: SaveData, r: RunState, ids: string[]) =>
  ids.some((id) => (s.stats.failedById[id] ?? 0) > 0 || r.failedIds.has(id));
const scoreAtLeast = (s: SaveData, r: RunState, n: number) => r.score >= n || s.best >= n;
const streakAtLeast = (s: SaveData, r: RunState, n: number) => r.bestStreak >= n || s.stats.longestStreak >= n;
const timeAtLeast = (s: SaveData, r: RunState, ms: number) => r.elapsed >= ms || s.stats.longestTime >= ms;

export const UNLOCKABLES: Unlockable[] = [
  // characters
  { id: 'char:gus', kind: 'character', name: 'Gus', desc: 'Start your first run.', check: (s, r) => r.started || s.stats.games > 0 },
  { id: 'char:nubbin', kind: 'character', name: 'Nubbin', desc: 'Rescue a snack or blow out a cake.', check: (s, r) => clearedAny(s, r, ['vending', 'cake']) },
  { id: 'char:mort', kind: 'character', name: 'Mort', desc: 'Survive a piano or a fan.', check: (s, r) => clearedAny(s, r, ['umbrella', 'fan']) },
  { id: 'char:bloom', kind: 'character', name: 'Bloom', desc: 'Float a balloon through the cactus room.', check: (s, r) => clearedAny(s, r, ['cactus']) },
  { id: 'char:pilar', kind: 'character', name: 'Pilar', desc: 'Escape the Memory Lock once.', check: (s, r) => clearedAny(s, r, ['memory']) },
  { id: 'char:rondo', kind: 'character', name: 'Chef Rondo', desc: 'Deliver the soup once.', check: (s, r) => clearedAny(s, r, ['soup']) },
  { id: 'char:toasty', kind: 'character', name: 'Toasty', desc: 'Catch every flying toast once.', check: (s, r) => clearedAny(s, r, ['toast']) },
  { id: 'char:zizz', kind: 'character', name: 'Zizz', desc: 'Get a truly terrible haircut.', check: (s, r) => failedAny(s, r, ['haircut']) },
  { id: 'char:twitch', kind: 'character', name: 'Twitch', desc: 'Reach a 5 streak.', check: (s, r) => streakAtLeast(s, r, 5) },
  { id: 'char:fizz', kind: 'character', name: 'Dr. Fizz', desc: 'Reach a score of 2,000.', check: (s, r) => scoreAtLeast(s, r, 2000) },
  // cosmetics
  { id: 'bg:dusk', kind: 'background', name: 'Dusk over Blunderton', desc: 'Score 2,000 in one run.', check: (s, r) => scoreAtLeast(s, r, 2000) },
  { id: 'bg:night', kind: 'background', name: 'Blunderton by Night', desc: 'Survive 3 minutes.', check: (s, r) => timeAtLeast(s, r, 180000) },
  { id: 'skin:gus-gold', kind: 'skin', name: 'Golden Gus', desc: 'Score 5,000 in one run.', check: (s, r) => scoreAtLeast(s, r, 5000) },
  { id: 'skin:zizz-rainbow', kind: 'skin', name: 'Rainbow Zizz', desc: 'Reach a 20 streak.', check: (s, r) => streakAtLeast(s, r, 20) },
  { id: 'skin:mort-coffee', kind: 'skin', name: 'Coffee Mort', desc: 'Survive 5 minutes.', check: (s, r) => timeAtLeast(s, r, 300000) },
  { id: 'sticker:hot', kind: 'sticker', name: 'Hot Streak', desc: 'Reach a 10 streak.', check: (s, r) => streakAtLeast(s, r, 10) },
  { id: 'sticker:mayor', kind: 'sticker', name: 'Honorary Mayor', desc: 'Score 10,000 in one run.', check: (s, r) => scoreAtLeast(s, r, 10000) },
  { id: 'sticker:tour', kind: 'sticker', name: 'Grand Tour', desc: 'Clear all 15 microgames in one run.', check: (_s, r) => r.clearedIds.size >= 15 },
  { id: 'sticker:report', kind: 'sticker', name: 'Accident Report', desc: 'Witness all 15 accidents.', check: (s) => s.accidents.length >= 15 },
  { id: 'sticker:regular', kind: 'sticker', name: 'Regular', desc: 'Play 10 runs.', check: (s) => s.stats.games >= 10 },
];

export const UNLOCK_BY_ID: Record<string, Unlockable> = Object.fromEntries(UNLOCKABLES.map((u) => [u.id, u]));

/** Evaluate every unlockable; persist and return the ones newly unlocked. */
export function evaluateUnlocks(run: RunState): Unlockable[] {
  const fresh: Unlockable[] = [];
  for (const u of UNLOCKABLES) {
    if (save.has(u.id)) continue;
    try {
      if (u.check(save.data, run)) {
        save.unlock(u.id);
        fresh.push(u);
      }
    } catch {
      /* never let an unlock rule break the game */
    }
  }
  return fresh;
}

export function isCharacterUnlocked(charId: string) {
  return save.has(`char:${charId}`);
}
