import Phaser from 'phaser';
import { hex, C } from '../core/Palette';

export const FONT_TITLE = 'Impact, "Arial Black", "Trebuchet MS", sans-serif';
export const FONT_BODY = '"Trebuchet MS", Verdana, "Segoe UI", Arial, sans-serif';

export interface LabelOpts {
  size?: number;
  color?: number | string;
  stroke?: number | string;
  strokeWidth?: number;
  family?: string;
  align?: 'left' | 'center' | 'right';
  shadow?: boolean;
  weight?: string;
  wrap?: number;
  origin?: [number, number];
}

const toCss = (c: number | string | undefined, fallback: string) =>
  c === undefined ? fallback : typeof c === 'number' ? hex(c) : c;

/** Chunky outlined label used everywhere in the UI. */
export function label(scene: Phaser.Scene, x: number, y: number, text: string, o: LabelOpts = {}) {
  const size = o.size ?? 28;
  const t = scene.add.text(x, y, text, {
    fontFamily: o.family ?? FONT_BODY,
    fontSize: `${size}px`,
    fontStyle: o.weight ?? '900',
    color: toCss(o.color, hex(C.white)),
    stroke: toCss(o.stroke, hex(C.charcoal)),
    strokeThickness: o.strokeWidth ?? Math.max(3, Math.round(size * 0.18)),
    align: o.align ?? 'center',
    wordWrap: o.wrap ? { width: o.wrap } : undefined,
  });
  const [ox, oy] = o.origin ?? [0.5, 0.5];
  t.setOrigin(ox, oy);
  if (o.shadow !== false) {
    t.setShadow(0, Math.max(2, Math.round(size * 0.08)), hex(C.charcoal), 0, true, true);
  }
  return t;
}

/** Big display title font. */
export function title(scene: Phaser.Scene, x: number, y: number, text: string, o: LabelOpts = {}) {
  return label(scene, x, y, text, { family: FONT_TITLE, weight: 'normal', size: 64, ...o });
}
