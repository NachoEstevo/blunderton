import { C } from '../core/Palette';
import { save } from '../core/Save';

export type Shape = 'wide' | 'tall' | 'tri' | 'round' | 'small' | 'fluff' | 'box' | 'noodle' | 'toaster' | 'chef';
export type Hair = 'none' | 'tuft' | 'spiky' | 'wild' | 'antenna' | 'curl';
export type Hat = 'none' | 'cap' | 'chef' | 'goggles' | 'crown';

export interface CharacterDef {
  id: string;
  name: string;
  color: number;
  accent: number;
  shape: Shape;
  hair: Hair;
  hat: Hat;
  tie?: boolean;
  mustache?: boolean;
  eyebags?: boolean;
  bandana?: boolean;
  jitter?: boolean; // perpetually nervous
  alwaysHappy?: boolean;
  trait: string;
  quote: string;
  games: string[]; // microgame ids featuring this one
  unlockHint: string;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'gus',
    name: 'Gus',
    color: C.orange,
    accent: C.sky,
    shape: 'wide',
    hair: 'none',
    hat: 'cap',
    trait: 'Dangerously confident',
    quote: '"Relax. I have done this zero times."',
    games: ['cart', 'bridge'],
    unlockHint: 'Start your first run.',
  },
  {
    id: 'pilar',
    name: 'Pilar',
    color: C.sky,
    accent: C.pink,
    shape: 'tall',
    hair: 'tuft',
    hat: 'none',
    trait: 'Eternally confused',
    quote: '"Wait, which door was I?"',
    games: ['memory'],
    unlockHint: 'Escape the Memory Lock once.',
  },
  {
    id: 'nubbin',
    name: 'Nubbin',
    color: C.mustard,
    accent: C.tomato,
    shape: 'tri',
    hair: 'none',
    hat: 'none',
    bandana: true,
    trait: 'Thinks with the stomach',
    quote: '"Is it food? Then it is mine."',
    games: ['vending', 'cake'],
    unlockHint: 'Rescue a snack or blow out a cake.',
  },
  {
    id: 'fizz',
    name: 'Dr. Fizz',
    color: C.violet,
    accent: C.mint,
    shape: 'round',
    hair: 'antenna',
    hat: 'goggles',
    trait: 'Incompetent inventor',
    quote: '"It is only a small explosion."',
    games: ['chair', 'buttons'],
    unlockHint: 'Reach a score of 2,000.',
  },
  {
    id: 'twitch',
    name: 'Twitch',
    color: C.pink,
    accent: C.mustard,
    shape: 'small',
    hair: 'spiky',
    hat: 'none',
    jitter: true,
    trait: 'Extremely nervous',
    quote: '"Something is about to go wrong. I can feel it."',
    games: ['plant', 'roomba'],
    unlockHint: 'Reach a 5 streak.',
  },
  {
    id: 'bloom',
    name: 'Bloom',
    color: C.mint,
    accent: C.pink,
    shape: 'fluff',
    hair: 'none',
    hat: 'none',
    alwaysHappy: true,
    trait: 'Inexplicably happy',
    quote: '"What a lovely day for a cactus room!"',
    games: ['cactus'],
    unlockHint: 'Float a balloon through the cactus room.',
  },
  {
    id: 'mort',
    name: 'Mort',
    color: C.greyDark,
    accent: C.tomato,
    shape: 'box',
    hair: 'none',
    hat: 'none',
    tie: true,
    eyebags: true,
    trait: 'Exhausted office worker',
    quote: '"Can this wait until after lunch?"',
    games: ['umbrella', 'fan'],
    unlockHint: 'Survive a piano or a fan.',
  },
  {
    id: 'zizz',
    name: 'Zizz',
    color: C.tomato,
    accent: C.mustard,
    shape: 'noodle',
    hair: 'wild',
    hat: 'none',
    trait: 'Pure chaos, long arms',
    quote: '"AAAAAAAAAAAAAAAAA!"',
    games: ['haircut'],
    unlockHint: 'Get a truly terrible haircut.',
  },
  {
    id: 'toasty',
    name: 'Toasty',
    color: C.grey,
    accent: C.tomato,
    shape: 'toaster',
    hair: 'none',
    hat: 'none',
    trait: 'Half creature, half appliance',
    quote: '"We do not talk about breakfast."',
    games: ['toast'],
    unlockHint: 'Catch every flying toast once.',
  },
  {
    id: 'rondo',
    name: 'Chef Rondo',
    color: C.mintDark,
    accent: C.white,
    shape: 'chef',
    hair: 'none',
    hat: 'chef',
    mustache: true,
    trait: 'Passionate about soup',
    quote: '"The soup must arrive. The soup ALWAYS arrives."',
    games: ['soup'],
    unlockHint: 'Deliver the soup once.',
  },
];

export const CHAR_BY_ID: Record<string, CharacterDef> = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));

/** Skins change a character's look once unlocked. Applied automatically. */
export const SKINS: Record<string, Partial<CharacterDef>> = {
  'skin:gus-gold': { color: 0xf5c542, accent: C.tomato, hat: 'crown' },
  'skin:zizz-rainbow': { color: 0xff6fa5, accent: 0x6fd6ff },
  'skin:mort-coffee': { color: C.brown, accent: C.mint },
};

const SKIN_OWNER: Record<string, string> = {
  'skin:gus-gold': 'gus',
  'skin:zizz-rainbow': 'zizz',
  'skin:mort-coffee': 'mort',
};

/** Character definition with any unlocked skin applied. */
export function getCharacter(id: string, allowSkin = true): CharacterDef {
  const base = CHAR_BY_ID[id] ?? CHARACTERS[0];
  if (!allowSkin) return base;
  let def = base;
  for (const [skinId, owner] of Object.entries(SKIN_OWNER)) {
    if (owner === id && save.has(skinId)) def = { ...def, ...SKINS[skinId] };
  }
  return def;
}
