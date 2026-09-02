import Phaser from 'phaser';
import { Microgame, W, type MicrogameMeta } from '../Microgame';
import { C, darken } from '../../core/Palette';
import { drawRoom, puff, confetti } from '../../entities/Props';
import { audio } from '../../core/Audio';
import type { Critter } from '../../entities/Critter';

export const VendingMeta: MicrogameMeta = {
  id: 'vending',
  name: 'Vending Machine',
  instruction: 'SHAKE!',
  mechanic: 'Rapid tap',
  group: 'tap',
  baseDuration: 6000,
  timeoutWins: false,
  character: 'nubbin',
  accident: { name: 'Vended', desc: 'Crushed by 400 kg of snacks.' },
};

const FLOOR = 600;
const MX = 800; // machine center x
const MW = 210;
const MH = 400;

export class VendingMachine extends Microgame {
  meta = VendingMeta;
  private machine!: Phaser.GameObjects.Container;
  private snack!: Phaser.GameObjects.Graphics;
  private nubbin!: Critter;
  private meterG!: Phaser.GameObjects.Graphics;
  private progress = 0;
  private perTap = 0.1;
  private decay = 0.05;
  private hint!: Phaser.GameObjects.Text;

  build() {
    const g = this.gfx();
    drawRoom(g, 0xe9dcc9, 0x9fb5c4, FLOOR);
    // machine (pivot at bottom-left corner so it can topple)
    this.machine = this.scene.add.container(MX - MW / 2, FLOOR);
    const m = this.scene.add.graphics();
    m.fillStyle(C.charcoal, 1);
    m.fillRoundedRect(6, -MH + 8, MW, MH, 14);
    m.fillStyle(C.tomato, 1);
    m.lineStyle(5, C.charcoal, 1);
    m.fillRoundedRect(0, -MH, MW, MH, 14);
    m.strokeRoundedRect(0, -MH, MW, MH, 14);
    // glass
    m.fillStyle(C.skyLight, 1);
    m.fillRoundedRect(18, -MH + 20, MW - 80, MH - 130, 8);
    m.strokeRoundedRect(18, -MH + 20, MW - 80, MH - 130, 8);
    // shelves with snacks
    const cols = [C.mustard, C.mint, C.pink, C.sky, C.violet, C.orange];
    for (let r = 0; r < 4; r++) {
      const sy = -MH + 60 + r * 62;
      m.fillStyle(C.charcoal, 1);
      m.fillRect(18, sy + 26, MW - 80, 4);
      for (let c = 0; c < 3; c++) {
        if (r === 0 && c === 1) continue; // the stuck one is drawn separately
        m.fillStyle(cols[(r * 3 + c) % cols.length], 1);
        m.lineStyle(3, C.charcoal, 1);
        m.fillRoundedRect(26 + c * 40, sy - 4, 30, 30, 5);
        m.strokeRoundedRect(26 + c * 40, sy - 4, 30, 30, 5);
      }
    }
    // side panel with buttons and coin slot
    m.fillStyle(C.charcoal, 1);
    m.fillRoundedRect(MW - 54, -MH + 24, 38, 90, 6);
    for (let i = 0; i < 4; i++) {
      m.fillStyle([C.mint, C.mustard, C.sky, C.pink][i], 1);
      m.fillCircle(MW - 35, -MH + 40 + i * 20, 6);
    }
    m.fillStyle(C.grey, 1);
    m.fillRect(MW - 46, -MH + 130, 22, 6);
    // tray
    m.fillStyle(C.charcoal, 1);
    m.fillRoundedRect(18, -70, MW - 80, 44, 6);
    m.fillStyle(darken(C.tomato, 0.7), 1);
    m.fillRoundedRect(24, -64, MW - 92, 30, 4);
    // face-ish logo
    m.fillStyle(C.white, 1);
    m.fillRoundedRect(30, -MH + 4, 90, 14, 4);
    this.machine.add(m);
    // stuck snack: tilted bag
    this.snack = this.scene.add.graphics();
    this.snack.fillStyle(C.mustard, 1);
    this.snack.lineStyle(3, C.charcoal, 1);
    this.snack.fillRoundedRect(-16, -18, 32, 36, 6);
    this.snack.strokeRoundedRect(-16, -18, 32, 36, 6);
    this.snack.fillStyle(C.tomato, 1);
    this.snack.fillCircle(0, 0, 8);
    this.snack.setPosition(84, -MH + 70);
    this.snack.setAngle(-28);
    this.machine.add(this.snack);
    this.root.add(this.machine);

    // meter (SNACK-O-METER)
    this.meterG = this.gfx();
    this.text(1080, 150, 'SNACK-O-METER', { size: 16, color: C.charcoal, strokeWidth: 0, shadow: false }).setAlpha(0.7);

    // Nubbin, pushing
    this.nubbin = this.critter('nubbin', 560, FLOOR - 62, 1);
    this.nubbin.look(1, -0.4);
    this.nubbin.setMood('focus');

    this.hint = this.text(560, 460, 'TAP TAP TAP', { size: 24, color: C.charcoal, strokeWidth: 0, shadow: false }).setAlpha(0.35);
    this.tween({ targets: this.hint, scale: 1.12, duration: 220, yoyo: true, repeat: -1 });

    const taps = Math.round(this.lerpD(9, 18));
    this.perTap = 1 / taps;
    this.decay = this.lerpD(0.03, 0.16);
    this.drawMeter();
  }

