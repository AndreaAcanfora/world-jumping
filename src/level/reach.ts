import bounds from '../modelBounds.json' with { type: 'json' };
import { TUNING, apexHeight } from '../player/movement';
import type { LevelDef, Mover, Piece, Vec3 } from './types';

type Bounds = Record<string, { min: number[]; max: number[] }>;
const BOUNDS = bounds as Bounds;

/** Fraction of the physical limit a normal route jump may use: leaves room for imperfect timing. */
export const COMFORT = 0.7;
/** Highest step up a normal route jump may ask for, as a fraction of the jump apex. */
export const MAX_RISE = 0.8;

export interface Top {
  /** Walkable top rectangle: x and z ranges, and height. */
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y: number;
}

export function boundsOf(model: string) {
  const b = BOUNDS[model];
  if (!b) throw new Error(`unknown model ${model}`);
  return b;
}

/** Top surface of a model placed at `at`, rotated by quarter turns. */
export function topOf(model: string, at: Vec3, turns = 0): Top {
  const b = boundsOf(model);
  const swap = Math.abs(turns) % 2 === 1;
  const [x0, x1] = swap ? [b.min[2]!, b.max[2]!] : [b.min[0]!, b.max[0]!];
  const [z0, z1] = swap ? [b.min[0]!, b.max[0]!] : [b.min[2]!, b.max[2]!];
  return { minX: at[0] + x0, maxX: at[0] + x1, minZ: at[2] + z0, maxZ: at[2] + z1, y: at[1] + b.max[1]! };
}

/** Edge-to-edge horizontal distance between two top rectangles (0 if they overlap). */
export function gapBetween(a: Top, b: Top): number {
  const dx = Math.max(0, a.minX - b.maxX, b.minX - a.maxX);
  const dz = Math.max(0, a.minZ - b.maxZ, b.minZ - a.maxZ);
  return Math.hypot(dx, dz);
}

/** Longest horizontal distance a running jump covers when landing `rise` above take-off. */
export function maxJumpDistance(rise: number, v: number = TUNING.jumpVelocity): number {
  const g = TUNING.gravity;
  const disc = v * v - 2 * g * Math.max(rise, 0);
  if (disc < 0) return 0;
  return TUNING.runSpeed * ((v + Math.sqrt(disc)) / g);
}

export interface JumpCheck {
  from: number;
  to: number;
  gap: number;
  rise: number;
  limit: number;
  ok: boolean;
  reason?: string;
}

interface RouteStop {
  order: number;
  tops: Top[];
  needs?: Piece['needs'];
}

function moverTops(m: Mover): Top[] {
  return [topOf(m.model, m.from), topOf(m.model, m.to)];
}

/** Checks each jump along the main route: always up or level, never too far or too high. */
export function checkRoute(level: LevelDef): JumpCheck[] {
  const stops: RouteStop[] = [
    ...level.pieces
      .filter((p): p is Piece & { route: number } => p.route !== undefined)
      .map((p) => ({ order: p.route, tops: [topOf(p.model, p.at, p.turns)], ...(p.needs ? { needs: p.needs } : {}) })),
    ...(level.movers ?? []).filter((m): m is Mover & { route: number } => m.route !== undefined).map((m) => ({ order: m.route, tops: moverTops(m) })),
  ].sort((a, b) => a.order - b.order);

  const checks: JumpCheck[] = [];
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1]!;
    const b = stops[i]!;
    // A moving platform can be boarded at whichever end of its trip is easier.
    let best: JumpCheck | null = null;
    for (const ta of a.tops) {
      for (const tb of b.tops) {
        const rise = tb.y - ta.y;
        const gap = gapBetween(ta, tb);
        let limit = COMFORT * maxJumpDistance(rise);
        let maxRise = MAX_RISE * apexHeight();
        // The dash adds its speed over running speed, for its duration.
        if (b.needs === 'dash') limit += (TUNING.dashSpeed - TUNING.runSpeed) * TUNING.dashTime;
        if (b.needs === 'spring') {
          limit = COMFORT * maxJumpDistance(rise, TUNING.springVelocity);
          maxRise = (MAX_RISE * TUNING.springVelocity ** 2) / (2 * TUNING.gravity);
        }
        if (b.needs === 'jetpack') {
          // Jump, then climb on the jetpack: allow most of what the level's fuel can lift.
          limit = COMFORT * maxJumpDistance(0);
          maxRise = MAX_RISE * (apexHeight() + level.abilities.fuel * TUNING.jetpackMaxRise * 0.6);
        }
        let reason: string | undefined;
        if (rise < -0.05) reason = `goes down by ${(-rise).toFixed(2)}`;
        else if (rise > maxRise) reason = `rise ${rise.toFixed(2)} above ${maxRise.toFixed(2)}`;
        else if (gap > limit) reason = `gap ${gap.toFixed(2)} above ${limit.toFixed(2)}`;
        const check: JumpCheck = { from: a.order, to: b.order, gap, rise, limit, ok: !reason, ...(reason ? { reason } : {}) };
        if (!best || (check.ok && !best.ok) || (check.ok === best.ok && check.gap - check.limit < best.gap - best.limit)) best = check;
      }
    }
    checks.push(best!);
  }
  return checks;
}

/** Highest a gem may float above a surface and still be grabbed with a normal jump. */
export const GEM_REACH = 0.85 * apexHeight() + 0.9;

const NON_SOLID = new Set(['flowers', 'flowers-tall', 'grass', 'mushrooms', 'plant', 'stones']);

/**
 * Every gem must sit over something solid, close enough to grab with a normal jump, and
 * that support must be on the route or reachable from it and back with comfortable
 * jumps: collecting everything never forces a fall or an ability.
 */
export function checkGems(level: LevelDef): string[] {
  const routeTops = [
    ...level.pieces.filter((p) => p.route !== undefined).map((p) => [topOf(p.model, p.at, p.turns)]),
    ...(level.movers ?? []).filter((m) => m.route !== undefined).map(moverTops),
  ];
  const supports = [
    ...level.pieces.filter((p) => !NON_SOLID.has(p.model)).map((p) => ({ tops: [topOf(p.model, p.at, p.turns)], route: p.route !== undefined })),
    ...(level.movers ?? []).map((m) => ({ tops: moverTops(m), route: m.route !== undefined })),
  ];
  const comfortable = (a: Top, b: Top) => {
    const rise = b.y - a.y;
    return rise <= MAX_RISE * apexHeight() && gapBetween(a, b) <= COMFORT * maxJumpDistance(rise);
  };

  const problems: string[] = [];
  (level.gems ?? []).forEach((g, i) => {
    const under = supports.filter((s) =>
      s.tops.some((t) => g[0] >= t.minX - 0.3 && g[0] <= t.maxX + 0.3 && g[2] >= t.minZ - 0.3 && g[2] <= t.maxZ + 0.3 && g[1] >= t.y && g[1] - t.y <= GEM_REACH),
    );
    if (under.length === 0) {
      problems.push(`gem ${i + 1} floats with nothing to jump from under it`);
      return;
    }
    const ok = under.some(
      (s) =>
        s.route ||
        s.tops.some((t) => routeTops.some((r) => r.some((rt) => comfortable(rt, t))) && routeTops.some((r) => r.some((rt) => comfortable(t, rt) || (rt.y < t.y && gapBetween(t, rt) <= COMFORT * maxJumpDistance(0))))),
    );
    if (!ok) problems.push(`gem ${i + 1} sits on a platform you cannot reach and leave with normal jumps`);
  });
  return problems;
}
