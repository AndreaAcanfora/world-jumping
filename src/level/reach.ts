import bounds from '../modelBounds.json' with { type: 'json' };
import { TUNING, apexHeight } from '../player/movement';
import type { LevelDef, Mover, Piece, Vec3, Waypoint } from './types';

type Bounds = Record<string, { min: number[]; max: number[] }>;
const BOUNDS = bounds as Bounds;

/** Fraction of the physical limit a normal route jump may use: leaves room for imperfect timing. */
export const COMFORT = 0.7;
/** Highest step up a normal route jump may ask for, as a fraction of the jump apex. */
export const MAX_RISE = 0.8;
/** Highest a walk between two stops of the same area may climb or drop (one terrace or ramp). */
export const WALK_STEP = 1.05;

/** Scenery the player passes through. */
export const NON_SOLID = new Set(['flowers', 'flowers-tall', 'grass', 'mushrooms', 'plant', 'stones']);
/** Scenery that is solid and could stand in the way of the route. */
const DECOR = new Set(['tree', 'tree-pine', 'tree-pine-small', 'tree-snow', 'tree-pine-snow', 'tree-pine-snow-small', 'rocks', 'sign', 'barrel', 'crate', 'crate-strong', 'poles', 'hedge', 'hedge-corner', 'chest']);

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

