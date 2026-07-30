import generatedLevels from './levels.generated.json';
import type { BoardType, Difficulty, InitialClue, Position, Puzzle } from './game';
import type { LogicRule } from './logic';

export type GameMode = 'main' | 'daily' | 'hex';

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
  hex: StoredLevel[];
}

const catalog = generatedLevels as LevelCatalog;

export const MAIN_LEVEL_COUNT = catalog.main.length;
export const CHALLENGE_LEVEL_COUNT = catalog.challenges.length;
export const HEX_LEVEL_COUNT = catalog.hex.length;
export const LEVEL_CATALOG_VERSION = catalog.version;

function cloneLevel(level: StoredLevel): StoredLevel {
  return {
    ...level,
    cats: level.cats.map((cat) => ({ ...cat })),
    regions: level.regions.map((row) => [...row]),
    palette: [...level.palette],
    initialClues: level.initialClues.map((clue) => ({ ...clue })),
    logicRules: [...level.logicRules],
  };
}

export function getMainLevel(index: number): StoredLevel {
  const normalizedIndex = Math.max(0, Math.min(MAIN_LEVEL_COUNT - 1, Math.trunc(index)));
  return cloneLevel(catalog.main[normalizedIndex]);
}

export function getDailyChallengeIndex(date = new Date()): number {
  const localDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor(localDay / 86_400_000) % CHALLENGE_LEVEL_COUNT;
}

export function getDailyChallenge(date = new Date()): StoredLevel {
  return cloneLevel(catalog.challenges[getDailyChallengeIndex(date)]);
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
