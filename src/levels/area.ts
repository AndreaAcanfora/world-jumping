import type { Piece, Theme, Vec3 } from '../level/types';

/** Side of one map cell: a large Kenney block. */
export const CELL = 2;
const DIRT = 0xd9864e;
const SNOW_DIRT = 0x8d9bb5;

const BLOCKS: Record<Theme, { flat: string; ramp: string }> = {
  grass: { flat: 'block-grass-large', ramp: 'block-grass-large-slope-steep' },
  snow: { flat: 'block-snow-large', ramp: 'block-snow-large-slope-steep' },
};

/** Ramp tokens: the map direction the ramp climbs towards, and the quarter turns that give it. */
const RAMPS: Record<string, number> = { N: 2, S: 0, W: 1, E: 3 };
/** The Kenney steep slope starts this far above its base and climbs about one unit. */
const RAMP_FOOT = 0.22;

export interface Area {
  id: string;
  pieces: Piece[];
  /** Feet position at the centre of a cell (row, column), on its top surface. */
  at(row: number, col: number, lift?: number): Vec3;
  /** Height of a flat cell's top. */
  height(row: number, col: number): number;
}

/**
 * Builds a landmass from a height map, one token per cell:
 *   '.'        empty
 *   '0'..'9'   flat ground, top at origin.y + digit
 *   '2N'       ramp from height 2 up to 3, climbing towards N/S/E/W
 * The first line is the far side (+z), columns grow along +x. Every cell is filled with
 * earth down to `depth` below the origin, so the area reads as one solid piece of land.
 */
export function area(id: string, origin: Vec3, map: string[], theme: Theme = 'grass', depth = 1.5): Area {
  const rows = map.map((line) => line.trim().split(/\s+/));
  const blocks = BLOCKS[theme];
  const pieces: Piece[] = [];
  const centre = (r: number, c: number): [number, number] => [origin[0] + c * CELL, origin[2] + (rows.length - 1 - r) * CELL];
  const bottom = origin[1] - depth;

  rows.forEach((tokens, r) =>
    tokens.forEach((token, c) => {
      if (token === '.') return;
      const m = /^(\d)([NSEW])?$/.exec(token);
      if (!m) throw new Error(`area ${id}: bad cell '${token}' at ${r},${c}`);
      const h = origin[1] + Number(m[1]);
      const [x, z] = centre(r, c);
      const ramp = m[2];
      const blockBase = ramp ? h - RAMP_FOOT : h - 1;
      pieces.push(ramp ? { model: blocks.ramp, at: [x, blockBase, z], turns: RAMPS[ramp]!, area: id } : { model: blocks.flat, at: [x, blockBase, z], area: id });
      const fill = blockBase - bottom;
      if (fill > 0.01) {
        pieces.push({ model: 'box', at: [x, bottom, z], size: [CELL, fill, CELL], color: theme === 'snow' ? SNOW_DIRT : DIRT, area: id, covered: true });
      }
    }),
  );

  const height = (r: number, c: number) => {
    const token = rows[r]?.[c];
    if (!token || !/^\d$/.test(token)) throw new Error(`area ${id}: cell ${r},${c} is not flat ground`);
    return origin[1] + Number(token);
  };
  return {
    id,
    pieces,
    height,
    at: (r, c, lift = 0) => {
      const [x, z] = centre(r, c);
      return [x, height(r, c) + lift, z];
    },
  };
}
