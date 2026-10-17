import { describe, expect, it } from 'vitest';
import { checkClearPath, checkGems, checkRoute } from '../src/level/reach';
import { LEVELS } from '../src/levels';

describe.each(LEVELS.map((l) => [l.id, l] as const))('level %s', (_, level) => {
  it('has a route where every jump goes up or stays level and is comfortably reachable', () => {
    const bad = checkRoute(level).filter((c) => !c.ok);
    expect(bad.map((c) => `${c.from}->${c.to}: ${c.reason}`)).toEqual([]);
  });

  it('has a route of at least 4 jumps that ends higher than it starts', () => {
    const checks = checkRoute(level);
    expect(checks.length).toBeGreaterThanOrEqual(4);
    expect(checks.reduce((sum, c) => sum + c.rise, 0)).toBeGreaterThan(2);
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
