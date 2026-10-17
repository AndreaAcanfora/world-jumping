/**
 * Keyboard + mouse, gamepad and touch, merged into one set of controls.
 * "Pressed" actions are latched until the next fixed step reads them, so a tap
 * shorter than a frame is never lost.
 */

export interface Controls {
  /** Movement relative to the camera: x = right, y = forward. */
  moveX: number;
  moveY: number;
  jumpPressed: boolean;
  jumpHeld: boolean;
  dashPressed: boolean;
  jetpackHeld: boolean;
  magicPressed: boolean;
  viewPressed: boolean;
}

type Latch = 'jump' | 'dash' | 'magic' | 'view' | 'pause';

const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  dash: ['ShiftLeft', 'ShiftRight', 'KeyT'],
  jetpack: ['KeyE', 'KeyP'],
  magic: ['KeyQ', 'KeyI'],
  view: ['KeyC', 'KeyV'],
  pause: ['Escape'],
} as const;

const MOUSE_SPEED = 0.0024;
const GAMEPAD_LOOK = 2.6;
const TOUCH_LOOK = 0.006;
const DEADZONE = 0.18;

export class Input {
  sensitivity = 1;
  invertY = false;
  enabled = false;
  readonly touch: boolean;
  onPause: () => void = () => {};

  private readonly down = new Set<string>();
  private readonly latched = new Set<Latch>();
  private lookX = 0;
  private lookY = 0;
  private stickX = 0;
  private stickY = 0;
  private touchJump = false;
  private touchJet = false;
  private padHeld = new Set<string>();
  private readonly cleanup: Array<() => void> = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    touchLayer: HTMLElement,
  ) {
    this.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.listen(window, 'keydown', (e: KeyboardEvent) => this.key(e, true));
    this.listen(window, 'keyup', (e: KeyboardEvent) => this.key(e, false));
    this.listen(window, 'blur', () => this.down.clear());
    this.listen(document, 'mousemove', (e: MouseEvent) => {
      if (document.pointerLockElement !== this.canvas || !this.enabled) return;
      this.lookX += e.movementX * MOUSE_SPEED * this.sensitivity;
      this.lookY += e.movementY * MOUSE_SPEED * this.sensitivity;
    });
    this.listen(canvas, 'click', () => {
      if (this.enabled && !this.touch && document.pointerLockElement !== canvas) requestLock(canvas);
    });
    this.listen(document, 'pointerlockchange', () => {
      if (document.pointerLockElement !== canvas && this.enabled && !this.touch) this.onPause();
    });
    if (this.touch) this.buildTouch(touchLayer);
  }

  private listen<T extends Event>(target: EventTarget, type: string, fn: (e: T) => void): void {
    const handler = fn as EventListener;
    target.addEventListener(type, handler, { passive: false });
    this.cleanup.push(() => target.removeEventListener(type, handler));
  }

  private key(e: KeyboardEvent, isDown: boolean): void {
    const code = e.code;
    if (isDown && !this.down.has(code)) {
      if ((KEYS.jump as readonly string[]).includes(code)) this.latched.add('jump');
      if ((KEYS.dash as readonly string[]).includes(code)) this.latched.add('dash');
      if ((KEYS.magic as readonly string[]).includes(code)) this.latched.add('magic');
      if ((KEYS.view as readonly string[]).includes(code)) this.latched.add('view');
    }
    if (isDown && code === 'Space' && this.enabled) e.preventDefault();
    if (isDown) this.down.add(code);
    else this.down.delete(code);
  }

  private held(keys: readonly string[]): boolean {
    return keys.some((k) => this.down.has(k));
  }

  /** Camera rotation since the last call, in radians. */
  takeLook(dt: number): { x: number; y: number } {
    const pad = this.gamepad();
    if (pad) {
      const rx = dz(pad.axes[2] ?? 0);
      const ry = dz(pad.axes[3] ?? 0);
      this.lookX += rx * GAMEPAD_LOOK * this.sensitivity * dt;
      this.lookY += ry * GAMEPAD_LOOK * this.sensitivity * dt;
    }
    const out = { x: this.lookX, y: this.invertY ? -this.lookY : this.lookY };
    this.lookX = 0;
    this.lookY = 0;
    return out;
  }

  /** Called once per fixed step. */
  sample(): Controls {
    let x = (this.held(KEYS.right) ? 1 : 0) - (this.held(KEYS.left) ? 1 : 0) + this.stickX;
    let y = (this.held(KEYS.forward) ? 1 : 0) - (this.held(KEYS.back) ? 1 : 0) + this.stickY;
    let jumpHeld = this.held(KEYS.jump) || this.touchJump;
    let jetpackHeld = this.held(KEYS.jetpack) || this.touchJet;

    const pad = this.gamepad();
    if (pad) {
      x += dz(pad.axes[0] ?? 0);
      y -= dz(pad.axes[1] ?? 0);
      const btn = (i: number) => Boolean(pad.buttons[i]?.pressed);
      this.padEdge('jump', btn(0));
      this.padEdge('dash', btn(2) || btn(5));
      this.padEdge('magic', btn(3));
      this.padEdge('view', btn(8));
      if (this.padEdge('pause', btn(9))) this.onPause();
      jumpHeld ||= btn(0);
      jetpackHeld ||= btn(1) || (pad.buttons[7]?.value ?? 0) > 0.3;
    }

    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    const c: Controls = {
      moveX: x,
      moveY: y,
      jumpPressed: this.latched.has('jump'),
      jumpHeld,
      dashPressed: this.latched.has('dash'),
      jetpackHeld,
      magicPressed: this.latched.has('magic'),
      viewPressed: this.latched.has('view'),
    };
    this.latched.clear();
    return c;
  }

  /** True once when a gamepad button goes down. */
  private padEdge(name: Latch, pressed: boolean): boolean {
    const was = this.padHeld.has(name);
    if (pressed) this.padHeld.add(name);
    else this.padHeld.delete(name);
    if (pressed && !was) {
      this.latched.add(name);
      return true;
    }
    return false;
  }

  private gamepad(): Gamepad | null {
    for (const p of navigator.getGamepads?.() ?? []) if (p && p.connected) return p;
    return null;
  }

  pausePressed(): boolean {
    return this.held(KEYS.pause);
  }

  releasePointer(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /* ---------------------------------------------------------------- touch */

  private buildTouch(layer: HTMLElement): void {
    layer.classList.add('touch-on');
    const stick = el('div', 'stick');
    const knob = el('div', 'stick-knob');
    stick.append(knob);
    layer.append(stick);

    const button = (cls: string, label: string, onDown: () => void, onUp: () => void = () => {}) => {
      const b = el('button', `touch-btn ${cls}`);
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        b.classList.add('down');
        onDown();
      });
      const up = () => {
        b.classList.remove('down');
        onUp();
      };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      layer.append(b);
      return b;
    };
    button(
      'jump',
      '⤒',
      () => {
        this.latched.add('jump');
        this.touchJump = true;
      },
      () => (this.touchJump = false),
    );
    button('dash', '»', () => this.latched.add('dash'));
    button(
      'jet',
      '▲',
      () => (this.touchJet = true),
      () => (this.touchJet = false),
    );
    button('magic', '◆', () => this.latched.add('magic'));
    button('pause', 'II', () => this.onPause());

    // Left half: a joystick that appears where the thumb lands. Right half: drag to look.
    let stickId: number | null = null;
    let lookId: number | null = null;
    let ox = 0;
    let oy = 0;
    let lx = 0;
    let ly = 0;
    const R = 50;
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.touch-btn')) return;
      if (e.clientX < innerWidth / 2 && stickId === null) {
        stickId = e.pointerId;
        ox = e.clientX;
        oy = e.clientY;
        stick.style.left = `${ox}px`;
        stick.style.top = `${oy}px`;
        stick.classList.add('on');
      } else if (lookId === null) {
        lookId = e.pointerId;
        lx = e.clientX;
        ly = e.clientY;
      }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId === stickId) {
        let dx = e.clientX - ox;
        let dy = e.clientY - oy;
        const d = Math.hypot(dx, dy);
        if (d > R) {
          dx = (dx / d) * R;
          dy = (dy / d) * R;
        }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        this.stickX = dx / R;
        this.stickY = -dy / R;
      } else if (e.pointerId === lookId) {
        this.lookX += (e.clientX - lx) * TOUCH_LOOK * this.sensitivity;
        this.lookY += (e.clientY - ly) * TOUCH_LOOK * this.sensitivity;
        lx = e.clientX;
        ly = e.clientY;
      }
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId === stickId) {
        stickId = null;
        this.stickX = 0;
        this.stickY = 0;
        knob.style.transform = '';
        stick.classList.remove('on');
      }
      if (e.pointerId === lookId) lookId = null;
    };
    this.listen(layer, 'pointerdown', onDown);
    this.listen(layer, 'pointermove', onMove);
    this.listen(layer, 'pointerup', onUp);
    this.listen(layer, 'pointercancel', onUp);
  }

  dispose(): void {
    for (const c of this.cleanup) c();
  }
}

function dz(v: number): number {
  return Math.abs(v) < DEADZONE ? 0 : (v - Math.sign(v) * DEADZONE) / (1 - DEADZONE);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  return e;
}

/** Pointer lock can be refused (no user gesture, headless browsers): that is not an error for the game. */
export function requestLock(el: HTMLElement): void {
  try {
    const r = el.requestPointerLock?.() as unknown;
    if (r instanceof Promise) r.catch(() => {});
  } catch {
    // Ignored: the player can click again.
  }
}