  begin() {
    super.begin();
    this.input.onAction(() => this.tap());
  }

  private tap() {
    if (this.done) return;
    this.progress = Math.min(1, this.progress + this.perTap);
    audio.sfx('tap', 0.9 + this.progress * 0.5);
    // jolt machine, squash Nubbin
    const amp = 2 + this.progress * 7;
    this.scene.tweens.killTweensOf(this.machine);
    this.machine.setAngle(0);
    this.tween({ targets: this.machine, angle: -amp, duration: 50, yoyo: true, ease: 'Quad.easeOut' });
    this.nubbin.squash(1.18, 0.86, 70);
    this.snack.setAngle(-28 + (Math.random() - 0.5) * 20);
    this.hint.setAlpha(0);
    if (this.progress >= 1) this.win();
  }

  update(_t: number, dt: number) {
    if (!this.started || this.done) return;
    this.progress = Math.max(0, this.progress - this.decay * (dt / 1000));
    this.drawMeter();
    // machine sweat: the higher the progress the more it wobbles
    if (this.remainingFracLow()) this.nubbin.setMood('scared');
  }

  private remainingFracLow() {
    return this.scene.remainingFrac() < 0.3;
  }

  private drawMeter() {
    const g = this.meterG;
    g.clear();
    const x = 1060;
    const y = 180;
    const w = 40;
    const h = 380;
    g.fillStyle(C.charcoal, 1);
    g.fillRoundedRect(x - 4, y - 4 + 5, w + 8, h + 8, 12);
    g.fillStyle(C.paper, 1);
    g.lineStyle(4, C.charcoal, 1);
    g.fillRoundedRect(x, y, w, h, 10);
    g.strokeRoundedRect(x, y, w, h, 10);
    const fh = (h - 8) * this.progress;
    g.fillStyle(this.progress > 0.75 ? C.mint : this.progress > 0.4 ? C.mustard : C.tomato, 1);
    if (fh > 2) g.fillRoundedRect(x + 4, y + h - 4 - fh, w - 8, fh, 6);
    // ticks
    g.lineStyle(2, C.charcoal, 0.4);
    for (let i = 1; i < 5; i++) g.lineBetween(x, y + (h * i) / 5, x + w, y + (h * i) / 5);
  }

  onWin(): number {
    audio.sfx('plop');
    this.scene.tweens.killTweensOf(this.machine);
    this.machine.setAngle(0);
    // snack drops down the machine into the tray, then Nubbin grabs it
    this.tween({ targets: this.snack, y: -60, angle: 0, duration: 260, ease: 'Bounce.easeOut' });
    this.after(300, () => {
      audio.sfx('boing');
      this.tween({ targets: this.snack, x: -230, y: -110, angle: 360, duration: 300, ease: 'Quad.easeOut' });
    });
    this.after(600, () => {
      audio.sfx('chomp');
      audio.vocal('happy', 0.9);
      this.snack.setVisible(false);
      this.nubbin.celebrate();
      this.caption('SNACK!', C.mustard);
      confetti(this.scene, this.root, this.nubbin.x, this.nubbin.y - 60, [C.mustard, C.tomato, C.mint], 12, 200);
    });
    return 1100;
  }

  onLose(): number {
    this.nubbin.stopIdle();
    this.nubbin.setMood('scared');
    this.nubbin.look(1, -1);
    audio.sfx('rise', 0.5);
    // machine leans, hesitates, then topples onto Nubbin
    this.tween({ targets: this.machine, angle: -14, duration: 350, ease: 'Sine.easeInOut' });
    this.after(450, () => {
      this.tween({
        targets: this.machine,
        angle: -90,
        duration: 380,
        ease: 'Quad.easeIn',
        onComplete: () => {
          audio.sfx('slam');
          audio.sfx('squish', 0.8);
          this.scene.shakeCam(0.02, 300);
          this.nubbin.setVisible(false);
          puff(this.scene, this.root, 520, FLOOR - 10, 10, C.creamDark, 26);
          // feet sticking out
          const feet = this.gfx();
          feet.fillStyle(darken(C.mustard, 0.8), 1);
          feet.lineStyle(4, C.charcoal, 1);
          feet.fillEllipse(470, FLOOR - 8, 34, 18);
          feet.strokeEllipse(470, FLOOR - 8, 34, 18);
          feet.fillEllipse(505, FLOOR - 8, 34, 18);
          feet.strokeEllipse(505, FLOOR - 8, 34, 18);
          this.tween({ targets: feet, y: -6, duration: 120, yoyo: true, repeat: 3 });
          // ironic snack rolls out
          this.after(400, () => {
            const s = this.gfx();
            s.fillStyle(C.mustard, 1);
            s.lineStyle(3, C.charcoal, 1);
            s.fillRoundedRect(-16, -18, 32, 36, 6);
            s.strokeRoundedRect(-16, -18, 32, 36, 6);
            s.setPosition(MX + 60, FLOOR - 20);
            audio.sfx('plop', 0.8);
            this.tween({ targets: s, x: W + 60, angle: 720, duration: 900, ease: 'Quad.easeIn' });
          });
          this.after(300, () => this.caption('VENDED.', C.tomato));
        },
      });
    });
    return 1700;
  }
}
