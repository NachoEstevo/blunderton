// Blunderton palette: warm cream, tomato, mustard, sky, mint, pink, violet, charcoal.
export const C = {
  cream: 0xfbf1dc,
  creamDark: 0xeadcbd,
  paper: 0xfff8e8,
  tomato: 0xe84a3a,
  tomatoDark: 0xb3352a,
  mustard: 0xf2b63a,
  mustardDark: 0xc48f22,
  sky: 0x59b8e8,
  skyDark: 0x3a8fc0,
  skyLight: 0xa9dcf5,
  mint: 0x6fd6a5,
  mintDark: 0x45a87a,
  pink: 0xf58fb0,
  pinkDark: 0xd0658c,
  violet: 0x4b2e6b,
  violetDark: 0x2e1b45,
  charcoal: 0x2b2622,
  white: 0xfffdf8,
  grey: 0xc9d3dc,
  greyDark: 0x8a97a3,
  brown: 0x9c6b3c,
  brownDark: 0x6b452a,
  peach: 0xffb27a,
  orange: 0xf07f2e,
  wood: 0xd9a066,
  soup: 0xf5a23a,
  lime: 0xb7d94a,
};

export const hex = (n: number): string => '#' + n.toString(16).padStart(6, '0');

export const PALETTE_CYCLE = [C.tomato, C.mustard, C.sky, C.mint, C.pink, C.violet];

/** Darken a 0xRRGGBB color by factor (0..1). */
export function darken(color: number, f = 0.75): number {
  const r = Math.floor(((color >> 16) & 0xff) * f);
  const g = Math.floor(((color >> 8) & 0xff) * f);
  const b = Math.floor((color & 0xff) * f);
  return (r << 16) | (g << 8) | b;
}

export function lighten(color: number, f = 0.25): number {
  const r = Math.min(255, Math.floor(((color >> 16) & 0xff) + (255 - ((color >> 16) & 0xff)) * f));
  const g = Math.min(255, Math.floor(((color >> 8) & 0xff) + (255 - ((color >> 8) & 0xff)) * f));
  const b = Math.min(255, Math.floor((color & 0xff) + (255 - (color & 0xff)) * f));
  return (r << 16) | (g << 8) | b;
}
