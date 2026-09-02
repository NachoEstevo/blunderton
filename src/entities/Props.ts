import Phaser from 'phaser';
import { C, darken } from '../core/Palette';

type G = Phaser.GameObjects.Graphics;
const OUT = 4;

export function outline(g: G, w = OUT) {
  g.lineStyle(w, C.charcoal, 1);
}

/** Small burst of confetti squares in the given colors. Auto-destroys. */
export function confetti(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, colors = [C.tomato, C.mustard, C.sky, C.mint, C.pink], n = 18, spread = 320) {
  for (let i = 0; i < n; i++) {
    const g = scene.add.graphics();
    const c = colors[i % colors.length];
    g.fillStyle(c, 1);
    const s = 8 + Math.random() * 8;
    if (i % 3 === 0) g.fillCircle(0, 0, s / 2);
    else g.fillRect(-s / 2, -s / 3, s, s * 0.66);
    g.setPosition(x, y);
    parent.add(g);
    const a = Math.random() * Math.PI * 2;
    const d = spread * (0.4 + Math.random() * 0.6);
    scene.tweens.add({
      targets: g,
      x: x + Math.cos(a) * d,
      y: y + Math.sin(a) * d * 0.7 + 160,
      angle: (Math.random() - 0.5) * 720,
      alpha: 0,
      duration: 700 + Math.random() * 500,
      ease: 'Quad.easeOut',
      onComplete: () => g.destroy(),
    });
  }
}

/** Cartoon dust/smoke puffs. Auto-destroys. */
export function puff(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, n = 6, color = C.creamDark, size = 22) {
  for (let i = 0; i < n; i++) {
    const g = scene.add.graphics();
    g.fillStyle(color, 1);
    g.lineStyle(3, C.charcoal, 0.6);
    g.fillCircle(0, 0, size);
    g.strokeCircle(0, 0, size);
    g.setPosition(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 20);
    g.setScale(0.3);
    parent.add(g);
    const a = Math.random() * Math.PI * 2;
    scene.tweens.add({
      targets: g,
      x: g.x + Math.cos(a) * 70,
      y: g.y + Math.sin(a) * 40 - 30,
      scale: 1 + Math.random() * 0.5,
      alpha: 0,
      duration: 500 + Math.random() * 300,
      ease: 'Quad.easeOut',
      onComplete: () => g.destroy(),
    });
  }
}

/** Little dizzy stars orbiting a point. Returns container (caller destroys or auto after dur). */
export function dizzyStars(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, dur = 1500) {
  const c = scene.add.container(x, y);
  for (let i = 0; i < 3; i++) {
    const g = scene.add.graphics();
    g.fillStyle(C.mustard, 1);
    g.lineStyle(3, C.charcoal, 1);
    drawStar(g, 0, 0, 5, 10, 5);
    const a = (i / 3) * Math.PI * 2;
    g.setPosition(Math.cos(a) * 34, Math.sin(a) * 12);
    c.add(g);
  }
  parent.add(c);
  scene.tweens.add({ targets: c, angle: 360, duration: 900, repeat: -1 });
  scene.time.delayedCall(dur, () => c.destroy());
  return c;
}

