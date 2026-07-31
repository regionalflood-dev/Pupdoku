import generatedLevels from './levels.generated.json';
import { createRegionPalette, type BoardType, type Difficulty, type InitialClue, type Position, type Puzzle } from './game';
import type { LogicRule } from './logic';

export type GameMode = 'main' | 'daily' | 'hex';
export type DailyChallengeKey = `square:${number}` | `hex:${number}`;

export interface StoredLevel {
  id: number;
  seed: number;
  boardType?: BoardType;
  size: number;
  difficulty: Difficulty;
  targetSeconds: number;
  cats: Position[];
  regions: number[][];
  palette: string[];
  initialClues: InitialClue[];
  logicSteps: number;
  logicRules: LogicRule[];
}

interface LevelCatalog {
  version: number;
  generatedAt: string;
  main: StoredLevel[];
  challenges: StoredLevel[];
  dailyHex: StoredLevel[];
  hex: StoredLevel[];
}

const catalog = generatedLevels as LevelCatalog;

export const MAIN_LEVEL_COUNT = catalog.main.length;
export const SQUARE_CHALLENGE_LEVEL_COUNT = catalog.challenges.length;
export const DAILY_HEX_LEVEL_COUNT = catalog.dailyHex.length;
export const CHALLENGE_LEVEL_COUNT = SQUARE_CHALLENGE_LEVEL_COUNT + DAILY_HEX_LEVEL_COUNT;
export const HEX_LEVEL_COUNT = catalog.hex.length;
export const LEVEL_CATALOG_VERSION = catalog.version;

const dailyChallengeKeys: DailyChallengeKey[] = [
  ...catalog.challenges.map((level) => `square:${level.id}` as const),
  ...catalog.dailyHex.map((level) => `hex:${level.id}` as const),
];

function cloneLevel(level: StoredLevel): StoredLevel {
  return {
    ...level,
    cats: level.cats.map((cat) => ({ ...cat })),
    regions: level.regions.map((row) => [...row]),
    palette: createRegionPalette(level.regions, level.cats.length, level.boardType ?? 'square'),
    initialClues: level.initialClues.map((clue) => ({ ...clue })),
    logicRules: [...level.logicRules],
  };
}

export function getMainLevel(index: number): StoredLevel {
  const normalizedIndex = Math.max(0, Math.min(MAIN_LEVEL_COUNT - 1, Math.trunc(index)));
  return cloneLevel(catalog.main[normalizedIndex]);
}

export function isDailyChallengeKey(value: string): value is DailyChallengeKey {
  return dailyChallengeKeys.includes(value as DailyChallengeKey);
}

export function getDailyChallengeKeys(): DailyChallengeKey[] {
  return [...dailyChallengeKeys];
}

export function pickDailyChallengeKey(
  completedKeys: readonly string[],
  random: () => number = Math.random,
): { key: DailyChallengeKey; reset: boolean } {
  const completed = new Set(completedKeys.filter(isDailyChallengeKey));
  let available = dailyChallengeKeys.filter((key) => !completed.has(key));
  const reset = available.length === 0;
  if (reset) available = dailyChallengeKeys;
  const randomValue = Math.max(0, Math.min(0.9999999999999999, random()));
  return { key: available[Math.floor(randomValue * available.length)], reset };
}

export function getDailyChallenge(key: DailyChallengeKey): StoredLevel {
  const [boardType, rawId] = key.split(':');
  const levels = boardType === 'hex' ? catalog.dailyHex : catalog.challenges;
  const level = levels[Number(rawId) - 1];
  if (!level) throw new RangeError(`Unknown daily challenge: ${key}`);
  return cloneLevel(level);
}

export function getHexLevel(index: number): StoredLevel {
  const normalizedIndex = Math.max(0, Math.min(HEX_LEVEL_COUNT - 1, Math.trunc(index)));
  return cloneLevel(catalog.hex[normalizedIndex]);
}

export function levelToPuzzle(level: StoredLevel): Puzzle {
  const cats = level.cats.map((cat) => ({ ...cat }));
  return {
    boardType: level.boardType ?? 'square',
    size: level.size,
    cats,
    catSet: new Set(cats.map(({ row, col }) => `${row},${col}`)),
    regions: level.regions.map((row) => [...row]),
    palette: [...level.palette],
    initialClues: level.initialClues.map((clue) => ({ ...clue })),
  };
}

export function formatLevelNumber(level: number): string {
  return level.toString().padStart(3, '0');
}
