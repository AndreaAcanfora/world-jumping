import { describe, expect, it } from 'vitest';
import { checkClearPath, checkGems, checkRoute, stopPoint } from '../src/level/reach';
import { LEVELS } from '../src/levels';

describe.each(LEVELS.map((l) => [l.id, l] as const))('level %s', (_, level) => {
  it('has a route where every jump goes up or stays level and is comfortably reachable', () => {
    const bad = checkRoute(level).filter((c) => !c.ok);
    expect(bad.map((c) => `${c.from}->${c.to}: ${c.reason}`)).toEqual([]);
  });

  it('climbs: at least four jumps, and the flag is higher than the start', () => {
    const checks = checkRoute(level);
    expect(checks.filter((c) => !c.walk).length).toBeGreaterThanOrEqual(4);
    expect(level.flag[1] - stopPoint(level, level.route[0]!)[1]).toBeGreaterThan(2);
  });

  it('keeps scenery out of the way between route stops', () => {
    expect(checkClearPath(level)).toEqual([]);
  });

  it('lets you collect every gem with normal jumps, without falling', () => {
    expect(checkGems(level)).toEqual([]);
  });

  it('has three gems and medal times in order', () => {
    expect(level.gems).toHaveLength(3);
    expect(level.medals.gold).toBeLessThan(level.medals.silver);
    expect(level.medals.silver).toBeLessThan(level.medals.bronze);
  });
});

describe('progression', () => {
  it('makes each level of a world at least as long as the one before', () => {
    const lengths = LEVELS.map((l) =>
      l.route.slice(1).reduce((sum, w, i) => {
        const a = stopPoint(l, l.route[i]!);
        const b = stopPoint(l, w);
        return sum + Math.hypot(b[0] - a[0], b[2] - a[2]);
      }, 0),
    );
    for (let i = 1; i < lengths.length; i++) expect(lengths[i]!, `level ${LEVELS[i]!.id}`).toBeGreaterThanOrEqual(lengths[i - 1]! * 0.95);
  });
});
