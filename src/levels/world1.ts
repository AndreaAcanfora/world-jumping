import type { LevelDef, Vec3, Waypoint } from '../level/types';
import { area } from './area';
import { arc, island, lift, line, on, topCentre } from './build';

const start = (at: Vec3): Waypoint => ({ at });
const walk = (at: Vec3): Waypoint => ({ at, move: 'walk' });
const jump = (at: Vec3, needs?: Waypoint['needs']): Waypoint => (needs ? { at, needs } : { at });

/** Coins for a route: arcs over jumps, lines along walks (moving platforms are skipped). */
function coinsFor(route: Waypoint[]): Vec3[] {
  const coins: Vec3[] = [];
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!;
    const b = route[i]!;
    if (!('at' in a) || !('at' in b)) continue;
    coins.push(...(b.move === 'walk' ? line(a.at, b.at, 2) : arc(a.at, b.at)));
  }
  return coins;
}

/* ------------------------------------------------------------------ 1-1 */
// A meadow, a few islands up to a plateau with a secret ledge, more islands, a hill.

const meadow = area('meadow', [0, 0, 0], [
  '1 1 2 .',
  '1 1 2 2',
  '1 1 1 2',
  '1 1 1 1',
]);
const i11 = [island([4, 2.5, 9.6]), island([2, 3, 12.9]), island([4.5, 3.5, 16.3])];
const plateau = area('plateau', [0, 0, 19.8], [
  '3 . 5 5 5',
  '3 . 4E 5 5',
  '3 4 4 4 .',
  '. 4 4 4 .',
  '. . 4 . .',
]);
const i11b = [island([8, 5.5, 31.4]), island([6, 6, 34.8]), island([8.6, 6.5, 37.6])];
const hill = area('hill', [6.6, 0, 41.04], [
  '8 8 8',
  '7 7 8',
  '7 7 .',
]);
// A small ledge beside the second group of islands, one step below: a detour for a gem.
const ledge11 = island([4.8, 5, 31.4], 'block-grass-overhang-low');

const route11: Waypoint[] = [
  start(meadow.at(3, 1)),
  walk(meadow.at(1, 2)),
  walk(meadow.at(0, 2)),
  jump(topCentre(i11[0]!)),
  jump(topCentre(i11[1]!)),
  jump(topCentre(i11[2]!)),
  jump(plateau.at(4, 2)),
  walk(plateau.at(2, 2)),
  walk(plateau.at(1, 3)),
  walk(plateau.at(0, 4)),
  jump(topCentre(i11b[0]!)),
  jump(topCentre(i11b[1]!)),
  jump(topCentre(i11b[2]!)),
  jump(hill.at(2, 1)),
  walk(hill.at(1, 1)),
  walk(hill.at(0, 1)),
];

const firstSteps: LevelDef = {
  id: '1-1',
  name: { it: 'Primi passi', en: 'First steps' },
  theme: 'grass',
  route: route11,
  flag: hill.at(0, 1),
  medals: { gold: 15, silver: 22, bronze: 35 },
  abilities: { dashes: 0, fuel: 0, magic: 0 },
  pieces: [
    ...meadow.pieces,
    ...i11,
    ...plateau.pieces,
    ...i11b,
    ledge11,
    ...hill.pieces,
    on(meadow.at(0, 0), 'tree'),
    on(meadow.at(3, 3), 'flowers'),
    on(plateau.at(0, 2), 'tree-pine'),
    on(plateau.at(3, 1), 'rocks', -0.5, 0.5),
    on(plateau.at(1, 4), 'flowers'),
    on(hill.at(1, 0), 'tree'),
    on(hill.at(0, 2), 'grass'),
  ],
  coins: coinsFor(route11),
  gems: [
    // Secret: the lower ledge along the plateau's west side, past a gap in the ground.
    plateau.at(0, 0, 0.3),
    lift(topCentre(ledge11), 0.3),
    hill.at(0, 2, 0.3),
  ],
  checkpoints: [plateau.at(3, 1)],
  killY: -8,
  hint: { it: 'Corri e salta sempre più in alto fino alla bandiera.', en: 'Run and jump ever higher to reach the flag.' },
};

