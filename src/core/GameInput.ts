import Phaser from 'phaser';

export type Dir = 'left' | 'right' | 'up' | 'down';
export type KeyName = Dir | 'action' | '1' | '2' | '3' | '4';

/**
 * Small input facade for microgames. Every listener registered here is removed on destroy(),
 * so a microgame can never leak handlers into the next one.
 */
export class GameInput {
  private scene: Phaser.Scene;
  private handlers: Array<[string, (...a: any[]) => void]> = [];
  private keyHandler?: (e: KeyboardEvent) => void;
  private keyUpHandler?: (e: KeyboardEvent) => void;
  private keyDownCbs: Array<(k: KeyName, e: KeyboardEvent) => void> = [];
  private keyUpCbs: Array<(k: KeyName) => void> = [];
  private down = new Set<KeyName>();
  private swipeStart: { x: number; y: number; t: number } | null = null;
  private swipeCbs: Array<(dir: Dir) => void> = [];
  enabled = true;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const kb = scene.input.keyboard;
    if (kb) {
      this.keyHandler = (e: KeyboardEvent) => {
        if (!this.enabled) return;
        const k = mapKey(e);
        if (!k) return;
        if (['left', 'right', 'up', 'down', 'action'].includes(k)) e.preventDefault();
        const wasDown = this.down.has(k);
        this.down.add(k);
        if (!wasDown) this.keyDownCbs.forEach((cb) => cb(k, e));
      };
      this.keyUpHandler = (e: KeyboardEvent) => {
        const k = mapKey(e);
        if (!k) return;
        this.down.delete(k);
        this.keyUpCbs.forEach((cb) => cb(k));
      };
      kb.on('keydown', this.keyHandler);
      kb.on('keyup', this.keyUpHandler);
    }
  }

  get pointer(): Phaser.Input.Pointer {
    return this.scene.input.activePointer;
  }

  get pointerDown(): boolean {
    const p = this.scene.input.activePointer;
    return p.isDown;
  }

  isDown(k: KeyName): boolean {
    return this.down.has(k);
  }

  /** Any tap/click anywhere. */
  onDown(cb: (p: Phaser.Input.Pointer) => void) {
    const h = (p: Phaser.Input.Pointer) => this.enabled && cb(p);
    this.scene.input.on('pointerdown', h);
    this.handlers.push(['pointerdown', h]);
    return this;
  }

  onUp(cb: (p: Phaser.Input.Pointer) => void) {
    const h = (p: Phaser.Input.Pointer) => this.enabled && cb(p);
    this.scene.input.on('pointerup', h);
    this.handlers.push(['pointerup', h]);
    return this;
  }

  onMove(cb: (p: Phaser.Input.Pointer) => void) {
    const h = (p: Phaser.Input.Pointer) => this.enabled && cb(p);
    this.scene.input.on('pointermove', h);
    this.handlers.push(['pointermove', h]);
    return this;
  }

  /** Keyboard press (edge-triggered). Also fires 'action' for Space/Enter. */
  onKey(cb: (k: KeyName, e: KeyboardEvent) => void) {
    this.keyDownCbs.push(cb);
    return this;
  }

  onKeyUp(cb: (k: KeyName) => void) {
    this.keyUpCbs.push(cb);
    return this;
  }

  /** Tap anywhere or press Space/Enter: the universal "do it" action. */
  onAction(cb: () => void) {
    this.onDown(() => cb());
    this.onKey((k) => k === 'action' && cb());
    return this;
  }

  /** Tap on the left/right half of the screen, or press arrows/A/D. */
  onSide(cb: (side: 'left' | 'right') => void, width = 1280) {
    this.onDown((p) => cb(p.x < width / 2 ? 'left' : 'right'));
    this.onKey((k) => {
      if (k === 'left' || k === 'right') cb(k);
    });
    return this;
  }

  onSwipe(cb: (dir: Dir) => void) {
    if (this.swipeCbs.length === 0) {
      this.onDown((p) => {
        this.swipeStart = { x: p.x, y: p.y, t: performance.now() };
      });
      this.onUp((p) => {
        if (!this.swipeStart) return;
        const dx = p.x - this.swipeStart.x;
        const dy = p.y - this.swipeStart.y;
        const dt = performance.now() - this.swipeStart.t;
        this.swipeStart = null;
        if (dt > 600) return;
        if (Math.abs(dx) < 40 && Math.abs(dy) < 40) return;
        const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
        this.swipeCbs.forEach((c) => c(dir));
      });
    }
    this.swipeCbs.push(cb);
    return this;
  }

  /** Horizontal axis from held keys: -1, 0, 1 */
  axisX(): number {
    return (this.down.has('right') ? 1 : 0) - (this.down.has('left') ? 1 : 0);
  }

  axisY(): number {
    return (this.down.has('down') ? 1 : 0) - (this.down.has('up') ? 1 : 0);
  }

  /** Make a game object draggable; callbacks receive positions in the object's parent space. */
  draggable(
    obj: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform,
    cbs: {
      onStart?: (p: Phaser.Input.Pointer) => void;
      onDrag?: (x: number, y: number, p: Phaser.Input.Pointer) => void;
      onDrop?: (x: number, y: number, p: Phaser.Input.Pointer) => void;
    },
  ) {
    this.scene.input.setDraggable(obj);
    const start = (p: Phaser.Input.Pointer, go: Phaser.GameObjects.GameObject) => go === obj && this.enabled && cbs.onStart?.(p);
    const drag = (p: Phaser.Input.Pointer, go: Phaser.GameObjects.GameObject, dx: number, dy: number) =>
      go === obj && this.enabled && cbs.onDrag?.(dx, dy, p);
    const end = (p: Phaser.Input.Pointer, go: Phaser.GameObjects.GameObject) =>
      go === obj && this.enabled && cbs.onDrop?.(obj.x, obj.y, p);
    this.scene.input.on('dragstart', start);
    this.scene.input.on('drag', drag);
    this.scene.input.on('dragend', end);
    this.handlers.push(['dragstart', start], ['drag', drag], ['dragend', end]);
  }

  destroy() {
    for (const [ev, h] of this.handlers) this.scene.input.off(ev, h);
    this.handlers = [];
    const kb = this.scene.input.keyboard;
    if (kb) {
      if (this.keyHandler) kb.off('keydown', this.keyHandler);
      if (this.keyUpHandler) kb.off('keyup', this.keyUpHandler);
    }
    this.keyDownCbs = [];
    this.keyUpCbs = [];
    this.swipeCbs = [];
    this.down.clear();
  }
}

function mapKey(e: KeyboardEvent): KeyName | null {
  switch (e.code) {
    case 'ArrowLeft':
    case 'KeyA':
      return 'left';
    case 'ArrowRight':
    case 'KeyD':
      return 'right';
    case 'ArrowUp':
    case 'KeyW':
      return 'up';
    case 'ArrowDown':
    case 'KeyS':
      return 'down';
    case 'Space':
    case 'Enter':
      return 'action';
    case 'Digit1':
    case 'Numpad1':
      return '1';
    case 'Digit2':
    case 'Numpad2':
      return '2';
    case 'Digit3':
    case 'Numpad3':
      return '3';
    case 'Digit4':
    case 'Numpad4':
      return '4';
    default:
      return null;
  }
}
