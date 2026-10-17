import { topOf } from '../level/reach';
import type { Piece, Vec3 } from '../level/types';

export interface Step {
  /** Offset of this piece's base from the previous route piece's base. */
  d: Vec3;
  model?: string;
  turns?: number;
  needs?: Piece['needs'];
}

/**
 * Lays out a route from relative steps, so a level reads like the sequence of
 * jumps the player makes. Returns the pieces and the absolute base of each one.
 */
export function route(start: Vec3, defaultModel: string, steps: Step[], firstOrder = 0, startModel = defaultModel) {
  const pieces: Piece[] = [{ model: startModel, at: start, route: firstOrder }];
  let at = start;
  steps.forEach((s, i) => {
    at = [at[0] + s.d[0], at[1] + s.d[1], at[2] + s.d[2]];
    pieces.push({
      model: s.model ?? defaultModel,
      at,
      route: firstOrder + i + 1,
      ...(s.turns ? { turns: s.turns } : {}),
      ...(s.needs ? { needs: s.needs } : {}),
    });
  });
  return pieces;
}

/** Centre of a piece's top surface, raised by `lift`. */
export function topCentre(p: Piece, lift = 0): Vec3 {
  const t = topOf(p.model, p.at, p.turns);
  return [(t.minX + t.maxX) / 2, t.y + lift, (t.minZ + t.maxZ) / 2];
}

/** Coins along the arc of the jump between two pieces: they show where to jump. */
export function arc(a: Piece, b: Piece, count = 3, height = 1.1): Vec3[] {
  const p = topCentre(a, 0.5);
  const q = topCentre(b, 0.5);
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 1) / (count + 1);
    return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t + Math.sin(Math.PI * t) * height, p[2] + (q[2] - p[2]) * t];
  });
}
