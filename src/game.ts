export type Position = { row: number; col: number };
export type CellState = 'hidden' | 'marked' | 'cat';
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface InitialClue extends Position {
  state: Extract<CellState, 'marked' | 'cat'>;
}

export interface Puzzle {
  size: number;
  cats: Position[];
  catSet: Set<string>;
  regions: number[][];
  palette: string[];
  initialClues: InitialClue[];
}

export interface LevelConfig {
  size: number;
  difficulty: Difficulty;
  targetSeconds: number;
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

const LAYOUT_SEARCH_ATTEMPTS: Record<number, number> = {
  5: 32,
  6: 40,
  7: 48,
  8: 56,
  9: 64,
};

type ColumnSolution = number[];

interface PuzzleCandidate {
  cats: Position[];
  regions: number[][];
  clues: InitialClue[];
  solutionCount: number;
}

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

  if (!solve(0)) throw new Error(`Unable to generate non-touching cats for a ${size}x${size} puzzle`);
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
    if (!changed) throw new Error('Unable to grow all color regions');
  }
  return regions;
}

function findSolutionColumns(
  regions: number[][],
  clues: readonly InitialClue[],
  limit = Number.POSITIVE_INFINITY,
): ColumnSolution[] {
  const size = regions.length;
  if (limit <= 0 || regions.some((row) => row.length !== size)) return [];

  const forcedColumns = Array<number | undefined>(size).fill(undefined);
  const blockedColumns = Array<number>(size).fill(0);

  for (const clue of clues) {
    if (!Number.isInteger(clue.row) || !Number.isInteger(clue.col)
      || clue.row < 0 || clue.row >= size || clue.col < 0 || clue.col >= size) return [];

    if (clue.state === 'cat') {
      const forced = forcedColumns[clue.row];
      if (forced !== undefined && forced !== clue.col) return [];
      forcedColumns[clue.row] = clue.col;
    } else {
      blockedColumns[clue.row] |= 1 << clue.col;
    }
  }

  if (forcedColumns.some((col, row) => col !== undefined && (blockedColumns[row] & (1 << col)) !== 0)) return [];

  const solutions: ColumnSolution[] = [];
  const columns: number[] = [];

  // One cat per row reduces touching checks to the selected column in the previous row.
  const solve = (row: number, usedColumns: number, usedRegions: number, previousColumn: number): void => {
    if (solutions.length >= limit) return;
    if (row === size) {
      solutions.push([...columns]);
      return;
    }

    for (let col = 0; col < size; col += 1) {
      if (forcedColumns[row] !== undefined && forcedColumns[row] !== col) continue;
      const region = regions[row][col];
      if (!Number.isInteger(region) || region < 0 || region >= size) continue;

      const columnBit = 1 << col;
      const regionBit = 1 << region;
      if ((usedColumns & columnBit) !== 0
        || (usedRegions & regionBit) !== 0
        || (blockedColumns[row] & columnBit) !== 0
        || (row > 0 && Math.abs(previousColumn - col) <= 1)) continue;

      columns.push(col);
      solve(row + 1, usedColumns | columnBit, usedRegions | regionBit, col);
      columns.pop();
      if (solutions.length >= limit) return;
    }
  };

  solve(0, 0, 0, -size);
  return solutions;
}

const matchesTarget = (solution: ColumnSolution, target: ColumnSolution): boolean =>
  solution.every((col, row) => col === target[row]);

