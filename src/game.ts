export type Position = { row: number; col: number };
export type CellState = 'hidden' | 'marked' | 'cat';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type BoardType = 'square' | 'hex';

export interface InitialClue extends Position {
  state: Extract<CellState, 'marked' | 'cat'>;
}

export interface Puzzle {
  boardType: BoardType;
  size: number;
  cats: Position[];
  catSet: Set<string>;
  regions: number[][];
  palette: string[];
  initialClues: InitialClue[];
}

export function puzzleSpan(puzzle: Pick<Puzzle, 'boardType' | 'size'>): number {
  return puzzle.boardType === 'hex' ? puzzle.size * 2 - 1 : puzzle.size;
}

export function puzzleCellCount(puzzle: Pick<Puzzle, 'regions'>): number {
  return puzzle.regions.reduce(
    (total, row) => total + row.filter((region) => region >= 0).length,
    0,
  );
}

// Ordered for categorical contrast rather than a soft tonal match. The assignment
// below also keeps the closest colors away from neighboring regions.
const REGION_COLORS = [
  '#d83a56', '#2e9b50', '#f2c80f', '#3d5ad6', '#e97720',
  '#7b2cbf', '#19afc5', '#ce3bc8', '#9abb24', '#eba6c2',
  '#298c84', '#c7a6e8', '#8a5723', '#f0e6a2', '#6e1d2b',
  '#00e5ff', '#ff007f',
];

function colorDistance(left: string, right: string): number {
  const channels = (color: string): number[] => [1, 3, 5]
    .map((index) => Number.parseInt(color.slice(index, index + 2), 16));
  const leftChannels = channels(left);
  const rightChannels = channels(right);
  return Math.hypot(...leftChannels.map((value, index) => value - rightChannels[index]));
}

export function createRegionPalette(
  regions: readonly (readonly number[])[],
  regionCount: number,
  boardType: BoardType = 'square',
): string[] {
  if (!Number.isInteger(regionCount) || regionCount < 1 || regionCount > REGION_COLORS.length) {
    throw new RangeError(`Region count must be between 1 and ${REGION_COLORS.length}`);
  }

  const neighbors = Array.from({ length: regionCount }, () => new Set<number>());
  const directions = boardType === 'hex' ? [[0, 1], [1, -1], [1, 0]] : [[0, 1], [1, 0]];
  regions.forEach((row, rowIndex) => row.forEach((region, colIndex) => {
    if (region < 0 || region >= regionCount) return;
    directions.forEach(([rowDelta, colDelta]) => {
      const other = regions[rowIndex + rowDelta]?.[colIndex + colDelta];
      if (other === undefined || other < 0 || other >= regionCount || other === region) return;
      neighbors[region].add(other);
      neighbors[other].add(region);
    });
  }));

  const palette = Array<string>(regionCount);
  const assign = (minimumDistance: number, unused: Set<string>): boolean => {
    if (unused.size === REGION_COLORS.length - regionCount) return true;
    const unassigned = Array.from({ length: regionCount }, (_, region) => region)
      .filter((region) => !palette[region]);
    unassigned.sort((left, right) => {
      const assignedNeighborCount = (region: number): number =>
        [...neighbors[region]].filter((neighbor) => palette[neighbor]).length;
      return assignedNeighborCount(right) - assignedNeighborCount(left)
        || neighbors[right].size - neighbors[left].size
        || left - right;
    });
    const region = unassigned[0];
    const adjacentColors = [...neighbors[region]].flatMap((neighbor) => palette[neighbor] ? [palette[neighbor]] : []);
    const candidates = [...unused]
      .filter((color) => adjacentColors.every((other) => colorDistance(color, other) >= minimumDistance))
      .sort((left, right) => {
        const score = (color: string): number => adjacentColors.length === 0
          ? 0
          : Math.min(...adjacentColors.map((other) => colorDistance(color, other)));
        return score(right) - score(left) || REGION_COLORS.indexOf(left) - REGION_COLORS.indexOf(right);
      });

    for (const color of candidates) {
      palette[region] = color;
      unused.delete(color);
      if (assign(minimumDistance, unused)) return true;
      unused.add(color);
      palette[region] = '';
    }
    return false;
  };

  if (assign(100, new Set(REGION_COLORS))) return palette;
  throw new Error('Unable to assign distinct colors to neighboring regions');
}

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
  const singletonRegions = new Set(shuffle(
    Array.from({ length: size }, (_, index) => index),
    random,
  ).slice(0, Math.max(1, size - 4)));
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
      if (singletonRegions.has(region)) continue;
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

export function createPuzzle(size: number, seed = Date.now()): Puzzle {
  if (!Number.isInteger(size) || size < 5 || size > 9) {
    throw new RangeError('Puzzle size must be an integer between 5 and 9');
  }

  const random = seededRandom(seed);
  const attempts = LAYOUT_SEARCH_ATTEMPTS[size] ?? size * 8;
  let candidate: PuzzleCandidate | undefined;

  // Starting clues are intentionally forbidden, so only accept a layout that is unique by itself.
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const cats = generateCats(size, random);
    const regions = generateRegions(size, cats, random);
    const target = cats.map(({ col }) => col);
    const solutions = findSolutionColumns(regions, [], 2);
    if (solutions.length === 1 && matchesTarget(solutions[0], target)) {
      candidate = { cats, regions };
      break;
    }
  }

  if (!candidate) throw new Error('Unable to generate a clue-free unique puzzle');
  const target = candidate.cats.map(({ col }) => col);
  const puzzle: Puzzle = {
    boardType: 'square',
    size,
    cats: candidate.cats,
    catSet: new Set(candidate.cats.map(({ row, col }) => key(row, col))),
    regions: candidate.regions,
    palette: createRegionPalette(candidate.regions, size, 'square'),
    initialClues: [],
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

export interface StarRating {
  stars: number;
  colorful: boolean;
}

export function calculateStarRating(seconds: number, mistakes: number): StarRating {
  if (mistakes >= 3) return { stars: 0, colorful: false };
  if (mistakes >= 2) return { stars: 1, colorful: false };
  if (mistakes === 1 || seconds > 180) return { stars: 2, colorful: false };
  return { stars: 3, colorful: seconds <= 120 };
}

export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}
