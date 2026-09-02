/*
 * Blunderton audio: everything is synthesized with the Web Audio API.
 * No files, no network. One AudioContext, created after the first user gesture.
 */
import { save } from './Save';

type Wave = OscillatorType;

interface ToneOpts {
  freq: number;
  end?: number; // glide target frequency
  dur: number; // seconds
  type?: Wave;
  vol?: number;
  attack?: number;
  delay?: number;
  filter?: number; // lowpass cutoff
  q?: number;
  curve?: 'lin' | 'exp';
  vibrato?: number; // Hz
  vibratoDepth?: number;
  bus?: 'sfx' | 'music';
}

interface NoiseOpts {
  dur: number;
  vol?: number;
  delay?: number;
  filter?: number;
  filterEnd?: number;
  type?: BiquadFilterType;
  q?: number;
  bus?: 'sfx' | 'music';
}

export type MusicTrack = 'menu' | 'game' | null;

const NOTE = (semi: number, base = 261.63) => base * Math.pow(2, semi / 12);

// Game track: a bouncy 4-bar polka in C (16th-note steps, -1 = rest). Semitones from C4.
const GAME_LEAD = [
  0, -1, 4, -1, 7, -1, 4, -1, 9, -1, 7, -1, 4, -1, 2, -1,
  0, -1, 4, -1, 7, -1, 12, -1, 11, -1, 9, -1, 7, -1, 5, -1,
  4, -1, 5, -1, 7, -1, 5, -1, 4, -1, 2, -1, 0, -1, -1, -1,
  7, -1, 9, -1, 11, -1, 12, -1, -1, -1, 7, -1, 9, 11, 12, -1,
];
const GAME_ROOTS = [0, -3, -7, -5]; // C, A, F, G (relative to C3 in bass)
const MENU_LEAD = [
  4, -1, -1, -1, 7, -1, -1, -1, 11, -1, -1, -1, 9, -1, 7, -1,
  0, -1, -1, -1, 4, -1, -1, -1, 7, -1, -1, -1, -1, -1, -1, -1,
  5, -1, -1, -1, 9, -1, -1, -1, 12, -1, -1, -1, 11, -1, 9, -1,
  7, -1, -1, -1, 11, -1, -1, -1, 14, -1, -1, -1, -1, -1, -1, -1,
];
const MENU_ROOTS = [0, -3, -7, -5];

