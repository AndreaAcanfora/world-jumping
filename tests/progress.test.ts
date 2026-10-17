import { describe, expect, it } from 'vitest';
import { medalFor, mergeRecord, starsOf } from '../src/game/progress';

const medals = { gold: 16, silver: 22, bronze: 32 };

describe('medals', () => {
  it('awards the best medal the time qualifies for', () => {
    expect(medalFor(15.9, medals)).toBe('gold');
    expect(medalFor(16, medals)).toBe('gold');
    expect(medalFor(21, medals)).toBe('silver');
    expect(medalFor(30, medals)).toBe('bronze');
    expect(medalFor(40, medals)).toBeNull();
  });
});

describe('records', () => {
  it('keeps the best time and every gem ever found', () => {
    let r = mergeRecord(undefined, { time: 25, gems: [true, false, false] });
    r = mergeRecord(r, { time: 30, gems: [false, false, true] });
    expect(r).toEqual({ best: 25, gems: [true, false, true] });
  });

  it('counts a finished level, its medal and gems as stars', () => {
    expect(starsOf(undefined, medals)).toBe(0);
    // 1 for finishing, 3 for gold, 1 per gem.
    expect(starsOf({ best: 15, gems: [true, true, false] }, medals)).toBe(6);
    expect(starsOf({ best: 31, gems: [false, false, false] }, medals)).toBe(2);
  });
});