/** Top of any piece, including plain 'box' ground (origin at its bottom centre too). */
export function pieceTop(p: Piece): Top {
  if (p.model === 'box') {
    const [sx, sy, sz] = p.size ?? [1, 1, 1];
    return { minX: p.at[0] - sx / 2, maxX: p.at[0] + sx / 2, minZ: p.at[2] - sz / 2, maxZ: p.at[2] + sz / 2, y: p.at[1] + sy };
  }
  return topOf(p.model, p.at, p.turns);
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

export function moverTops(m: Mover): Top[] {
  return [topOf(m.model, m.from), topOf(m.model, m.to)];
}

const solid = (p: Piece) => !NON_SOLID.has(p.model);
/** Can you stand on this piece's top? */
const walkable = (p: Piece) => solid(p) && !p.covered;

/** The solid piece whose top surface holds `point` (feet position), if any. */
export function supportAt(level: LevelDef, point: Vec3): Piece | undefined {
  return level.pieces.find((p) => {
    if (!walkable(p)) return false;
    const t = pieceTop(p);
    return point[0] >= t.minX - 0.05 && point[0] <= t.maxX + 0.05 && point[2] >= t.minZ - 0.05 && point[2] <= t.maxZ + 0.05 && Math.abs(point[1] - t.y) < 0.1;
  });
}

/** Where a route stop is: the top of its support, or both ends of a moving platform. */
export function stopTops(level: LevelDef, w: Waypoint): Top[] {
  if ('mover' in w) {
    const m = level.movers?.[w.mover];
    if (!m) throw new Error(`route uses missing mover ${w.mover}`);
    return moverTops(m);
  }
  const s = supportAt(level, w.at);
  if (!s) throw new Error(`route stop [${w.at.join(', ')}] is not on top of anything`);
  return [pieceTop(s)];
}

/** A point to aim for at a route stop. */
export function stopPoint(level: LevelDef, w: Waypoint): Vec3 {
  if ('at' in w) return w.at;
  const t = moverTops(level.movers![w.mover])[0]!;
  return [(t.minX + t.maxX) / 2, t.y, (t.minZ + t.maxZ) / 2];
}

export interface JumpCheck {
  from: number;
  to: number;
  gap: number;
  rise: number;
  limit: number;
  walk: boolean;
  ok: boolean;
  reason?: string;
}

/**
 * Checks the main route. Jumps between areas always go up or stay level and stay well
 * inside what the physics allows; walks stay on one area with one terrace or ramp at most.
 */
export function checkRoute(level: LevelDef): JumpCheck[] {
  const checks: JumpCheck[] = [];
  for (let i = 1; i < level.route.length; i++) {
    const a = level.route[i - 1]!;
    const b = level.route[i]!;
    if (b.move === 'walk' && 'at' in b) {
      const sa = 'at' in a ? supportAt(level, a.at) : undefined;
      const sb = supportAt(level, b.at);
      const rise = 'at' in a ? b.at[1] - a.at[1] : 0;
      let reason: string | undefined;
      if (!sb) reason = 'walk ends in the air';
      else if (!sa || !sa.area || sa.area !== sb.area) reason = 'walk between different areas (use a jump)';
      else if (Math.abs(rise) > WALK_STEP) reason = `walk changes height by ${rise.toFixed(2)}`;
      checks.push({ from: i - 1, to: i, gap: 0, rise, limit: 0, walk: true, ok: !reason, ...(reason ? { reason } : {}) });
      continue;
    }
    const needs = b.needs;
    let best: JumpCheck | null = null;
    // A moving platform can be boarded at whichever end of its trip is easier.
    for (const ta of stopTops(level, a)) {
      for (const tb of stopTops(level, b)) {
        const rise = tb.y - ta.y;
        const gap = gapBetween(ta, tb);
        let limit = COMFORT * maxJumpDistance(rise);
        let maxRise = MAX_RISE * apexHeight();
        // The dash adds its speed over running speed, for its duration.
        if (needs === 'dash') limit += (TUNING.dashSpeed - TUNING.runSpeed) * TUNING.dashTime;
        if (needs === 'spring') {
          limit = COMFORT * maxJumpDistance(rise, TUNING.springVelocity);
          maxRise = (MAX_RISE * TUNING.springVelocity ** 2) / (2 * TUNING.gravity);
        }
        if (needs === 'jetpack') {
          // Jump, then climb on the jetpack: allow most of what the level's fuel can lift.
          limit = COMFORT * maxJumpDistance(0);
          maxRise = MAX_RISE * (apexHeight() + level.abilities.fuel * TUNING.jetpackMaxRise * 0.6);
        }
        let reason: string | undefined;
        if (rise < -0.05) reason = `jump goes down by ${(-rise).toFixed(2)}`;
        else if (rise > maxRise) reason = `rise ${rise.toFixed(2)} above ${maxRise.toFixed(2)}`;
        else if (gap > limit) reason = `gap ${gap.toFixed(2)} above ${limit.toFixed(2)}`;
        const check: JumpCheck = { from: i - 1, to: i, gap, rise, limit, walk: false, ok: !reason, ...(reason ? { reason } : {}) };
        if (!best || (check.ok && !best.ok) || (check.ok === best.ok && check.gap - check.limit < best.gap - best.limit)) best = check;
      }
    }
    checks.push(best!);
  }
  return checks;
}

/** Highest a gem may float above a surface and still be grabbed with a normal jump. */
export const GEM_REACH = 0.85 * apexHeight() + 0.9;

/**
 * Every gem must sit over something solid, close enough to grab with a normal jump, and
 * that support must be walkable from the route (same area) or reachable from it and back
 * with comfortable jumps: collecting everything never forces a fall or an ability.
 */
export function checkGems(level: LevelDef): string[] {
  const routeAreas = new Set(
    level.route.flatMap((w) => ('at' in w ? [supportAt(level, w.at)?.area].filter((a): a is string => Boolean(a)) : [])),
  );
  const onRoute = (p: Piece) => (p.area !== undefined && routeAreas.has(p.area)) || level.route.some((w) => 'at' in w && supportAt(level, w.at) === p);
  const routeTops = [
    ...level.pieces.filter((p) => walkable(p) && onRoute(p)).map((p) => pieceTop(p)),
    ...level.route.flatMap((w) => ('mover' in w ? moverTops(level.movers![w.mover]!) : [])),
  ];
  const comfortable = (a: Top, b: Top) => {
    const rise = b.y - a.y;
    return rise <= MAX_RISE * apexHeight() && gapBetween(a, b) <= COMFORT * maxJumpDistance(rise);
  };

  const problems: string[] = [];
  (level.gems ?? []).forEach((g, i) => {
    const under = level.pieces.filter((p) => {
      if (!walkable(p)) return false;
      const t = pieceTop(p);
      return g[0] >= t.minX - 0.3 && g[0] <= t.maxX + 0.3 && g[2] >= t.minZ - 0.3 && g[2] <= t.maxZ + 0.3 && g[1] >= t.y && g[1] - t.y <= GEM_REACH;
    });
    if (under.length === 0) {
      problems.push(`gem ${i + 1} floats with nothing to jump from under it`);
      return;
    }
    const ok = under.some((p) => {
      if (onRoute(p)) return true;
      const t = pieceTop(p);
      const there = routeTops.some((rt) => comfortable(rt, t));
      const back = routeTops.some((rt) => comfortable(t, rt) || (rt.y < t.y && gapBetween(t, rt) <= COMFORT * maxJumpDistance(0)));
      return there && back;
    });
    if (!ok) problems.push(`gem ${i + 1} sits on a platform you cannot reach and leave with normal jumps`);
  });
  return problems;
}

/** Distance from point (px, pz) to the segment a-b in the ground plane. */
function segmentDistance(px: number, pz: number, a: Vec3, b: Vec3): number {
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[2]) * dz) / len2));
  return Math.hypot(px - (a[0] + t * dx), pz - (a[2] + t * dz));
}

/**
 * Scenery must not stand in the way between consecutive route stops: walking or jumping
 * straight from one stop to the next never bumps into a tree or a rock.
 */
export function checkClearPath(level: LevelDef): string[] {
  const problems: string[] = [];
  for (let i = 1; i < level.route.length; i++) {
    const a = stopPoint(level, level.route[i - 1]!);
    const b = stopPoint(level, level.route[i]!);
    for (const p of level.pieces) {
      if (!DECOR.has(p.model)) continue;
      const t = pieceTop(p);
      // Only scenery standing on the walking surface (not far above or below it) can block.
      if (p.at[1] < Math.min(a[1], b[1]) - 0.3 || p.at[1] > Math.max(a[1], b[1]) + 0.3) continue;
      const half = Math.min(t.maxX - t.minX, t.maxZ - t.minZ) / 2;
      if (segmentDistance((t.minX + t.maxX) / 2, (t.minZ + t.maxZ) / 2, a, b) < half + 0.25) {
        problems.push(`${p.model} blocks the way from stop ${i - 1} to ${i}`);
      }
    }
  }
  return problems;
}
