import type { LevelDef, Piece, Vec3 } from '../level/types';
import { arc, route, topCentre } from './build';

const ISLAND = 'block-grass-overhang-large';
const TOWER = 'block-grass-large-tall';

function arcs(r: Piece[], pairs: number[]): Vec3[] {
  return pairs.flatMap((i) => arc(r[i]!, r[i + 1]!));
}

const add = (v: Vec3, d: Vec3): Vec3 => [v[0] + d[0], v[1] + d[1], v[2] + d[2]];

/* ------------------------------------------------------------------ 1-1 */

const r11 = route(
  [0, 0, 0],
  ISLAND,
  [
    { d: [0, 1.5, 3.6] },
    { d: [2, 0.5, 3] },
    { d: [0, 1, 3.4] },
    { d: [-3, 0.5, 2] },
    { d: [-1, 0.5, 3.6] },
    { d: [2.5, 1, 2.5] },
    { d: [0, 0, 4.2] },
    { d: [3.5, 0.5, 0] },
    { d: [0, 1, 3.5] },
    { d: [0, 0.5, 3.4] },
  ],
  0,
  TOWER,
);

const firstSteps: LevelDef = {
  id: '1-1',
  name: { it: 'Primi passi', en: 'First steps' },
  theme: 'grass',
  spawn: topCentre(r11[0]!),
  flag: topCentre(r11[10]!),
  medals: { gold: 10.5, silver: 15, bronze: 24 },
  abilities: { dashes: 0, fuel: 0, magic: 0 },
  pieces: [
    ...r11,
    // Side islands with gems, a short detour from the route.
    { model: 'block-grass-overhang-low', at: add(r11[3]!.at, [3.2, 0.3, 0]) },
    { model: 'platform', at: add(r11[7]!.at, [-3, 0.6, 0]) },
    { model: 'block-grass', at: add(r11[10]!.at, [0.6, 1, -0.6]) },
    // Scenery on the islands.
    { model: 'tree', at: add(r11[2]!.at, [0.6, 1, 0.6]) },
    { model: 'flowers', at: add(r11[4]!.at, [-0.5, 1, 0.4]) },
    { model: 'tree-pine', at: add(r11[6]!.at, [0.7, 1, 0.7]) },
    { model: 'grass', at: add(r11[8]!.at, [0.6, 1, -0.6]) },
    { model: 'rocks', at: add(r11[9]!.at, [-0.6, 1, 0.6]) },
  ],
  coins: arcs(r11, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
  gems: [
    topCentre({ model: 'block-grass-overhang-low', at: add(r11[3]!.at, [3.2, 0.3, 0]) }, 0.3),
    topCentre({ model: 'platform', at: add(r11[7]!.at, [-3, 0.6, 0]) }, 0.3),
    topCentre({ model: 'block-grass', at: add(r11[10]!.at, [0.6, 1, -0.6]) }, 0.3),
  ],
  checkpoints: [topCentre(r11[5]!)],
  killY: -8,
  hint: { it: 'Corri e salta sempre più in alto fino alla bandiera.', en: 'Run and jump ever higher to reach the flag.' },
};

/* ------------------------------------------------------------------ 1-2 */

const r12a = route([0, 0, 0], ISLAND, [{ d: [0, 1.5, 3.5] }], 0, TOWER);
const r12b = route(
  [0, 2.3, 12.7],
  ISLAND,
  [{ d: [0, 3, 3.6], needs: 'spring' }],
  3,
);
const r12c = route([9.6, 5.8, 16.3], ISLAND, [{ d: [0, 1, 3.4] }], 6);
const r12d = route([9.6, 10.3, 25.7], ISLAND, [], 9);
const elevatorFoot: Vec3 = [9.6, 7.3, 22.7];

const movingBridges: LevelDef = {
  id: '1-2',
  name: { it: 'Ponti mobili', en: 'Moving bridges' },
  theme: 'grass',
  spawn: topCentre(r12a[0]!),
  flag: topCentre(r12d[0]!),
  medals: { gold: 22, silver: 30, bronze: 45 },
  abilities: { dashes: 0, fuel: 0, magic: 0 },
  pieces: [
    ...r12a,
    ...r12b,
    ...r12c,
    ...r12d,
    { model: 'tree', at: add(r12b[1]!.at, [0.6, 1, 0.6]) },
    { model: 'flowers', at: add(r12c[1]!.at, [-0.5, 1, -0.5]) },
    { model: 'platform', at: add(r12c[0]!.at, [3.2, 1.3, 0]) },
  ],
  movers: [
    // Across the first gap, towards the player and back.
    { model: 'block-moving-large', from: [0, 2.3, 5.7], to: [0, 2.3, 10.5], period: 5, route: 2 },
    // Sideways ferry to the right-hand islands.
    { model: 'block-moving-large', from: [2.5, 5.8, 16.3], to: [7, 5.8, 16.3], period: 4.5, route: 5 },
    // Lift.
    { model: 'block-moving-large', from: elevatorFoot, to: add(elevatorFoot, [0, 3, 0]), period: 5, route: 8 },
  ],
  springs: [add(topCentre(r12b[0]!), [0, 0, 0.5])],
  coins: [...arc(r12a[0]!, r12a[1]!), ...arc(r12b[0]!, r12b[1]!, 4, 1.8), ...arc(r12c[0]!, r12c[1]!)],
  gems: [
    add(topCentre(r12b[1]!), [0, 0.3, 0.6]),
    topCentre({ model: 'platform', at: add(r12c[0]!.at, [3.2, 1.3, 0]) }, 0.3),
    add(elevatorFoot, [0, 5.2, 0]),
  ],
  checkpoints: [topCentre(r12b[1]!)],
  killY: -8,
  hint: {
    it: 'Le piattaforme blu si muovono: aspetta che si avvicinino. La molla ti lancia in alto.',
    en: 'Blue platforms move: wait for them to come close. The spring launches you up.',
  },
};

/* ------------------------------------------------------------------ 1-3 */

const r13 = route(
  [0, 0, 0],
  ISLAND,
  [
    { d: [0, 1.5, 3.5] },
    { d: [0, 0, 6.0], needs: 'dash' },
    { d: [2.5, 0.5, 2.5] },
    { d: [0, 3, 3.2], model: TOWER, needs: 'jetpack' },
    { d: [-3, 1.5, 1.5] },
    { d: [0, 1, 3.4] },
    { d: [0, 0.5, 3.4] },
  ],
  0,
  TOWER,
);

const turboAndJetpack: LevelDef = {
  id: '1-3',
  name: { it: 'Turbo e jetpack', en: 'Turbo and jetpack' },
  theme: 'grass',
  spawn: topCentre(r13[0]!),
  flag: topCentre(r13[7]!),
  medals: { gold: 9, silver: 13, bronze: 20 },
  abilities: { dashes: 2, fuel: 1.5, magic: 1 },
  pieces: [
    ...r13,
    { model: 'tree-pine', at: add(r13[3]!.at, [-0.6, 1, 0.6]) },
    { model: 'sign', at: add(r13[1]!.at, [0.7, 1, 0.8]) },
    { model: 'flowers', at: add(r13[5]!.at, [0.5, 1, 0.5]) },
  ],
  coins: [...arc(r13[1]!, r13[2]!, 5, 0.6), ...arcs(r13, [2, 5, 6])],
  gems: [add(topCentre(r13[4]!), [0, 1.5, 0]), add(topCentre(r13[2]!), [3.5, 1.2, 0]), add(topCentre(r13[7]!), [0, 3, 0])],
  checkpoints: [topCentre(r13[3]!)],
  killY: -8,
  hint: {
    it: 'Il turbo (Shift) supera i salti lunghi, il jetpack (tieni premuto E) ti fa salire. Le cariche sono limitate.',
    en: 'Turbo (Shift) clears long gaps, the jetpack (hold E) lifts you up. Charges are limited.',
  },
};

export const WORLD1: LevelDef[] = [firstSteps, movingBridges, turboAndJetpack];
