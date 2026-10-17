import { describe, expect, it } from 'vitest';
import { TUNING, apexHeight, newMoveState, stepMovement } from '../src/player/movement';
import type { MoveInput, MoveState } from '../src/player/movement';

const DT = 1 / 60;
const idle: MoveInput = { x: 0, z: 0, jumpPressed: false, jumpHeld: false, dashPressed: false, jetpackHeld: false };

/** Simulates vertical motion only, treating y = 0 as the ground. */
function simulate(frames: (frame: number) => Partial<MoveInput>, steps = 120, fuel = 1) {
  let s: MoveState = newMoveState({ dashes: 2, fuel });
  let y = 0;
  let maxY = 0;
  let grounded = true;
  const events: string[] = [];
  for (let f = 0; f < steps; f++) {
    const r = stepMovement(s, { ...idle, ...frames(f) }, grounded, DT);
    s = r.state;
    for (const e of r.events) events.push(`${f}:${e}`);
    y += s.vel.y * DT;
    if (y <= 0) {
      y = 0;
      grounded = true;
      if (s.vel.y < 0) s = { ...s, vel: { ...s.vel, y: 0 } };
    } else grounded = false;
    maxY = Math.max(maxY, y);
  }
  return { s, maxY, events };
}

describe('jumping', () => {
  it('reaches about the analytic apex with the button held', () => {
    const { maxY } = simulate((f) => ({ jumpPressed: f === 0, jumpHeld: f < 60 }));
    expect(maxY).toBeGreaterThan(apexHeight() * 0.9);
    expect(maxY).toBeLessThan(apexHeight() * 1.02);
  });

  it('jumps lower when the button is released early', () => {
    const full = simulate((f) => ({ jumpPressed: f === 0, jumpHeld: f < 60 })).maxY;
    const short = simulate((f) => ({ jumpPressed: f === 0, jumpHeld: f < 4 })).maxY;
    expect(short).toBeLessThan(full * 0.6);
  });

  it('lets you jump shortly after walking off a ledge (coyote time)', () => {
    let s = newMoveState({});
    s = stepMovement(s, idle, true, DT).state;
    // Left the ground 4 frames ago.
    for (let i = 0; i < 4; i++) s = stepMovement(s, idle, false, DT).state;
    const r = stepMovement(s, { ...idle, jumpPressed: true, jumpHeld: true }, false, DT);
    expect(r.events).toContain('jump');
  });

  it('does not allow a jump long after leaving the ground', () => {
    let s = newMoveState({});
    s = stepMovement(s, idle, true, DT).state;
    for (let i = 0; i < 20; i++) s = stepMovement(s, idle, false, DT).state;
    expect(stepMovement(s, { ...idle, jumpPressed: true, jumpHeld: true }, false, DT).events).not.toContain('jump');
  });

  it('remembers a jump pressed just before landing (buffering)', () => {
    let s = newMoveState({});
    s = stepMovement(s, { ...idle, jumpPressed: true, jumpHeld: true }, false, DT).state;
    s = stepMovement(s, { ...idle, jumpHeld: true }, false, DT).state;
    const r = stepMovement(s, { ...idle, jumpHeld: true }, true, DT);
    expect(r.events).toContain('jump');
  });

  it('cannot double jump in the air', () => {
    const { events } = simulate((f) => ({ jumpPressed: f === 0 || f === 20, jumpHeld: true }), 40);
    expect(events.filter((e) => e.endsWith(':jump'))).toHaveLength(1);
  });
});

describe('running', () => {
  it('accelerates to run speed on the ground', () => {
    let s = newMoveState({});
    for (let i = 0; i < 60; i++) s = stepMovement(s, { ...idle, x: 1 }, true, DT).state;
    expect(s.vel.x).toBeCloseTo(TUNING.runSpeed, 1);
  });

  it('stops quickly with no input on the ground', () => {
    let s: MoveState = { ...newMoveState({}), vel: { x: TUNING.runSpeed, y: 0, z: 0 } };
    for (let i = 0; i < 15; i++) s = stepMovement(s, idle, true, DT).state;
    expect(Math.abs(s.vel.x)).toBeLessThan(0.1);
  });
});

describe('abilities', () => {
  it('dashes forward and spends a charge', () => {
    let s = { ...newMoveState({ dashes: 1 }), facing: 0 };
    const r = stepMovement(s, { ...idle, dashPressed: true }, true, DT);
    expect(r.events).toContain('dash');
    s = r.state;
    expect(s.dashes).toBe(0);
    expect(Math.hypot(s.vel.x, s.vel.z)).toBeGreaterThan(TUNING.runSpeed * 2);
    expect(stepMovement(s, { ...idle, dashPressed: true }, true, DT).events).not.toContain('dash');
  });

  it('returns to running speed when the dash ends, so its reach is predictable', () => {
    let s = { ...newMoveState({ dashes: 1 }), facing: 0 };
    s = stepMovement(s, { ...idle, z: 1, dashPressed: true }, false, DT).state;
    for (let i = 0; i < 12; i++) s = stepMovement(s, { ...idle, z: 1 }, false, DT).state;
    expect(Math.hypot(s.vel.x, s.vel.z)).toBeLessThanOrEqual(TUNING.runSpeed + 1e-9);
  });

  it('jetpack never slows down a jump that is already rising faster', () => {
    const plain = simulate((f) => ({ jumpPressed: f === 0, jumpHeld: true })).maxY;
    // A short burst of fuel at take-off must add height, not cap the jump.
    const boosted = simulate((f) => ({ jumpPressed: f === 0, jumpHeld: true, jetpackHeld: true }), 120, 0.15).maxY;
    expect(boosted).toBeGreaterThan(plain);
  });

  it('jetpack lifts while there is fuel, then stops', () => {
    let s = newMoveState({ fuel: 0.5 });
    let y = 1;
    for (let i = 0; i < 30; i++) {
      s = stepMovement(s, { ...idle, jetpackHeld: true }, false, DT).state;
      y += s.vel.y * DT;
    }
    expect(y).toBeGreaterThan(1.5);
    expect(s.fuel).toBeCloseTo(0, 5);
    const before = s.vel.y;
    s = stepMovement(s, { ...idle, jetpackHeld: true }, false, DT).state;
    expect(s.vel.y).toBeLessThan(before);
  });
});