function createUniquenessClues(
  size: number,
  target: ColumnSolution,
  solutions: ColumnSolution[],
  random: () => number,
): InitialClue[] {
  if (!solutions.some((solution) => matchesTarget(solution, target))) {
    throw new Error('Generated cat positions are not a solution to their color layout');
  }

  const allAlternatives = solutions.filter((solution) => !matchesTarget(solution, target));
  let alternatives = allAlternatives;
  const availableCells = shuffle(
    Array.from({ length: size * size }, (_, index) => ({
      row: Math.floor(index / size),
      col: index % size,
    })).filter(({ row, col }) => target[row] !== col),
    random,
  );
  const clues: InitialClue[] = [];

  // Each marked cell removes every alternate solution that places a cat there.
  while (alternatives.length > 0) {
    const catFrequency = Array<number>(size * size).fill(0);
    alternatives.forEach((solution) => {
      solution.forEach((col, row) => {
        catFrequency[row * size + col] += 1;
      });
    });
    let bestIndex = -1;
    let mostEliminated = 0;

    availableCells.forEach(({ row, col }, index) => {
      const eliminated = catFrequency[row * size + col];
      if (eliminated > mostEliminated) {
        bestIndex = index;
        mostEliminated = eliminated;
      }
    });

    if (bestIndex < 0) throw new Error('Unable to distinguish the target from an alternate solution');
    const [{ row, col }] = availableCells.splice(bestIndex, 1);
    clues.push({ row, col, state: 'marked' });
    alternatives = alternatives.filter((solution) => solution[row] !== col);
  }

  for (let index = clues.length - 1; index >= 0; index -= 1) {
    const remainingClues = clues.filter((_, clueIndex) => clueIndex !== index);
    const stillUnique = !allAlternatives.some((solution) =>
      remainingClues.every(({ row, col }) => solution[row] !== col));
    if (stillUnique) clues.splice(index, 1);
  }

  return clues;
}

function addHelpfulClue(
  clues: InitialClue[],
  target: ColumnSolution,
  random: () => number,
): InitialClue[] {
  if (clues.length > 0) return clues;
  const emptyCells = Array.from({ length: target.length * target.length }, (_, index) => ({
    row: Math.floor(index / target.length),
    col: index % target.length,
  })).filter(({ row, col }) => target[row] !== col);
  const { row, col } = emptyCells[Math.floor(random() * emptyCells.length)];
  return [{ row, col, state: 'marked' }];
}

export function createPuzzle(size: number, seed = Date.now()): Puzzle {
  if (!Number.isInteger(size) || size < 5 || size > PALETTES[0].length) {
    throw new RangeError(`Puzzle size must be an integer between 5 and ${PALETTES[0].length}`);
  }

  const random = seededRandom(seed);
  const attempts = LAYOUT_SEARCH_ATTEMPTS[size] ?? size * 8;
  let best: PuzzleCandidate | undefined;

  // Prefer connected color layouts that need the fewest fixed marks to become unique.
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const cats = generateCats(size, random);
    const regions = generateRegions(size, cats, random);
    const target = cats.map(({ col }) => col);
    const solutions = findSolutionColumns(regions, []);
    const clues = createUniquenessClues(size, target, solutions, random);
    const candidate = { cats, regions, clues, solutionCount: solutions.length };

    if (!best
      || candidate.clues.length < best.clues.length
      || (candidate.clues.length === best.clues.length && candidate.solutionCount < best.solutionCount)) {
      best = candidate;
    }
    if (candidate.clues.length === 0) break;
  }

  if (!best) throw new Error('Unable to generate a puzzle candidate');
  const target = best.cats.map(({ col }) => col);
  const initialClues = addHelpfulClue(best.clues, target, random);
  const puzzle: Puzzle = {
    size,
    cats: best.cats,
    catSet: new Set(best.cats.map(({ row, col }) => key(row, col))),
    regions: best.regions,
    palette: shuffle(PALETTES[Math.floor(random() * PALETTES.length)], random).slice(0, size),
    initialClues,
  };

  const verifiedSolutions = findSolutionColumns(puzzle.regions, puzzle.initialClues, 2);
  if (verifiedSolutions.length !== 1 || !matchesTarget(verifiedSolutions[0], target)) {
    throw new Error('Generated puzzle failed its final unique-solution check');
  }
  return puzzle;
}

export function hasCat(puzzle: Puzzle, row: number, col: number): boolean {
  return puzzle.catSet.has(key(row, col));
}

export function findPuzzleSolutions(
  puzzle: Puzzle,
  clues: readonly InitialClue[] = puzzle.initialClues,
  limit = 2,
): Position[][] {
  return findSolutionColumns(puzzle.regions, clues, limit).map((solution) =>
    solution.map((col, row) => ({ row, col })));
}

export function createInitialClues(puzzle: Puzzle): InitialClue[] {
  return puzzle.initialClues.map((clue) => ({ ...clue }));
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
