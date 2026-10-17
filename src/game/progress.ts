import type { LevelDef } from '../level/types';
import type { CharacterModel } from '../player/Player';
import type { ViewMode } from '../camera/CameraRig';

export type Medal = 'gold' | 'silver' | 'bronze';

export interface LevelRecord {
  /** Best time in seconds. */
  best: number;
  /** Gems found in any run. */
  gems: boolean[];
}

export interface Settings {
  character: CharacterModel;
  view: ViewMode;
  sensitivity: number;
  invertY: boolean;
  quality: 'low' | 'high';
  lang: 'it' | 'en';
  sound: boolean;
}

export function medalFor(time: number, medals: LevelDef['medals']): Medal | null {
  if (time <= medals.gold) return 'gold';
  if (time <= medals.silver) return 'silver';
  if (time <= medals.bronze) return 'bronze';
  return null;
}

export function mergeRecord(prev: LevelRecord | undefined, run: { time: number; gems: boolean[] }): LevelRecord {
  return {
    best: prev ? Math.min(prev.best, run.time) : run.time,
    gems: run.gems.map((g, i) => g || Boolean(prev?.gems[i])),
  };
}

const MEDAL_STARS: Record<Medal, number> = { gold: 3, silver: 2, bronze: 1 };

/** Stars from one level: 1 for finishing, up to 3 for the medal, 1 per gem. */
export function starsOf(record: LevelRecord | undefined, medals: LevelDef['medals']): number {
  if (!record) return 0;
  const medal = medalFor(record.best, medals);
  return 1 + (medal ? MEDAL_STARS[medal] : 0) + record.gems.filter(Boolean).length;
}

const KEY = 'wj2.progress';
const SETTINGS_KEY = 'wj2.settings';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or full storage: progress lasts for this session only.
  }
}

export const loadRecords = (): Record<string, LevelRecord> => read<Record<string, LevelRecord>>(KEY, {});
export const saveRecords = (r: Record<string, LevelRecord>): void => write(KEY, r);

export function defaultSettings(): Settings {
  const it = typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('it');
  const lowEnd = typeof navigator !== 'undefined' && /Android|iPhone|iPad/i.test(navigator.userAgent);
  return { character: 'character-oobi', view: 'third', sensitivity: 1, invertY: false, quality: lowEnd ? 'low' : 'high', lang: it ? 'it' : 'en', sound: true };
}

export const loadSettings = (): Settings => read<Settings>(SETTINGS_KEY, defaultSettings());
export const saveSettings = (s: Settings): void => write(SETTINGS_KEY, s);
