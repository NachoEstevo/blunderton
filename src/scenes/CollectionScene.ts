import Phaser from 'phaser';
import { C, hex } from '../core/Palette';
import { label, title } from '../ui/Text';
import { Button } from '../ui/Button';
import { audio } from '../core/Audio';
import { save } from '../core/Save';
import { CHARACTERS, getCharacter, type CharacterDef } from '../entities/Characters';
import { Critter } from '../entities/Critter';
import { isCharacterUnlocked, UNLOCKABLES } from '../core/Unlocks';
import { MICROGAMES, META_BY_ID } from '../microgames/registry';
import { drawStar } from '../entities/Props';

export class CollectionScene extends Phaser.Scene {
  private detail?: Phaser.GameObjects.Container;
  private footer!: Phaser.GameObjects.Text;

  constructor() {
    super('Collection');
  }

  create() {
    this.cameras.main.setBackgroundColor(hex(C.cream));
    this.cameras.main.fadeIn(150, 251, 241, 220);
    // paper texture stripes
    const bg = this.add.graphics();
    bg.fillStyle(C.creamDark, 0.5);
    for (let y = 0; y < 720; y += 40) bg.fillRect(0, y, 1280, 2);

    title(this, 300, 46, 'COLLECTION', { size: 56, color: C.violet, strokeWidth: 8, origin: [0, 0.5] });
    const chars = CHARACTERS.filter((c) => isCharacterUnlocked(c.id)).length;
    label(this, 620, 40, `${chars}/${CHARACTERS.length} residents  •  ${save.data.accidents.length}/${MICROGAMES.length} accidents  •  ${UNLOCKABLES.filter((u) => u.kind !== 'character' && save.has(u.id)).length}/${UNLOCKABLES.filter((u) => u.kind !== 'character').length} extras`, {
      size: 15,
      color: C.charcoal,
      strokeWidth: 0,
      shadow: false,
      origin: [0, 0.5],
    }).setAlpha(0.7);
    new Button(this, 130, 46, '◀ BACK', () => this.back(), { w: 170, h: 54, color: C.violet, size: 22 });

    this.buildResidents();
    this.buildAccidents();
    this.buildExtras();
    this.footer = label(this, 640, 700, 'tap anything to learn more', { size: 14, color: C.charcoal, strokeWidth: 0, shadow: false }).setAlpha(0.6);

    this.input.keyboard?.on('keydown-ESC', () => this.back());
    this.events.once('shutdown', () => this.input.keyboard?.off('keydown-ESC'));
  }

  // ------------------------------------------------------------ residents
  private buildResidents() {
    label(this, 40, 92, 'RESIDENTS', { size: 18, color: C.charcoal, strokeWidth: 0, shadow: false, origin: [0, 0.5] }).setAlpha(0.7);
    CHARACTERS.forEach((def, i) => {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const x = 140 + col * 250;
      const y = 180 + row * 150;
      const cw = 236;
      const ch = 132;
      const unlocked = isCharacterUnlocked(def.id);
      const c = this.add.container(x, y);
      const g = this.add.graphics();
      g.fillStyle(C.charcoal, 1);
      g.fillRoundedRect(-cw / 2 + 5, -ch / 2 + 7, cw, ch, 18);
      g.fillStyle(unlocked ? C.paper : C.creamDark, 1);
      g.lineStyle(4, C.charcoal, 1);
      g.fillRoundedRect(-cw / 2, -ch / 2, cw, ch, 18);
      g.strokeRoundedRect(-cw / 2, -ch / 2, cw, ch, 18);
      c.add(g);
      const critter = new Critter(this, -72, -2, getCharacter(def.id), 0.42);
      if (unlocked) critter.startIdle();
      else this.silhouette(critter);
      c.add(critter);
      const tx = -22;
      const tw = 128;
      if (unlocked) {
        c.add(label(this, tx, -44, def.name, { size: 19, color: C.charcoal, strokeWidth: 0, shadow: false, origin: [0, 0.5], align: 'left' }));
        c.add(label(this, tx, -26, def.trait, { size: 11, color: C.charcoal, strokeWidth: 0, shadow: false, origin: [0, 0], wrap: tw, align: 'left' }).setAlpha(0.7));
      } else {
        c.add(label(this, tx, -44, '???', { size: 19, color: C.charcoal, strokeWidth: 0, shadow: false, origin: [0, 0.5], align: 'left' }).setAlpha(0.6));
        c.add(label(this, tx, -26, def.unlockHint, { size: 11, color: C.charcoal, strokeWidth: 0, shadow: false, origin: [0, 0], wrap: tw, align: 'left' }).setAlpha(0.6));
      }
      const games = def.games.map((id) => META_BY_ID[id]?.name ?? id).join('  •  ');
      c.add(label(this, tx, 24, games, { size: 10, color: C.violet, strokeWidth: 0, shadow: false, origin: [0, 0], wrap: tw, align: 'left' }).setAlpha(unlocked ? 0.9 : 0.4));
      c.setInteractive(new Phaser.Geom.Rectangle(-cw / 2, -ch / 2, cw, ch), Phaser.Geom.Rectangle.Contains);
      c.on('pointerdown', () => {
        audio.sfx('ui');
        this.tweens.add({ targets: c, scale: 0.96, duration: 60, yoyo: true });
        this.showCharacter(def, unlocked);
      });
    });
  }