/* ------------------------------------------------------------------ 1-2 */
// Moving bridges, a spring up to a high field with a hole in the middle, a ferry and a lift.

const start12 = area('start', [0, 0, 0], [
  '2 2 2',
  '1N 2 .',
  '1 1 .',
]);
const mid12 = area('mid', [0, 0, 14.9], [
  '4 4 4 .',
  '3E 4 4 2',
  '3 3 3 2',
  '. 3 . .',
]);
const high12 = area('high', [0, 0, 24.44], [
  '7 7 7 7',
  '7 . . 7',
  '7 7 7 7',
]);
const east12 = area('east', [15.9, 0.5, 24.44], [
  '8 8',
  '7 8',
  '7 7',
]);
const top12 = area('top', [17.9, 5, 34.34], [
  '8 8 .',
  '7 7 7',
]);
// Hidden below the high field's west edge.
const ledge12 = island([-2.6, 6, 26.44], 'block-grass-overhang-low');
const spring12: Vec3 = mid12.at(0, 1);

const route12: Waypoint[] = [
  start(start12.at(2, 0)),
  walk(start12.at(1, 1)),
  walk(start12.at(0, 1)),
  { mover: 0 },
  jump(mid12.at(3, 1)),
  walk(mid12.at(2, 1)),
  walk(mid12.at(1, 1)),
  walk(spring12),
  jump(high12.at(2, 1), 'spring'),
  walk(high12.at(2, 3)),
  { mover: 1 },
  jump(east12.at(2, 0)),
  walk(east12.at(1, 0)),
  walk(east12.at(0, 0)),
  walk(east12.at(0, 1)),
  { mover: 2 },
  jump(top12.at(1, 0)),
  walk(top12.at(1, 1)),
  walk(top12.at(0, 1)),
];

const movingBridges: LevelDef = {
  id: '1-2',
  name: { it: 'Ponti mobili', en: 'Moving bridges' },
  theme: 'grass',
  route: route12,
  flag: top12.at(0, 1),
  medals: { gold: 36, silver: 50, bronze: 75 },
  abilities: { dashes: 0, fuel: 0, magic: 0 },
  pieces: [
    ...start12.pieces,
    ...mid12.pieces,
    ...high12.pieces,
    ledge12,
    ...east12.pieces,
    ...top12.pieces,
    on(start12.at(0, 2), 'tree'),
    on(mid12.at(0, 0), 'tree-pine'),
    on(high12.at(0, 0), 'tree'),
    on(high12.at(0, 3), 'tree-pine'),
    on(east12.at(1, 1), 'flowers'),
    on(top12.at(0, 0), 'rocks'),
  ],
  movers: [
    { model: 'block-moving-large', from: [2, 1.8, 7], to: [2, 1.8, 12], period: 5 },
    { model: 'block-moving-large', from: [9, 6.5, 24.44], to: [13, 6.5, 24.44], period: 4.5 },
    { model: 'block-moving-large', from: [17.9, 8, 31.44], to: [17.9, 11, 31.44], period: 5 },
  ],
  springs: [spring12],
  coins: coinsFor(route12),
  gems: [
    // On the lower ledge along the middle area's east side.
    mid12.at(1, 3, 0.3),
    lift(topCentre(ledge12), 0.3),
    top12.at(1, 2, 0.3),
  ],
  checkpoints: [mid12.at(2, 1), east12.at(1, 0)],
  killY: -8,
  hint: {
    it: 'Le piattaforme gialle si muovono: aspetta che si avvicinino e restaci sopra. La molla ti lancia in alto.',
    en: 'Yellow platforms move: wait for them to come close and stay on. The spring launches you up.',
  },
};

