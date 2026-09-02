import Phaser from 'phaser';
import { C, PALETTE_CYCLE } from '../core/Palette';
import { audio } from '../core/Audio';

type Kind = 'diag' | 'iris' | 'slats' | 'drop';

/**
 * Full-screen transitions between microgames. cover() hides the screen, uncover() reveals it.
 * Kinds rotate so the flow never feels mechanical.
 */
export class Transition extends Phaser.GameObjects.Container {
  private idx = 0;
  private kind: Kind = 'diag';
  private color = C.tomato;
  private W = 1280;
  private H = 720;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.setDepth(900);
    scene.add.existing(this);
  }

  private nextStyle() {
    const kinds: Kind[] = ['diag', 'iris', 'slats', 'drop'];
    this.kind = kinds[this.idx % kinds.length];
    this.color = PALETTE_CYCLE[this.idx % PALETTE_CYCLE.length];
    this.idx++;
  }

  /** Cover the screen. Resolves when fully covered. */
  cover(scale = 1): Promise<void> {
    this.nextStyle();
    this.removeAll(true);
    audio.sfx('whoosh');
    return new Promise((res) => {
      const { W, H } = this;
      const dur = 320 * scale;
      switch (this.kind) {
        case 'diag': {
          const g = this.scene.add.graphics();
          g.fillStyle(this.color, 1);
          g.fillPoints([new Phaser.Geom.Point(0, 0), new Phaser.Geom.Point(W + 300, 0), new Phaser.Geom.Point(W, H), new Phaser.Geom.Point(-300, H)], true);
          g.lineStyle(10, C.charcoal, 1);
          g.lineBetween(W + 300, 0, W, H);
          g.x = -(W + 600);
          this.add(g);
          this.scene.tweens.add({ targets: g, x: 0, duration: dur, ease: 'Quad.easeIn', onComplete: () => res() });
          break;
        }
        case 'iris': {
          const rect = this.scene.add.graphics();
          rect.fillStyle(this.color, 1);
          rect.fillRect(0, 0, W, H);
          const maskG = this.scene.make.graphics({});
          maskG.fillStyle(0xffffff, 1);
          maskG.fillCircle(W / 2, H / 2, 900);
          const mask = maskG.createGeometryMask();
          mask.invertAlpha = true;
          rect.setMask(mask);
          this.add(rect);
          (rect as unknown as { __mask: Phaser.GameObjects.Graphics }).__mask = maskG;
          this.scene.tweens.add({
            targets: maskG,
            scale: 0,
            duration: dur,
            ease: 'Quad.easeIn',
            onUpdate: () => {
              maskG.setPosition((W / 2) * (1 - maskG.scale), (H / 2) * (1 - maskG.scale));
            },
            onComplete: () => {
              rect.clearMask(true);
              rect.clear();
              rect.fillStyle(this.color, 1);
              rect.fillRect(0, 0, W, H);
              res();
            },
          });
          break;
        }
        case 'slats': {
          const n = 5;
          const sw = W / n;
          let doneCount = 0;
          for (let i = 0; i < n; i++) {
            const g = this.scene.add.graphics();
            g.fillStyle(i % 2 ? this.color : C.charcoal, 1);
            g.fillRect(0, 0, sw + 2, H);
            g.setPosition(i * sw, -H);
            this.add(g);
            this.scene.tweens.add({
              targets: g,
              y: 0,
              duration: dur * 0.8,
              delay: i * dur * 0.08,
              ease: 'Quad.easeIn',
              onComplete: () => ++doneCount === n && res(),
            });
          }
          break;
        }
        case 'drop': {
          const g = this.scene.add.graphics();
          g.fillStyle(this.color, 1);
          g.fillRect(0, 0, W, H + 100);
          // scalloped bottom edge
          g.fillStyle(this.color, 1);
          for (let x = 0; x <= W; x += 80) g.fillCircle(x, H + 100, 50);
          g.y = -(H + 160);
          this.add(g);
          this.scene.tweens.add({ targets: g, y: -100, duration: dur, ease: 'Bounce.easeOut', onComplete: () => res() });
          break;
        }
      }
    });
  }

  /** Reveal the screen. Resolves when fully clear. */
  uncover(scale = 1): Promise<void> {
    return new Promise((res) => {
      const { W, H } = this;
      const dur = 300 * scale;
      const finish = () => {
        this.removeAll(true);
        res();
      };
      switch (this.kind) {
        case 'diag': {
          const g = this.list[0] as Phaser.GameObjects.Graphics | undefined;
          if (!g) return finish();
          this.scene.tweens.add({ targets: g, x: W + 600, duration: dur, ease: 'Quad.easeIn', onComplete: finish });
          break;
        }
        case 'iris': {
          const rect = this.list[0] as Phaser.GameObjects.Graphics | undefined;
          if (!rect) return finish();
          const maskG = this.scene.make.graphics({});
          maskG.fillStyle(0xffffff, 1);
          maskG.fillCircle(W / 2, H / 2, 900);
          maskG.setScale(0);
          maskG.setPosition(W / 2, H / 2);
          const mask = maskG.createGeometryMask();
          mask.invertAlpha = true;
          rect.setMask(mask);
          this.scene.tweens.add({
            targets: maskG,
            scale: 1,
            duration: dur,
            ease: 'Quad.easeOut',
            onUpdate: () => maskG.setPosition((W / 2) * (1 - maskG.scale), (H / 2) * (1 - maskG.scale)),
            onComplete: () => {
              rect.clearMask(true);
              finish();
            },
          });
          break;
        }
        case 'slats': {
          const items = this.list.slice() as Phaser.GameObjects.Graphics[];
          if (items.length === 0) return finish();
          let doneCount = 0;
          items.forEach((g, i) =>
            this.scene.tweens.add({
              targets: g,
              y: H,
              duration: dur * 0.8,
              delay: (items.length - 1 - i) * dur * 0.08,
              ease: 'Quad.easeIn',
              onComplete: () => ++doneCount === items.length && finish(),
            }),
          );
          break;
        }
        case 'drop': {
          const g = this.list[0] as Phaser.GameObjects.Graphics | undefined;
          if (!g) return finish();
          this.scene.tweens.add({ targets: g, y: -(H + 300), duration: dur, ease: 'Quad.easeIn', onComplete: finish });
          break;
        }
      }
    });
  }

  /** Instantly cover with a solid color (used when entering the scene). */
  coverInstant(color = C.tomato) {
    this.removeAll(true);
    this.kind = 'diag';
    this.color = color;
    const g = this.scene.add.graphics();
    g.fillStyle(color, 1);
    g.fillPoints([new Phaser.Geom.Point(0, 0), new Phaser.Geom.Point(this.W + 300, 0), new Phaser.Geom.Point(this.W, this.H), new Phaser.Geom.Point(-300, this.H)], true);
    this.add(g);
  }
}
