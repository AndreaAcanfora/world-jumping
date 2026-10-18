export type Vec3 = [number, number, number];

export type Theme = 'grass' | 'snow';

export interface Text {
  it: string;
  en: string;
}

export type Needs = 'dash' | 'jetpack' | 'spring';

/** A static model placed in the level. Kenney models have their origin at the bottom centre. */
export interface Piece {
  /** A Kenney model name, or 'box' for plain ground (see `size` and `color`). */
  model: string;
  at: Vec3;
  /** Rotation around Y in quarter turns. */
  turns?: number;
  /** Size of a 'box' piece. */
  size?: Vec3;
  color?: number;
  /** Pieces of the same area form one walkable landmass. */
  area?: string;
  /** Covered by another piece (earth under an area cell): never a walking surface. */
  covered?: boolean;
}

/** A platform that travels back and forth between two points. */
export interface Mover {
  model: string;
  from: Vec3;
  to: Vec3;
  /** Seconds for a full trip there and back. */
  period: number;
  /** Starting offset as a fraction of the period. */
  phase?: number;
}

/**
 * One stop of the main route. The player walks between stops in the same area and
 * jumps between areas; the tests check every jump.
 */
export type Waypoint =
  | { at: Vec3; move?: 'walk' | 'jump'; needs?: Needs }
  | { mover: number; move?: 'jump'; needs?: Needs };

export interface LevelDef {
  id: string;
  name: Text;
  theme: Theme;
  /** Main route: the first stop is the spawn point (feet position on a surface). */
  route: Waypoint[];
  /** Base of the goal flag; reaching it ends the level. */
  flag: Vec3;
  /** Medal thresholds in seconds. */
  medals: { gold: number; silver: number; bronze: number };
  abilities: { dashes: number; fuel: number; magic: number };
  pieces: Piece[];
  movers?: Mover[];
  springs?: Vec3[];
  coins?: Vec3[];
  gems?: Vec3[];
  checkpoints?: Vec3[];
  /** Falling below this height means a respawn at the last checkpoint. */
  killY: number;
  hint?: Text;
}
