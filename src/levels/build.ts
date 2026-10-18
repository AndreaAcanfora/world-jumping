import { boundsOf, topOf } from '../level/reach';
import type { Piece, Vec3 } from '../level/types';

/** A floating island whose walkable top is at `top` (x, height, z). */
export function island(top: Vec3, model = 'block-grass-overhang-large'): Piece {
  return { model, at: [top[0], top[1] - boundsOf(model).max[1]!, top[2]] };
}

/** Centre of a piece's top surface, raised by `lift`. */
export function topCentre(p: Piece, lift = 0): Vec3 {
  const t = topOf(p.model, p.at, p.turns);
  return [(t.minX + t.maxX) / 2, t.y + lift, (t.minZ + t.maxZ) / 2];
}

/** Scenery standing on a surface point, nudged sideways by (dx, dz). */
export function on(point: Vec3, model: string, dx = 0, dz = 0, turns = 0): Piece {
  return { model, at: [point[0] + dx, point[1], point[2] + dz], ...(turns ? { turns } : {}) };
}

/** Coins along the arc of a jump between two surface points: they show where to jump. */
export function arc(a: Vec3, b: Vec3, count = 3, height = 1.1): Vec3[] {
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 1) / (count + 1);
    return [a[0] + (b[0] - a[0]) * t, a[1] + 0.5 + (b[1] - a[1]) * t + Math.sin(Math.PI * t) * height, a[2] + (b[2] - a[2]) * t];
  });
}

/** Coins in a line along a walk between two surface points. */
export function line(a: Vec3, b: Vec3, count = 3): Vec3[] {
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 1) / (count + 1);
    return [a[0] + (b[0] - a[0]) * t, Math.max(a[1], b[1]) + 0.5, a[2] + (b[2] - a[2]) * t];
  });
}

export const lift = (p: Vec3, dy: number): Vec3 => [p[0], p[1] + dy, p[2]];