class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuffer: AudioBuffer | null = null;
  muted = !save.data.sound;

  // music state
  private track: MusicTrack = null;
  private step = 0;
  private nextStepTime = 0;
  private schedTimer: number | null = null;
  tempo = 1;
  intensity = 0; // 0..3 layers
  private lastVocal = 0;

  /** Must be called from a user gesture (pointerdown/keydown). Safe to call repeatedly. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    } catch {
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 6;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.34;
    this.musicBus.connect(this.master);

    const len = this.ctx.sampleRate * 1.5;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    if (this.track) this.startScheduler();

    // Keep the music from piling up while the tab is hidden (timers throttle in the background).
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  get ready() {
    return !!this.ctx;
  }

  setMuted(m: boolean) {
    this.muted = m;
    save.data.sound = !m;
    save.commit();
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.02);
  }

  toggle() {
    this.setMuted(!this.muted);
    return !this.muted;
  }

  // ---------------------------------------------------------------- primitives
  private tone(o: ToneOpts) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'square';
    osc.frequency.setValueAtTime(Math.max(20, o.freq), t0);
    if (o.end !== undefined) {
      if (o.curve === 'lin') osc.frequency.linearRampToValueAtTime(Math.max(20, o.end), t0 + o.dur);
      else osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.end), t0 + o.dur);
    }
    const g = ctx.createGain();
    const vol = o.vol ?? 0.2;
    const atk = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    let node: AudioNode = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.filter;
      f.Q.value = o.q ?? 1;
      node.connect(f);
      node = f;
    }
    if (o.vibrato) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = o.vibrato;
      const lg = ctx.createGain();
      lg.gain.value = o.vibratoDepth ?? 8;
      lfo.connect(lg);
      lg.connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + o.dur + 0.05);
    }
    node.connect(g);
    g.connect(o.bus === 'music' ? this.musicBus : this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.05);
  }

  private noise(o: NoiseOpts) {
    if (!this.ctx || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? 'lowpass';
    f.frequency.setValueAtTime(o.filter ?? 1200, t0);
    if (o.filterEnd) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.filterEnd), t0 + o.dur);
    f.Q.value = o.q ?? 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(o.vol ?? 0.2, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(f);
    f.connect(g);
    g.connect(o.bus === 'music' ? this.musicBus : this.sfxBus);
    src.start(t0);
    src.stop(t0 + o.dur + 0.05);
  }

  /** Cartoon vocalization: two detuned oscillators through a formant-ish bandpass. */
  private voice(f0: number, f1: number, dur: number, vol = 0.12, delay = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    g.gain.setValueAtTime(vol, t0 + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(f0 * 3, t0);
    bp.frequency.exponentialRampToValueAtTime(f1 * 2.5, t0 + dur);
    bp.Q.value = 1.5;
    for (const det of [0, 7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.detune.value = det;
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      o.connect(bp);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    }
    bp.connect(g);
    g.connect(this.sfxBus);
  }

  // ---------------------------------------------------------------- sfx library
  sfx(name: string, pitch = 1) {
    if (!this.ctx) return;
    const P = pitch;
    switch (name) {
      case 'ui':
        this.tone({ freq: 660 * P, end: 990 * P, dur: 0.09, type: 'sine', vol: 0.18 });
        this.tone({ freq: 1320 * P, dur: 0.06, type: 'triangle', vol: 0.08, delay: 0.05 });
        break;
      case 'tap':
        this.tone({ freq: 420 * P, end: 260 * P, dur: 0.07, type: 'square', vol: 0.12, filter: 2000 });
        this.noise({ dur: 0.03, vol: 0.06, filter: 3000, type: 'highpass' });
        break;
      case 'pop':
        this.tone({ freq: 900 * P, end: 180 * P, dur: 0.1, type: 'sine', vol: 0.25 });
        this.noise({ dur: 0.05, vol: 0.1, filter: 2500 });
        break;
      case 'plop':
        this.tone({ freq: 300 * P, end: 700 * P, dur: 0.1, type: 'sine', vol: 0.2 });
        break;
      case 'success':
        [0, 4, 7, 12].forEach((s, i) =>
          this.tone({ freq: NOTE(s, 523.25) * P, dur: 0.16, type: 'triangle', vol: 0.18, delay: i * 0.07 }),
        );
        this.tone({ freq: NOTE(12, 523.25) * P, dur: 0.35, type: 'sine', vol: 0.12, delay: 0.28 });
        break;
      case 'fail':
        this.tone({ freq: 320 * P, end: 140 * P, dur: 0.45, type: 'sawtooth', vol: 0.16, filter: 1200, vibrato: 9, vibratoDepth: 12 });
        this.tone({ freq: 160 * P, end: 70 * P, dur: 0.5, type: 'square', vol: 0.1, filter: 600, delay: 0.12 });
        break;
      case 'hit':
        this.noise({ dur: 0.18, vol: 0.35, filter: 900, filterEnd: 100 });
        this.tone({ freq: 140 * P, end: 40, dur: 0.25, type: 'square', vol: 0.3, filter: 500 });
        break;
      case 'thud':
        this.tone({ freq: 90 * P, end: 35, dur: 0.3, type: 'sine', vol: 0.4 });
        this.noise({ dur: 0.1, vol: 0.15, filter: 400 });
        break;
      case 'boing':
        this.tone({ freq: 180 * P, end: 720 * P, dur: 0.12, type: 'triangle', vol: 0.22 });
        this.tone({ freq: 720 * P, end: 240 * P, dur: 0.3, type: 'triangle', vol: 0.2, delay: 0.12, vibrato: 18, vibratoDepth: 30 });
        break;
      case 'whoosh':
        this.noise({ dur: 0.3, vol: 0.22, filter: 400, filterEnd: 3500, type: 'bandpass', q: 1.2 });
        break;
      case 'fall':
        this.tone({ freq: 1100 * P, end: 180 * P, dur: 1.0, type: 'sine', vol: 0.18, vibrato: 6, vibratoDepth: 20 });
        break;
      case 'rise':
        this.tone({ freq: 200 * P, end: 1400 * P, dur: 0.5, type: 'sine', vol: 0.16 });
        break;
      case 'countdown':
        this.tone({ freq: 1400 * P, dur: 0.05, type: 'square', vol: 0.1, filter: 3000 });
        break;
      case 'tick':
        this.tone({ freq: 2000 * P, dur: 0.03, type: 'square', vol: 0.06 });
        break;
      case 'streak':
        [0, 4, 7, 12, 16].forEach((s, i) =>
          this.tone({ freq: NOTE(s, 659.25), dur: 0.12, type: 'square', vol: 0.12, delay: i * 0.05, filter: 3500 }),
        );
        this.noise({ dur: 0.25, vol: 0.08, filter: 6000, type: 'highpass', delay: 0.2 });
        break;
      case 'highscore':
        [0, 4, 7, 12, 7, 12, 16, 19].forEach((s, i) =>
          this.tone({ freq: NOTE(s, 523.25), dur: 0.2, type: 'triangle', vol: 0.18, delay: i * 0.09 }),
        );
        this.tone({ freq: NOTE(19, 523.25), dur: 0.7, type: 'sine', vol: 0.14, delay: 0.75 });
        break;
      case 'unlock':
        [0, 7, 12, 19, 24].forEach((s, i) =>
          this.tone({ freq: NOTE(s, 783.99), dur: 0.3, type: 'sine', vol: 0.12, delay: i * 0.06 }),
        );
        break;
      case 'gameover':
        [7, 5, 3, 0].forEach((s, i) =>
          this.tone({ freq: NOTE(s, 261.63), dur: 0.42, type: 'triangle', vol: 0.2, delay: i * 0.28 }),
        );
        this.tone({ freq: NOTE(-12, 261.63), dur: 1.2, type: 'sawtooth', vol: 0.1, filter: 500, delay: 1.1 });
        break;
      case 'squish':
        this.tone({ freq: 380 * P, end: 60, dur: 0.22, type: 'sawtooth', vol: 0.18, filter: 900 });
        this.noise({ dur: 0.12, vol: 0.12, filter: 700 });
        break;
      case 'explode':
        this.noise({ dur: 0.5, vol: 0.4, filter: 1800, filterEnd: 80 });
        this.tone({ freq: 110, end: 25, dur: 0.5, type: 'sawtooth', vol: 0.25, filter: 400 });
        break;
      case 'spin':
        for (let i = 0; i < 6; i++) this.tone({ freq: (300 + i * 90) * P, dur: 0.07, type: 'square', vol: 0.1, delay: i * 0.06, filter: 2500 });
        break;
      case 'ding':
        this.tone({ freq: 1568 * P, dur: 0.4, type: 'sine', vol: 0.2 });
        this.tone({ freq: 3136 * P, dur: 0.2, type: 'sine', vol: 0.06 });
        break;
      case 'wrong':
        this.tone({ freq: 180 * P, dur: 0.16, type: 'square', vol: 0.16, filter: 900 });
        this.tone({ freq: 150 * P, dur: 0.28, type: 'square', vol: 0.16, filter: 900, delay: 0.16 });
        break;
      case 'correct':
        this.tone({ freq: 880 * P, dur: 0.08, type: 'square', vol: 0.12, filter: 3000 });
        this.tone({ freq: 1320 * P, dur: 0.14, type: 'square', vol: 0.12, filter: 3000, delay: 0.08 });
        break;
      case 'splash':
        this.noise({ dur: 0.45, vol: 0.3, filter: 900, filterEnd: 2500, type: 'bandpass', q: 0.7 });
        this.tone({ freq: 500, end: 120, dur: 0.25, type: 'sine', vol: 0.15 });
        break;
      case 'fire':
        this.noise({ dur: 0.6, vol: 0.3, filter: 700, filterEnd: 2200 });
        this.tone({ freq: 90, end: 220, dur: 0.5, type: 'sawtooth', vol: 0.12, filter: 500 });
        break;
      case 'alarm':
        for (let i = 0; i < 3; i++) {
          this.tone({ freq: 820, dur: 0.1, type: 'square', vol: 0.1, delay: i * 0.22, filter: 2500 });
          this.tone({ freq: 620, dur: 0.1, type: 'square', vol: 0.1, delay: i * 0.22 + 0.11, filter: 2500 });
        }
        break;
      case 'zap':
        this.tone({ freq: 2200 * P, end: 90, dur: 0.16, type: 'sawtooth', vol: 0.18, filter: 4000 });
        break;
      case 'buzz':
        this.tone({ freq: 95 * P, dur: 0.35, type: 'square', vol: 0.14, filter: 700, vibrato: 30, vibratoDepth: 12 });
        break;
      case 'snip':
        this.noise({ dur: 0.05, vol: 0.2, filter: 5000, type: 'highpass' });
        this.tone({ freq: 2400 * P, end: 1800 * P, dur: 0.05, type: 'square', vol: 0.08 });
        break;
      case 'chomp':
        this.tone({ freq: 240 * P, end: 90, dur: 0.14, type: 'square', vol: 0.18, filter: 900 });
        this.noise({ dur: 0.08, vol: 0.12, filter: 1500 });
        break;
      case 'burp':
        this.tone({ freq: 160 * P, end: 80, dur: 0.4, type: 'sawtooth', vol: 0.16, filter: 700, vibrato: 25, vibratoDepth: 20 });
        break;
      case 'rocket':
        this.noise({ dur: 0.5, vol: 0.18, filter: 600, filterEnd: 1500 });
        this.tone({ freq: 70, end: 140, dur: 0.5, type: 'sawtooth', vol: 0.08, filter: 400 });
        break;
      case 'wind':
        this.noise({ dur: 0.8, vol: 0.12, filter: 300, filterEnd: 900, type: 'bandpass', q: 0.6 });
        break;
      case 'crunch':
        this.noise({ dur: 0.2, vol: 0.3, filter: 2500, filterEnd: 300 });
        this.tone({ freq: 200, end: 60, dur: 0.2, type: 'square', vol: 0.15, filter: 800 });
        break;
      case 'piano':
        [0, 1, 6, 8, 13].forEach((s) =>
          this.tone({ freq: NOTE(s, 220), dur: 0.9, type: 'triangle', vol: 0.12 }),
        );
        this.noise({ dur: 0.2, vol: 0.25, filter: 800, filterEnd: 100 });
        break;
      case 'bell':
        this.tone({ freq: 1046 * P, dur: 0.6, type: 'sine', vol: 0.15 });
        this.tone({ freq: 1046 * 2.4 * P, dur: 0.3, type: 'sine', vol: 0.05 });
        break;
      case 'ping':
        this.tone({ freq: 1200 * P, end: 1800 * P, dur: 0.12, type: 'sine', vol: 0.12 });
        break;
      case 'screech':
        this.tone({ freq: 1800 * P, end: 900 * P, dur: 0.35, type: 'sawtooth', vol: 0.1, filter: 3000, vibrato: 40, vibratoDepth: 60 });
        break;
      case 'slam':
        this.noise({ dur: 0.25, vol: 0.4, filter: 500, filterEnd: 60 });
        this.tone({ freq: 60, end: 30, dur: 0.4, type: 'sine', vol: 0.4 });
        break;
      case 'shatter':
        for (let i = 0; i < 6; i++) this.tone({ freq: (2000 + Math.random() * 3000), dur: 0.15, type: 'triangle', vol: 0.06, delay: i * 0.03 });
        this.noise({ dur: 0.3, vol: 0.2, filter: 6000, type: 'highpass' });
        break;
      case 'card':
        this.noise({ dur: 0.12, vol: 0.14, filter: 1500, filterEnd: 4000, type: 'bandpass' });
        this.tone({ freq: 520 * P, end: 780 * P, dur: 0.1, type: 'triangle', vol: 0.14 });
        break;
      case 'oh':
        this.voice(220 * P, 150 * P, 0.35, 0.1);
        break;
      case 'wa':
        this.voice(180 * P, 420 * P, 0.28, 0.1);
        break;
      case 'yay':
        this.voice(300 * P, 520 * P, 0.22, 0.1);
        this.voice(520 * P, 460 * P, 0.25, 0.08, 0.2);
        break;
      case 'hm':
        this.voice(200 * P, 230 * P, 0.25, 0.07);
        break;
      case 'aah':
        this.voice(380 * P, 640 * P, 0.5, 0.11);
        break;
      default:
        break;
    }
  }

  /** Throttled random vocalization for characters. */
  vocal(kind: 'happy' | 'scared' | 'hurt' | 'think' = 'happy', pitch = 1) {
    const now = performance.now();
    if (now - this.lastVocal < 120) return;
    this.lastVocal = now;
    const map = { happy: 'yay', scared: 'aah', hurt: 'oh', think: 'hm' } as const;
    this.sfx(map[kind], pitch);
  }

  // ---------------------------------------------------------------- music
  music(track: MusicTrack) {
    if (this.track === track) return;
    this.track = track;
    this.step = 0;
    if (!this.ctx) return;
    if (!track) {
      this.stopScheduler();
      return;
    }
    this.startScheduler();
  }

  setTempo(t: number) {
    this.tempo = Math.max(0.6, Math.min(1.4, t));
  }

  setIntensity(i: number) {
    this.intensity = Math.max(0, Math.min(3, Math.floor(i)));
  }

  private startScheduler() {
    this.stopScheduler();
    if (!this.ctx) return;
    this.nextStepTime = this.ctx.currentTime + 0.05;
    this.step = 0;
    this.schedTimer = window.setInterval(() => this.schedule(), 30);
  }

  private stopScheduler() {
    if (this.schedTimer !== null) {
      clearInterval(this.schedTimer);
      this.schedTimer = null;
    }
  }

  private schedule() {
    if (!this.ctx || !this.track) return;
    const bpm = (this.track === 'menu' ? 92 : 128) * (this.track === 'menu' ? 1 : this.tempo);
    const stepDur = 60 / bpm / 4;
    while (this.nextStepTime < this.ctx.currentTime + 0.15) {
      const delay = Math.max(0, this.nextStepTime - this.ctx.currentTime);
      if (this.track === 'game') this.gameStep(this.step, delay, stepDur);
      else this.menuStep(this.step, delay, stepDur);
      this.nextStepTime += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  private gameStep(step: number, delay: number, sd: number) {
    const bar = Math.floor(step / 16);
    const inBar = step % 16;
    const root = GAME_ROOTS[bar % 4];
    const chord = bar % 4 === 1 ? [0, 3, 7] : [0, 4, 7];
    // lead
    const l = GAME_LEAD[step];
    if (l >= 0) this.tone({ freq: NOTE(l, 523.25), dur: sd * 1.7, type: 'square', vol: 0.09, filter: 2600, delay, bus: 'music' });
    // oompah bass
    if (inBar % 4 === 0) {
      const semi = inBar % 8 === 0 ? root : root + 7;
      this.tone({ freq: NOTE(semi, 130.81), dur: sd * 3, type: 'triangle', vol: 0.22, delay, bus: 'music', attack: 0.01 });
    }
    // kick
    if (inBar === 0 || inBar === 8 || (this.intensity >= 2 && (inBar === 4 || inBar === 12))) {
      this.tone({ freq: 120, end: 40, dur: 0.12, type: 'sine', vol: 0.3, delay, bus: 'music' });
    }
    // hats
    if (this.intensity >= 1 && inBar % 2 === 0) {
      this.noise({ dur: 0.04, vol: inBar % 4 === 2 ? 0.09 : 0.05, filter: 7000, type: 'highpass', delay, bus: 'music' });
    }
    if (this.intensity >= 3 && inBar % 2 === 1) {
      this.noise({ dur: 0.03, vol: 0.04, filter: 9000, type: 'highpass', delay, bus: 'music' });
    }
    // offbeat stabs
    if (this.intensity >= 2 && (inBar === 2 || inBar === 6 || inBar === 10 || inBar === 14)) {
      for (const c of chord) this.tone({ freq: NOTE(root + c, 261.63), dur: sd * 1.2, type: 'square', vol: 0.035, filter: 1800, delay, bus: 'music' });
    }
    // fast arps at chaos
    if (this.intensity >= 3) {
      const c = chord[inBar % 3];
      this.tone({ freq: NOTE(root + c + 24, 261.63), dur: sd * 0.9, type: 'triangle', vol: 0.05, delay, bus: 'music' });
    }
  }

  private menuStep(step: number, delay: number, sd: number) {
    const bar = Math.floor(step / 16);
    const inBar = step % 16;
    const root = MENU_ROOTS[bar % 4];
    const l = MENU_LEAD[step];
    if (l >= 0) this.tone({ freq: NOTE(l, 523.25), dur: sd * 3.5, type: 'triangle', vol: 0.09, delay, bus: 'music', attack: 0.02, vibrato: 5, vibratoDepth: 3 });
    if (inBar === 0 || inBar === 10) {
      this.tone({ freq: NOTE(root, 130.81), dur: sd * 6, type: 'triangle', vol: 0.18, delay, bus: 'music', attack: 0.02 });
    }
    if (inBar === 4 || inBar === 12) {
      for (const c of [0, 4, 7]) this.tone({ freq: NOTE(root + c, 261.63), dur: sd * 3, type: 'sine', vol: 0.05, delay, bus: 'music', attack: 0.03 });
    }
    if (inBar % 8 === 4) this.noise({ dur: 0.05, vol: 0.04, filter: 6000, type: 'highpass', delay, bus: 'music' });
  }
}

export const audio = new AudioManager();