export function drawStar(g: G, cx: number, cy: number, points: number, outer: number, inner: number) {
  const pts: Phaser.Geom.Point[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    pts.push(new Phaser.Geom.Point(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  g.fillPoints(pts, true);
  g.strokePoints(pts, true, true);
}

export function drawHeart(g: G, x: number, y: number, s: number) {
  g.beginPath();
  g.moveTo(x, y + s * 0.9);
  g.lineTo(x - s, y);
  g.arc(x - s / 2, y - s * 0.1, s / 2, Math.PI, 0, false);
  g.arc(x + s / 2, y - s * 0.1, s / 2, Math.PI, 0, false);
  g.lineTo(x, y + s * 0.9);
  g.closePath();
  g.fillPath();
  g.strokePath();
}

/** Room wall with skirting board and floor. */
export function drawRoom(g: G, wall: number, floor: number, floorY = 600, W = 1280, H = 720) {
  g.fillStyle(wall, 1);
  g.fillRect(0, 0, W, floorY);
  // subtle wallpaper stripes
  g.fillStyle(darken(wall, 0.95), 1);
  for (let x = 40; x < W; x += 120) g.fillRect(x, 0, 30, floorY);
  g.fillStyle(floor, 1);
  g.fillRect(0, floorY, W, H - floorY);
  g.lineStyle(5, C.charcoal, 1);
  g.lineBetween(0, floorY, W, floorY);
  g.fillStyle(darken(floor, 0.85), 1);
  for (let x = 0; x < W; x += 160) g.fillRect(x + 6, floorY + 8, 148, 6);
}

export function drawSky(g: G, top: number, horizonY = 600, W = 1280) {
  g.fillStyle(top, 1);
  g.fillRect(0, 0, W, horizonY);
}

export function drawCloud(g: G, x: number, y: number, s = 1) {
  g.fillStyle(C.white, 1);
  g.lineStyle(4, C.charcoal, 1);
  const parts: Array<[number, number, number]> = [
    [0, 0, 34],
    [-38, 10, 26],
    [40, 8, 28],
    [8, -18, 24],
  ];
  for (const [dx, dy, r] of parts) g.fillCircle(x + dx * s, y + dy * s, r * s);
  g.fillRect(x - 50 * s, y + 6 * s, 100 * s, 26 * s);
  // outline only the bottom to keep it soft
  g.lineBetween(x - 62 * s, y + 32 * s, x + 66 * s, y + 32 * s);
}

export function drawCactus(g: G, x: number, baseY: number, h: number, w = 46, arms = true) {
  g.fillStyle(C.mintDark, 1);
  g.lineStyle(4, C.charcoal, 1);
  g.fillRoundedRect(x - w / 2, baseY - h, w, h, w / 2);
  g.strokeRoundedRect(x - w / 2, baseY - h, w, h, w / 2);
  if (arms && h > 90) {
    const ay = baseY - h * 0.55;
    g.fillRoundedRect(x - w / 2 - 26, ay - 10, 30, 22, 10);
    g.strokeRoundedRect(x - w / 2 - 26, ay - 10, 30, 22, 10);
    g.fillRoundedRect(x - w / 2 - 26, ay - 40, 22, 40, 10);
    g.strokeRoundedRect(x - w / 2 - 26, ay - 40, 22, 40, 10);
    g.fillRoundedRect(x + w / 2 - 4, ay + 6, 30, 22, 10);
    g.strokeRoundedRect(x + w / 2 - 4, ay + 6, 30, 22, 10);
    g.fillRoundedRect(x + w / 2 + 4, ay - 24, 22, 40, 10);
    g.strokeRoundedRect(x + w / 2 + 4, ay - 24, 22, 40, 10);
  }
  // spines
  g.lineStyle(2, C.charcoal, 1);
  for (let yy = baseY - h + 20; yy < baseY - 10; yy += 18) {
    g.lineBetween(x - w / 2 - 6, yy, x - w / 2 + 2, yy - 4);
    g.lineBetween(x + w / 2 + 6, yy + 8, x + w / 2 - 2, yy + 4);
  }
  // face-ish highlight
  g.fillStyle(0x8de6bb, 1);
  g.fillRoundedRect(x - 6, baseY - h + 14, 8, h * 0.4, 4);
}

export function drawToast(g: G, x: number, y: number, s = 1, burnt = false) {
  g.fillStyle(burnt ? 0x4a3323 : 0xe0a25a, 1);
  g.lineStyle(4, C.charcoal, 1);
  const w = 56 * s;
  const h = 56 * s;
  g.fillRoundedRect(x - w / 2, y - h / 2 + 8 * s, w, h - 8 * s, 8 * s);
  g.fillCircle(x - w / 4, y - h / 2 + 12 * s, 14 * s);
  g.fillCircle(x + w / 4, y - h / 2 + 12 * s, 14 * s);
  g.strokeRoundedRect(x - w / 2, y - h / 2 + 8 * s, w, h - 8 * s, 8 * s);
  g.fillStyle(burnt ? 0x2b2622 : 0xf6d89a, 1);
  g.fillRoundedRect(x - w / 2 + 8 * s, y - h / 2 + 16 * s, w - 16 * s, h - 24 * s, 6 * s);
  g.lineStyle(4, C.charcoal, 1);
  g.beginPath();
  g.arc(x - w / 4, y - h / 2 + 12 * s, 14 * s, Math.PI, Math.PI * 1.9, false);
  g.strokePath();
  g.beginPath();
  g.arc(x + w / 4, y - h / 2 + 12 * s, 14 * s, Math.PI * 1.1, Math.PI * 2, false);
  g.strokePath();
}

export function drawBrick(g: G, x: number, y: number, s = 1) {
  g.fillStyle(0x8c4a3a, 1);
  g.lineStyle(4, C.charcoal, 1);
  g.fillRoundedRect(x - 32 * s, y - 20 * s, 64 * s, 40 * s, 4 * s);
  g.strokeRoundedRect(x - 32 * s, y - 20 * s, 64 * s, 40 * s, 4 * s);
  g.lineStyle(3, 0x5c2e22, 1);
  g.lineBetween(x - 32 * s, y, x + 32 * s, y);
  g.lineBetween(x, y - 20 * s, x, y);
  g.lineBetween(x - 16 * s, y, x - 16 * s, y + 20 * s);
  g.lineBetween(x + 16 * s, y, x + 16 * s, y + 20 * s);
  // heat lines
  g.lineStyle(3, C.tomato, 1);
  for (let i = -1; i <= 1; i++) {
    g.beginPath();
    g.moveTo(x + i * 16 * s, y - 24 * s);
    g.lineTo(x + i * 16 * s + 4 * s, y - 32 * s);
    g.lineTo(x + i * 16 * s, y - 40 * s);
    g.strokePath();
  }
}

/** Shared food/junk item renderer for pickups. */
export type ItemKind = 'apple' | 'burger' | 'drumstick' | 'cupcake' | 'shoe' | 'brick' | 'sock' | 'bulb' | 'duck';
export const FOODS: ItemKind[] = ['apple', 'burger', 'drumstick', 'cupcake'];
export const JUNK: ItemKind[] = ['shoe', 'brick', 'sock', 'bulb'];

export function drawItem(g: G, kind: ItemKind, x = 0, y = 0, s = 1) {
  g.lineStyle(4, C.charcoal, 1);
  switch (kind) {
    case 'apple':
      g.fillStyle(C.tomato, 1);
      g.fillCircle(x, y + 4 * s, 24 * s);
      g.strokeCircle(x, y + 4 * s, 24 * s);
      g.fillStyle(C.mintDark, 1);
      g.fillEllipse(x + 10 * s, y - 20 * s, 18 * s, 10 * s);
      g.lineBetween(x, y - 18 * s, x, y - 28 * s);
      break;
    case 'burger':
      g.fillStyle(0xe0a25a, 1);
      g.fillRoundedRect(x - 28 * s, y - 22 * s, 56 * s, 22 * s, 12 * s);
      g.strokeRoundedRect(x - 28 * s, y - 22 * s, 56 * s, 22 * s, 12 * s);
      g.fillStyle(C.mint, 1);
      g.fillRect(x - 30 * s, y - 2 * s, 60 * s, 6 * s);
      g.fillStyle(0x7a4a2a, 1);
      g.fillRect(x - 28 * s, y + 4 * s, 56 * s, 10 * s);
      g.strokeRect(x - 28 * s, y + 4 * s, 56 * s, 10 * s);
      g.fillStyle(0xe0a25a, 1);
      g.fillRoundedRect(x - 28 * s, y + 14 * s, 56 * s, 12 * s, 6 * s);
      g.strokeRoundedRect(x - 28 * s, y + 14 * s, 56 * s, 12 * s, 6 * s);
      break;
    case 'drumstick':
      g.fillStyle(0xd08a4a, 1);
      g.fillEllipse(x + 8 * s, y - 4 * s, 40 * s, 32 * s);
      g.strokeEllipse(x + 8 * s, y - 4 * s, 40 * s, 32 * s);
      g.fillStyle(C.white, 1);
      g.fillRoundedRect(x - 30 * s, y + 6 * s, 24 * s, 10 * s, 5 * s);
      g.strokeRoundedRect(x - 30 * s, y + 6 * s, 24 * s, 10 * s, 5 * s);
      g.fillCircle(x - 30 * s, y + 6 * s, 6 * s);
      g.fillCircle(x - 30 * s, y + 16 * s, 6 * s);
      break;
    case 'cupcake':
      g.fillStyle(C.mustardDark, 1);
      g.fillTriangle(x - 24 * s, y - 2 * s, x + 24 * s, y - 2 * s, x + 16 * s, y + 26 * s);
      g.fillTriangle(x - 24 * s, y - 2 * s, x - 16 * s, y + 26 * s, x + 16 * s, y + 26 * s);
      g.strokeTriangle(x - 24 * s, y - 2 * s, x + 24 * s, y - 2 * s, x + 16 * s, y + 26 * s);
      g.fillStyle(C.pink, 1);
      g.fillCircle(x, y - 12 * s, 22 * s);
      g.strokeCircle(x, y - 12 * s, 22 * s);
      g.fillStyle(C.tomato, 1);
      g.fillCircle(x, y - 34 * s, 6 * s);
      break;
    case 'shoe':
      g.fillStyle(C.brown, 1);
      g.fillRoundedRect(x - 30 * s, y - 4 * s, 60 * s, 24 * s, 8 * s);
      g.strokeRoundedRect(x - 30 * s, y - 4 * s, 60 * s, 24 * s, 8 * s);
      g.fillRoundedRect(x - 30 * s, y - 24 * s, 28 * s, 26 * s, 6 * s);
      g.strokeRoundedRect(x - 30 * s, y - 24 * s, 28 * s, 26 * s, 6 * s);
      g.fillStyle(C.white, 1);
      g.fillRect(x - 30 * s, y + 12 * s, 60 * s, 8 * s);
      g.lineStyle(3, C.charcoal, 1);
      g.lineBetween(x - 24 * s, y - 14 * s, x - 8 * s, y - 14 * s);
      g.lineBetween(x - 24 * s, y - 6 * s, x - 8 * s, y - 6 * s);
      break;
    case 'brick':
      drawBrick(g, x, y, s * 0.8);
      break;
    case 'sock':
      g.fillStyle(C.sky, 1);
      g.fillRoundedRect(x - 12 * s, y - 28 * s, 26 * s, 40 * s, 8 * s);
      g.strokeRoundedRect(x - 12 * s, y - 28 * s, 26 * s, 40 * s, 8 * s);
      g.fillRoundedRect(x - 30 * s, y, 44 * s, 24 * s, 12 * s);
      g.strokeRoundedRect(x - 30 * s, y, 44 * s, 24 * s, 12 * s);
      g.fillStyle(C.white, 1);
      g.fillRect(x - 12 * s, y - 28 * s, 26 * s, 8 * s);
      g.fillStyle(C.mustard, 1);
      g.fillCircle(x - 2 * s, y - 8 * s, 5 * s);
      break;
    case 'bulb':
      g.fillStyle(C.mustard, 1);
      g.fillCircle(x, y - 8 * s, 22 * s);
      g.strokeCircle(x, y - 8 * s, 22 * s);
      g.fillStyle(C.grey, 1);
      g.fillRect(x - 12 * s, y + 10 * s, 24 * s, 16 * s);
      g.strokeRect(x - 12 * s, y + 10 * s, 24 * s, 16 * s);
      g.lineStyle(3, C.charcoal, 1);
      g.lineBetween(x - 8 * s, y - 8 * s, x, y + 2 * s);
      g.lineBetween(x + 8 * s, y - 8 * s, x, y + 2 * s);
      break;
    case 'duck':
      g.fillStyle(C.mustard, 1);
      g.fillEllipse(x, y + 8 * s, 52 * s, 34 * s);
      g.strokeEllipse(x, y + 8 * s, 52 * s, 34 * s);
      g.fillCircle(x + 14 * s, y - 12 * s, 18 * s);
      g.strokeCircle(x + 14 * s, y - 12 * s, 18 * s);
      g.fillStyle(C.orange, 1);
      g.fillTriangle(x + 30 * s, y - 14 * s, x + 46 * s, y - 8 * s, x + 30 * s, y - 4 * s);
      g.fillStyle(C.charcoal, 1);
      g.fillCircle(x + 18 * s, y - 16 * s, 3 * s);
      break;
  }
}

/** Squash a game object briefly (juice on click). */
export function squash(scene: Phaser.Scene, target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject, sx = 1.2, sy = 0.8, dur = 90, base = 1) {
  scene.tweens.add({
    targets: target,
    scaleX: base * sx,
    scaleY: base * sy,
    duration: dur,
    yoyo: true,
    ease: 'Quad.easeOut',
    onComplete: () => {
      if (target.active) target.setScale(base);
    },
  });
}

/** Floating text that rises and fades. */
export function floatText(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, txt: Phaser.GameObjects.Text, rise = 60, dur = 800) {
  txt.setPosition(x, y);
  parent.add(txt);
  txt.setScale(0.6);
  scene.tweens.add({ targets: txt, scale: 1, duration: 140, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: txt, y: y - rise, alpha: 0, duration: dur, delay: 200, ease: 'Quad.easeIn', onComplete: () => txt.destroy() });
}

/** Speech bubble with short text. Returns container. */
export function bubble(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, text: Phaser.GameObjects.Text, tail: 'left' | 'right' = 'left') {
  const w = text.width + 30;
  const h = text.height + 18;
  const g = scene.add.graphics();
  g.fillStyle(C.white, 1);
  g.lineStyle(4, C.charcoal, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
  const tx = tail === 'left' ? -w / 4 : w / 4;
  g.fillTriangle(tx - 10, h / 2 - 2, tx + 10, h / 2 - 2, tx - 4, h / 2 + 16);
  g.lineBetween(tx - 10, h / 2, tx - 4, h / 2 + 16);
  g.lineBetween(tx + 10, h / 2, tx - 4, h / 2 + 16);
  text.setPosition(0, 0);
  const c = scene.add.container(x, y, [g, text]);
  parent.add(c);
  c.setScale(0);
  scene.tweens.add({ targets: c, scale: 1, duration: 200, ease: 'Back.easeOut' });
  return c;
}