/* ------------------------------------------------------------------ 1-3 */
// A dash across a wide gap, terraces, a jetpack tower, a high field and a last climb.

const start13 = area('start', [0, 0, 0], [
  '2 2',
  '1 2',
  '1 1',
]);
const dash13 = island([2, 2, 9.98]);
const terrace13 = area('terrace', [0, 0.5, 13.42], [
  '2 3 3 .',
  '2 2 3 2',
  '. 2 . .',
]);
const tower13 = island([4, 7.3, 20.7], 'block-grass-large-tall');
const field13 = area('field', [2, 0.8, 24.14], [
  '8 8 7',
  '7 7 7',
  '7 7 .',
]);
const i13 = [island([4, 9.3, 31.52]), island([6.5, 9.8, 34.6])];
const ridge13 = area('ridge', [4.5, 1.3, 38.04], [
  '. 9 9 9',
  '. 9 . 9',
  '9 9 9 9',
]);
const i13b = [island([10.5, 10.8, 45.52]), island([8, 11.3, 48.6])];
const goal13 = area('goal', [8, 2.8, 52.04], [
  '9 9',
  '9 .',
]);

const route13: Waypoint[] = [
  start(start13.at(2, 0)),
  walk(start13.at(1, 1)),
  walk(start13.at(0, 1)),
  jump(topCentre(dash13), 'dash'),
  jump(terrace13.at(2, 1)),
  walk(terrace13.at(1, 1)),
  walk(terrace13.at(0, 2)),
  jump(topCentre(tower13), 'jetpack'),
  jump(field13.at(2, 1)),
  walk(field13.at(1, 1)),
  walk(field13.at(0, 1)),
  jump(topCentre(i13[0]!)),
  jump(topCentre(i13[1]!)),
  jump(ridge13.at(2, 1)),
  walk(ridge13.at(2, 3)),
  walk(ridge13.at(0, 3)),
  jump(topCentre(i13b[0]!)),
  jump(topCentre(i13b[1]!)),
  jump(goal13.at(1, 0)),
  walk(goal13.at(0, 1)),
];

const turboAndJetpack: LevelDef = {
  id: '1-3',
  name: { it: 'Turbo e jetpack', en: 'Turbo and jetpack' },
  theme: 'grass',
  route: route13,
  flag: goal13.at(0, 1),
  medals: { gold: 20, silver: 30, bronze: 48 },
  abilities: { dashes: 2, fuel: 1.5, magic: 1 },
  pieces: [
    ...start13.pieces,
    dash13,
    ...terrace13.pieces,
    tower13,
    ...field13.pieces,
    ...i13,
    ...ridge13.pieces,
    ...i13b,
    ...goal13.pieces,
    on(start13.at(0, 0), 'sign'),
    on(terrace13.at(0, 0), 'tree-pine'),
    on(field13.at(1, 2), 'tree'),
    on(ridge13.at(0, 1), 'tree-pine'),
    on(goal13.at(0, 0), 'flowers'),
  ],
  coins: coinsFor(route13),
  gems: [
    lift(topCentre(tower13), 1.5),
    // The low step on the terraces' east side.
    terrace13.at(1, 3, 0.3),
    // Tucked behind the field's high back row.
    field13.at(0, 2, 0.3),
  ],
  checkpoints: [terrace13.at(2, 1), field13.at(2, 1), ridge13.at(2, 1)],
  killY: -8,
  hint: {
    it: 'Il turbo (Shift) supera i salti lunghi, il jetpack (tieni premuto E) ti fa salire. Le cariche sono limitate.',
    en: 'Turbo (Shift) clears long gaps, the jetpack (hold E) lifts you up. Charges are limited.',
  },
};

export const WORLD1: LevelDef[] = [firstSteps, movingBridges, turboAndJetpack];
