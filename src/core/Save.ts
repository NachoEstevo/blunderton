export interface Stats {
  games: number; // runs played
  cleared: number; // total microgames cleared
  failed: number;
  longestStreak: number;
  longestTime: number; // ms
  clearedById: Record<string, number>;
  failedById: Record<string, number>;
}

export interface SaveData {
  v: number;
  best: number;
  sound: boolean;
  unlocks: string[]; // unlockable ids (characters, skins, backgrounds, stickers)
  accidents: string[]; // microgame ids whose fail state has been witnessed
  menuBg: string; // chosen menu background id
  stats: Stats;
}

const KEY = 'blunderton.save.v1';

const fresh = (): SaveData => ({
  v: 1,
  best: 0,
  sound: true,
  unlocks: [],
  accidents: [],
  menuBg: 'day',
  stats: {
    games: 0,
    cleared: 0,
    failed: 0,
    longestStreak: 0,
    longestTime: 0,
    clearedById: {},
    failedById: {},
  },
});

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const parsed = JSON.parse(raw);
    const base = fresh();
    return {
      ...base,
      ...parsed,
      stats: { ...base.stats, ...(parsed.stats ?? {}) },
      unlocks: Array.isArray(parsed.unlocks) ? parsed.unlocks : [],
      accidents: Array.isArray(parsed.accidents) ? parsed.accidents : [],
    };
  } catch {
    return fresh();
  }
}

class SaveStore {
  data: SaveData = load();

  commit() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* storage unavailable (private mode) - game still works for this session */
    }
  }

  has(unlockId: string) {
    return this.data.unlocks.includes(unlockId);
  }

  unlock(id: string): boolean {
    if (this.has(id)) return false;
    this.data.unlocks.push(id);
    this.commit();
    return true;
  }

  witnessAccident(gameId: string): boolean {
    if (this.data.accidents.includes(gameId)) return false;
    this.data.accidents.push(gameId);
    this.commit();
    return true;
  }
}

export const save = new SaveStore();