  private silhouette(cr: Critter) {
    cr.setBodyColor(0x6b6460);
    cr.faceG.setVisible(false);
    cr.eyeL.setVisible(false);
    cr.eyeR.setVisible(false);
    cr.hairG.setAlpha(0.4);
    const q = label(this, 0, -8, '?', { size: 40, color: C.paper, strokeWidth: 0, shadow: false });
    cr.inner.add(q);
  }

  // ------------------------------------------------------------ accidents
  private buildAccidents() {
    label(this, 40, 468, 'ACCIDENT REPORT', { size: 18, color: C.charcoal, strokeWidth: 0, shadow: false, origin: [0, 0.5] }).setAlpha(0.7);
    MICROGAMES.forEach((reg, i) => {
      const seen = save.data.accidents.includes(reg.meta.id);
      const x = 78 + i * 80;
      const y = 525;
      const c = this.add.container(x, y);
      const g = this.add.graphics();
      g.fillStyle(C.charcoal, 1);
      g.fillRoundedRect(-32 + 3, -32 + 5, 64, 64, 14);
      g.fillStyle(seen ? [C.tomato, C.mustard, C.sky, C.mint, C.pink][i % 5] : C.creamDark, 1);
      g.lineStyle(4, C.charcoal, 1);
      g.fillRoundedRect(-32, -32, 64, 64, 14);
      g.strokeRoundedRect(-32, -32, 64, 64, 14);
      if (seen) {
        // splat face
        g.fillStyle(C.paper, 1);
        g.fillCircle(-10, -6, 8);
        g.fillCircle(10, -6, 8);
        g.lineStyle(3, C.charcoal, 1);
        g.lineBetween(-14, -10, -6, -2);
        g.lineBetween(-6, -10, -14, -2);
        g.lineBetween(6, -10, 14, -2);
        g.lineBetween(14, -10, 6, -2);
        g.beginPath();
        g.arc(0, 14, 8, Math.PI * 1.15, Math.PI * 1.85, false);
        g.strokePath();
      } else {
        c.add(label(this, 0, 0, '?', { size: 30, color: C.charcoal, strokeWidth: 0, shadow: false }).setAlpha(0.4));
      }
      c.add(g);
      c.sendToBack(g);
      c.setInteractive(new Phaser.Geom.Rectangle(-32, -32, 64, 64), Phaser.Geom.Rectangle.Contains);
      c.on('pointerdown', () => {
        audio.sfx('tap');
        this.tweens.add({ targets: c, scale: 0.9, duration: 60, yoyo: true });
        this.footer.setText(seen ? `${reg.meta.accident.name.toUpperCase()} — ${reg.meta.accident.desc}  (${reg.meta.name})` : `??? — fail "${reg.meta.name}" to file this report.`);
        this.footer.setAlpha(1);
      });
    });
  }

  // ------------------------------------------------------------ extras
  private buildExtras() {
    label(this, 40, 590, 'EXTRAS', { size: 18, color: C.charcoal, strokeWidth: 0, shadow: false, origin: [0, 0.5] }).setAlpha(0.7);
    const extras = UNLOCKABLES.filter((u) => u.kind !== 'character');
    extras.forEach((u, i) => {
      const has = save.has(u.id);
      const x = 90 + i * 118;
      const y = 645;
      const c = this.add.container(x, y);
      const g = this.add.graphics();
      g.fillStyle(C.charcoal, 1);
      g.fillRoundedRect(-52 + 3, -30 + 5, 104, 60, 14);
      g.fillStyle(has ? C.paper : C.creamDark, 1);
      g.lineStyle(4, C.charcoal, 1);
      g.fillRoundedRect(-52, -30, 104, 60, 14);
      g.strokeRoundedRect(-52, -30, 104, 60, 14);
      // icon by kind
      g.lineStyle(3, C.charcoal, 1);
      const col = has ? (u.kind === 'skin' ? C.pink : u.kind === 'background' ? C.sky : C.mustard) : C.greyDark;
      g.fillStyle(col, 1);
      if (u.kind === 'sticker') drawStar(g, -30, 0, 5, 14, 6);
      else if (u.kind === 'background') {
        g.fillCircle(-30, 0, 12);
        g.strokeCircle(-30, 0, 12);
      } else {
        g.fillEllipse(-30, 2, 20, 26);
        g.strokeEllipse(-30, 2, 20, 26);
      }
      c.add(g);
      c.add(label(this, -12, 0, has ? u.name : '???', { size: 12, color: C.charcoal, strokeWidth: 0, shadow: false, origin: [0, 0.5], wrap: 64 }).setAlpha(has ? 1 : 0.5));
      c.setInteractive(new Phaser.Geom.Rectangle(-52, -30, 104, 60), Phaser.Geom.Rectangle.Contains);
      c.on('pointerdown', () => {
        audio.sfx('tap');
        this.tweens.add({ targets: c, scale: 0.92, duration: 60, yoyo: true });
        this.footer.setText(`${u.name.toUpperCase()} — ${u.desc}${has ? '  ✓' : ''}`);
        this.footer.setAlpha(1);
      });
    });
  }

