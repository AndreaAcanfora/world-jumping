/**
 * Player movement rules, independent from rendering and from the physics engine so
 * they can be unit tested. Units: 1 = one Kenney block; seconds.
 *
 * The physics engine (Rapier's character controller) only resolves collisions: it
 * moves the capsule by `vel * dt` and reports whether it ended on the ground.
 */

export const TUNING = {
  gravity: 28,
  jumpVelocity: 9.2,
  /** Vertical speed is multiplied by this when the jump button is released while rising. */
  jumpCut: 0.45,
  maxFallSpeed: 22,
  runSpeed: 5.5,
  groundAccel: 60,
  groundDecel: 80,
  airAccel: 22,
  /** Grace period to jump after walking off a ledge. */
  coyoteTime: 0.12,
  /** A jump pressed this long before landing still happens. */
  jumpBuffer: 0.12,
  dashSpeed: 14,
  dashTime: 0.18,
  jetpackAccel: 45,
  jetpackMaxRise: 5,
  /** Launch speed of a spring. */
  springVelocity: 15,
} as const;

/** Highest point of a full jump above take-off. */
export const apexHeight = (): number => (TUNING.jumpVelocity * TUNING.jumpVelocity) / (2 * TUNING.gravity);

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface MoveInput {
  /** Desired horizontal direction in world space; length up to 1. */
  x: number;
  z: number;
  jumpPressed: boolean;
  jumpHeld: boolean;
  dashPressed: boolean;
  jetpackHeld: boolean;
}

export interface MoveState {
  vel: Vec3Like;
  /** Facing angle around Y; the direction is (sin, cos). */
  facing: number;
  coyote: number;
  buffer: number;
  /** Rising from a jump, so releasing the button can still cut it short. */
  rising: boolean;
  dashTimer: number;
  dashes: number;
  /** Jetpack fuel in seconds of thrust. */
  fuel: number;
}

/** Fuel left over from floating-point rounding counts as empty. */
const FUEL_EPSILON = 1e-6;

export type MoveEvent = 'jump' | 'dash' | 'jetpack';

export function newMoveState({ dashes = 0, fuel = 0 }: { dashes?: number; fuel?: number }): MoveState {
  return { vel: { x: 0, y: 0, z: 0 }, facing: 0, coyote: 0, buffer: 0, rising: false, dashTimer: 0, dashes, fuel };
}

function approach(value: number, target: number, maxDelta: number): number {
  return value < target ? Math.min(target, value + maxDelta) : Math.max(target, value - maxDelta);
}

export function stepMovement(
  prev: MoveState,
  input: MoveInput,
  grounded: boolean,
  dt: number,
): { state: MoveState; events: MoveEvent[] } {
  const s: MoveState = { ...prev, vel: { ...prev.vel } };
  const events: MoveEvent[] = [];
  const inputLen = Math.min(1, Math.hypot(input.x, input.z));
  if (inputLen > 0.01) s.facing = Math.atan2(input.x, input.z);

  s.coyote = grounded ? TUNING.coyoteTime : s.coyote - dt;
  s.buffer = input.jumpPressed ? TUNING.jumpBuffer : s.buffer - dt;
  if (grounded && s.vel.y <= 0) {
    s.vel.y = 0;
    s.rising = false;
  }

  if (s.buffer > 0 && s.coyote > 0) {
    s.vel.y = TUNING.jumpVelocity;
    s.buffer = 0;
    s.coyote = 0;
    s.rising = true;
    events.push('jump');
  } else if (s.rising && !input.jumpHeld && s.vel.y > 0) {
    s.vel.y *= TUNING.jumpCut;
    s.rising = false;
  }

  if (input.dashPressed && s.dashes > 0 && s.dashTimer <= 0) {
    s.vel.x = Math.sin(s.facing) * TUNING.dashSpeed;
    s.vel.z = Math.cos(s.facing) * TUNING.dashSpeed;
    s.vel.y = Math.max(s.vel.y, 1.5);
    s.dashTimer = TUNING.dashTime;
    s.dashes--;
    events.push('dash');
  }

  if (s.dashTimer > 0) {
    // A dash keeps its speed and ignores gravity for a moment.
    s.dashTimer -= dt;
    return { state: s, events };
  }

  const scale = inputLen > 1 ? 1 / inputLen : 1;
  const targetX = input.x * scale * TUNING.runSpeed;
  const targetZ = input.z * scale * TUNING.runSpeed;
  const accel = grounded ? (inputLen > 0.01 ? TUNING.groundAccel : TUNING.groundDecel) : TUNING.airAccel;
  s.vel.x = approach(s.vel.x, targetX, accel * dt);
  s.vel.z = approach(s.vel.z, targetZ, accel * dt);

  if (!grounded || s.vel.y > 0) s.vel.y = Math.max(-TUNING.maxFallSpeed, s.vel.y - TUNING.gravity * dt);

  if (input.jetpackHeld && s.fuel > FUEL_EPSILON) {
    s.vel.y = Math.min(TUNING.jetpackMaxRise, s.vel.y + TUNING.jetpackAccel * dt);
    s.fuel = s.fuel - dt > FUEL_EPSILON ? s.fuel - dt : 0;
    s.rising = false;
    events.push('jetpack');
  }

  return { state: s, events };
}
