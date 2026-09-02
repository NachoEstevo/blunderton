export const TIER_NAMES = ['CALM', 'FAST', 'PANIC', 'CHAOS'] as const;
export type Tier = 0 | 1 | 2 | 3;

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Global difficulty level 0..1 from games cleared and time survived.
 * ~25 cleared games or ~5 minutes reaches full chaos; a mix of both gets there sooner.
 */
export function computeLevel(cleared: number, elapsedMs: number): number {
  const byGames = cleared / 26;
  const byTime = elapsedMs / 300000;
  return clamp01(0.65 * byGames + 0.35 * byTime);
}

export function tierOf(level: number): Tier {
  if (level < 0.25) return 0;
  if (level < 0.5) return 1;
  if (level < 0.75) return 2;
  return 3;
}

/** Per-game duration shrinks to ~55% at full difficulty. */
export function scaledDuration(base: number, level: number): number {
  return Math.round(base * (1 - 0.45 * level));
}

/** Transition speeds shrink to ~65% at full difficulty. */
export function transitionScale(level: number): number {
  return 1 - 0.35 * level;
}
