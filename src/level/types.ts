export type Vec3 = [number, number, number];

export type Theme = 'grass' | 'snow';

export interface Text {
  it: string;
  en: string;
}

/** A static model placed in the level. Kenney models have their origin at the bottom centre. */
export interface Piece {
  model: string;
  at: Vec3;
  /** Rotation around Y in quarter turns. */
  turns?: number;
  /** Order along the main route; the test suite checks every jump between consecutive route pieces. */
  route?: number;
  /** This jump on the route is meant to need an ability. */
  needs?: 'dash' | 'jetpack' | 'spring';
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
  route?: number;
}

export interface LevelDef {
  id: string;
  name: Text;
  theme: Theme;
  spawn: Vec3;
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
