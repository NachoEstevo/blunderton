import Phaser from 'phaser';
import { C, darken } from '../core/Palette';
import { label, FONT_TITLE } from './Text';
import { audio } from '../core/Audio';

export interface ButtonOpts {
  w?: number;
  h?: number;
  color?: number;
  textColor?: number;
  size?: number;
  family?: string;
  sound?: string;
}

/** Chunky sticker-style button with squash feedback. */
export class Button extends Phaser.GameObjects.Container {
  private bgG: Phaser.GameObjects.Graphics;
  private txt: Phaser.GameObjects.Text;
  private btnW: number;
  private btnH: number;
  private color: number;
  private enabledFlag = true;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, onClick: () => void, o: ButtonOpts = {}) {
    super(scene, x, y);
    this.btnW = o.w ?? 300;
    this.btnH = o.h ?? 78;
    this.color = o.color ?? C.tomato;
    this.bgG = scene.add.graphics();
    this.draw(false);
    this.txt = label(scene, 0, -2, text, {
      size: o.size ?? 34,
      color: o.textColor ?? C.white,
      family: o.family ?? FONT_TITLE,
      weight: 'normal',
    });
    this.add([this.bgG, this.txt]);
    // note: no setSize() here - Phaser offsets a Container's hit area by its display origin
    this.setInteractive(new Phaser.Geom.Rectangle(-this.btnW / 2, -this.btnH / 2, this.btnW, this.btnH), Phaser.Geom.Rectangle.Contains);
    (this.input as Phaser.Types.Input.InteractiveObject).cursor = 'pointer';
    this.on('pointerdown', () => {
      if (!this.enabledFlag) return;
      this.draw(true);
      scene.tweens.add({ targets: this, scaleX: 1.06, scaleY: 0.92, duration: 70, yoyo: true });
    });
    this.on('pointerup', () => {
      if (!this.enabledFlag) return;
      this.draw(false);
      audio.sfx(o.sound ?? 'ui');
      onClick();
    });
    this.on('pointerout', () => this.draw(false));
    this.on('pointerover', () => this.enabledFlag && scene.tweens.add({ targets: this, scale: 1.04, duration: 90 }));
    this.on('pointerout', () => scene.tweens.add({ targets: this, scale: 1, duration: 90 }));
    scene.add.existing(this);
  }

  private draw(pressed: boolean) {
    const g = this.bgG;
    const w = this.btnW;
    const h = this.btnH;
    g.clear();
    const off = pressed ? 2 : 7;
    g.fillStyle(C.charcoal, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + off, w, h, 20);
    g.fillStyle(pressed ? darken(this.color, 0.85) : this.color, 1);
    g.lineStyle(4, C.charcoal, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + (pressed ? 4 : 0), w, h, 20);
    g.strokeRoundedRect(-w / 2, -h / 2 + (pressed ? 4 : 0), w, h, 20);
    g.fillStyle(0xffffff, 0.22);
    g.fillRoundedRect(-w / 2 + 12, -h / 2 + 8 + (pressed ? 4 : 0), w - 24, 12, 6);
  }

  setLabel(t: string) {
    this.txt.setText(t);
    return this;
  }

  setEnabled(v: boolean) {
    this.enabledFlag = v;
    this.setAlpha(v ? 1 : 0.5);
    return this;
  }

  /** Little attention wiggle. */
  wiggle() {
    this.scene.tweens.add({ targets: this, angle: { from: -3, to: 3 }, duration: 80, yoyo: true, repeat: 3, onComplete: () => this.setAngle(0) });
  }
}