  // ------------------------------------------------------------ detail overlay
  private showCharacter(def: CharacterDef, unlocked: boolean) {
    this.detail?.destroy();
    const c = this.add.container(0, 0).setDepth(100);
    const dim = this.add.graphics();
    dim.fillStyle(C.charcoal, 0.55);
    dim.fillRect(0, 0, 1280, 720);
    dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, 1280, 720), Phaser.Geom.Rectangle.Contains);
    dim.on('pointerdown', () => {
      audio.sfx('tick');
      c.destroy();
      this.detail = undefined;
    });
    c.add(dim);
    const card = this.add.container(640, 360);
    const g = this.add.graphics();
    g.fillStyle(C.charcoal, 1);
    g.fillRoundedRect(-380 + 8, -220 + 10, 760, 440, 28);
    g.fillStyle(C.paper, 1);
    g.lineStyle(6, C.charcoal, 1);
    g.fillRoundedRect(-380, -220, 760, 440, 28);
    g.strokeRoundedRect(-380, -220, 760, 440, 28);
    g.fillStyle(unlocked ? def.color : C.creamDark, 1);
    g.fillRoundedRect(-380, -220, 300, 440, { tl: 28, bl: 28, tr: 0, br: 0 });
    g.lineBetween(-80, -220, -80, 220);
    card.add(g);
    const cr = new Critter(this, -230, 20, getCharacter(def.id), 1.3);
    if (unlocked) {
      cr.startIdle();
      cr.setMood('happy');
      this.time.delayedCall(600, () => cr.active && cr.celebrate());
    } else this.silhouette(cr);
    card.add(cr);
    card.add(title(this, 60, -170, unlocked ? def.name : '???', { size: 54, color: C.charcoal, strokeWidth: 0, shadow: false, origin: [0, 0.5] }));
    card.add(label(this, 60, -120, unlocked ? def.trait : 'Unknown resident', { size: 22, color: C.violet, strokeWidth: 0, shadow: false, origin: [0, 0.5] }));
    card.add(label(this, 60, -80, unlocked ? def.quote : `How to meet: ${def.unlockHint}`, { size: 19, color: C.charcoal, strokeWidth: 0, shadow: false, origin: [0, 0], wrap: 300, align: 'left' }).setAlpha(0.85));
    card.add(label(this, 60, 30, 'APPEARS IN', { size: 14, color: C.charcoal, strokeWidth: 0, shadow: false, origin: [0, 0.5] }).setAlpha(0.6));
    def.games.forEach((id, i) => {
      const m = META_BY_ID[id];
      if (!m) return;
      const cleared = save.data.stats.clearedById[id] ?? 0;
      const failed = save.data.stats.failedById[id] ?? 0;
      const ry = 58 + i * 50;
      card.add(label(this, 60, ry, `• ${m.name}`, { size: 18, color: C.charcoal, strokeWidth: 0, shadow: false, origin: [0, 0.5] }));
      card.add(label(this, 360, ry, `${cleared} cleared  •  ${failed} failed`, { size: 12, color: C.charcoal, strokeWidth: 0, shadow: false, origin: [1, 0.5] }).setAlpha(0.6));
      if (save.data.accidents.includes(id)) card.add(label(this, 76, ry + 20, `accident report: ${m.accident.name}`, { size: 12, color: C.tomato, strokeWidth: 0, shadow: false, origin: [0, 0.5] }));
    });
    card.add(label(this, 60, 190, 'tap anywhere to close', { size: 13, color: C.charcoal, strokeWidth: 0, shadow: false, origin: [0, 0.5] }).setAlpha(0.5));
    card.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' });
    c.add(card);
    this.detail = c;
  }

  private back() {
    audio.sfx('ui');
    this.cameras.main.fadeOut(120, 251, 241, 220);
    this.time.delayedCall(130, () => this.scene.start('Menu'));
  }
}
