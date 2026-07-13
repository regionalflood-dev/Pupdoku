export type Position = { row: number; col: number };
export type CellState = 'hidden' | 'marked' | 'cat';
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface Puzzle {
  size: number;
  cats: Position[];
  catSet: Set<string>;
  regions: number[][];
  palette: string[];
}

export interface LevelConfig {
  size: number;
  difficulty: Difficulty;
  targetSeconds: number;
}

export interface InitialClue extends Position {
  state: Extract<CellState, 'marked' | 'cat'>;
}

export const LEVELS: LevelConfig[] = [
  { size: 5, difficulty: 'easy', targetSeconds: 55 },
  { size: 5, difficulty: 'easy', targetSeconds: 48 },
  { size: 6, difficulty: 'normal', targetSeconds: 70 },
  { size: 6, difficulty: 'normal', targetSeconds: 62 },
  { size: 7, difficulty: 'hard', targetSeconds: 86 },
  { size: 6, difficulty: 'easy', targetSeconds: 65 },
  { size: 6, difficulty: 'easy', targetSeconds: 58 },
  { size: 7, difficulty: 'normal', targetSeconds: 82 },
  { size: 8, difficulty: 'normal', targetSeconds: 100 },
  { size: 9, difficulty: 'hard', targetSeconds: 120 },
];

const PALETTES = [
  ['#ffd6cf', '#ffe29d', '#cbeebc', '#bde9ef', '#d9cff6', '#ffcfe5', '#cce0ff', '#ead7bb', '#e5efb8'],
  ['#ffcabf', '#ffe0a8', '#c4e7cf', '#c4e9fa', '#dfd0f1', '#f9c7dc', '#d5d7ff', '#f2d2b6', '#daf0b5'],
  ['#ffcfc4', '#f9dea5', '#bdeac9', '#b9e2ee', '#d8cdf5', '#f9cee2', '#cfddfa', '#ebd2b5', '#deedb8'],
];

const key = (row: number, col: number) => `${row},${col}`;
const shuffle = <T>(items: T[], random: () => number): T[] => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

export function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function generateCats(size: number, random: () => number): Position[] {
  const columns = Array.from({ length: size }, (_, index) => index);
  const solution: number[] = [];

  const solve = (row: number): boolean => {
    if (row === size) return true;
    const candidates = shuffle(columns.filter((col) => !solution.includes(col)), random);
    for (const col of candidates) {
      if (row > 0 && Math.abs(solution[row - 1] - col) <= 1) continue;
      solution.push(col);
      if (solve(row + 1)) return true;
      solution.pop();
    }
    return false;
  };

  if (!solve(0)) return generateCats(size, random);
  return solution.map((col, row) => ({ row, col }));
}

function generateRegions(size: number, cats: Position[], random: () => number): number[][] {
  const regions = Array.from({ length: size }, () => Array<number>(size).fill(-1));
  const singletonRegion = Math.floor(random() * size);
  const frontiers: Position[][] = cats.map(({ row, col }, region) => {
    regions[row][col] = region;
    return [{ row, col }];
  });
  let remaining = size * size - size;
  const directions = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
  ];

  while (remaining > 0) {
    const expandable = shuffle(Array.from({ length: size }, (_, index) => index), random);
    let changed = false;
    for (const region of expandable) {
      if (region === singletonRegion) continue;
      const candidates: Position[] = [];
      for (const cell of frontiers[region]) {
        for (const [rowDelta, colDelta] of directions) {
          const row = cell.row + rowDelta;
          const col = cell.col + colDelta;
          if (row >= 0 && row < size && col >= 0 && col < size && regions[row][col] === -1) {
            candidates.push({ row, col });
          }
        }
      }
      if (candidates.length === 0) continue;
      const next = candidates[Math.floor(random() * candidates.length)];
      regions[next.row][next.col] = region;
      frontiers[region].push(next);
      remaining -= 1;
      changed = true;
      if (remaining === 0) break;
    }
    if (!changed) break;
  }
  return regions;
}

export function createPuzzle(size: number, seed = Date.now()): Puzzle {
  const random = seededRandom(seed);
  const cats = generateCats(size, random);
  return {
    size,
    cats,
    catSet: new Set(cats.map(({ row, col }) => key(row, col))),
    regions: generateRegions(size, cats, random),
    palette: shuffle(PALETTES[Math.floor(random() * PALETTES.length)], random).slice(0, size),
  };
}

export function hasCat(puzzle: Puzzle, row: number, col: number): boolean {
  return puzzle.catSet.has(key(row, col));
}

export function createInitialClues(puzzle: Puzzle, random: () => number = Math.random): InitialClue[] {
  const clueCount = random() < 0.5 ? 1 : 2;
  const positions = shuffle(
    Array.from({ length: puzzle.size * puzzle.size }, (_, index) => ({
      row: Math.floor(index / puzzle.size),
      col: index % puzzle.size,
    })),
    random,
  );

  return positions.slice(0, clueCount).map(({ row, col }) => ({
    row,
    col,
    state: hasCat(puzzle, row, col) ? 'cat' : 'marked',
  }));
}

export function calculateStars(seconds: number, mistakes: number, targetSeconds: number): number {
  if (mistakes === 0 && seconds <= targetSeconds) return 3;
  if (mistakes <= 1 && seconds <= targetSeconds * 1.65) return 2;
  return 1;
}

export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}
