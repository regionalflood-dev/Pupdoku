import {
  createRegionPalette,
  seededRandom,
  type CellState,
  type InitialClue,
  type Position,
  type Puzzle,
} from './game.ts';

const AXIAL_DIRECTIONS = [
  [-1, 0], [1, 0], [0, -1], [0, 1], [-1, 1], [1, -1],
] as const;

const key = ({ row, col }: Position): string => `${row},${col}`;

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function hexCells(sideLength: number): Position[] {
  const radius = sideLength - 1;
  const span = sideLength * 2 - 1;
  const cells: Position[] = [];
  for (let row = 0; row < span; row += 1) {
    for (let col = 0; col < span; col += 1) {
      const q = col - radius;
      const r = row - radius;
      if (Math.abs(q) <= radius && Math.abs(r) <= radius && Math.abs(q + r) <= radius) {
        cells.push({ row, col });
      }
    }
  }
  return cells;
}

export function hexAxes(sideLength: number, cell: Position): [number, number, number] {
  const radius = sideLength - 1;
  const q = cell.col - radius;
  const r = cell.row - radius;
  return [q, r, q + r];
}

export function hexCellsConflict(sideLength: number, left: Position, right: Position): boolean {
  const leftAxes = hexAxes(sideLength, left);
  const rightAxes = hexAxes(sideLength, right);
  return leftAxes.some((value, index) => value === rightAxes[index]);
}

export function areHexNeighbors(sideLength: number, left: Position, right: Position): boolean {
  const [leftQ, leftR] = hexAxes(sideLength, left);
  const [rightQ, rightR] = hexAxes(sideLength, right);
  const qDelta = leftQ - rightQ;
  const rDelta = leftR - rightR;
  return Math.max(Math.abs(qDelta), Math.abs(rDelta), Math.abs(qDelta + rDelta)) === 1;
}

function generateCats(sideLength: number, random: () => number): Position[] {
  const layouts: Record<number, Array<[number, number]>> = {
    5: [[-4, 0], [-3, 1], [-2, -1], [-1, 3], [0, 4], [1, 2], [2, -3], [3, -2], [4, -4]],
    6: [[-5, 0], [-4, 1], [-3, -1], [-2, 2], [-1, 4], [0, 5], [1, 3], [2, -4], [3, -2], [4, -5], [5, -3]],
    7: [[-6, 0], [-5, 1], [-4, -1], [-3, 2], [-2, 3], [-1, 5], [0, 6], [1, 4], [2, -5], [3, -3], [4, -6], [5, -2], [6, -4]],
    8: [[-7, 0], [-6, 1], [-5, -1], [-4, 2], [-3, 3], [-2, 4], [-1, 6], [0, 7], [1, 5], [2, -6], [3, -4], [4, -7], [5, -2], [6, -5], [7, -3]],
    9: [[-8, 0], [-7, 1], [-6, -1], [-5, 2], [-4, 3], [-3, -2], [-2, 6], [-1, 7], [0, 8], [1, 4], [2, 5], [3, -7], [4, -6], [5, -4], [6, -3], [7, -5], [8, -8]],
  };
  const radius = sideLength - 1;
  const rotations = Math.floor(random() * 6);
  const reflected = random() < 0.5;
  return layouts[sideLength].map(([row, col]) => {
    let q = col;
    let r = row;
    if (reflected) [q, r] = [r, q];
    for (let rotation = 0; rotation < rotations; rotation += 1) [q, r] = [-r, q + r];
    return { row: r + radius, col: q + radius };
  });
}

function generateRegions(sideLength: number, cats: readonly Position[], random: () => number): number[][] {
  const span = sideLength * 2 - 1;
  const regions = Array.from({ length: span }, () => Array<number>(span).fill(-1));
  const frontiers = cats.map((cat, region) => {
    regions[cat.row][cat.col] = region;
    return [cat];
  });
  const validCells = hexCells(sideLength);
  const validCellKeys = new Set(validCells.map(key));
  const lockedRegions = new Set<number>();

  const lineRegionCount = sideLength === 5 ? 2 : 1;
  const smallRegionCount = Math.max(3, sideLength - 2);
  const regionOrder = shuffle(cats.map((_, index) => index), random);
  const lineRegions = regionOrder.slice(0, lineRegionCount);
  const smallRegions = regionOrder.slice(lineRegionCount, lineRegionCount + smallRegionCount);

  for (const [lineIndex, region] of lineRegions.entries()) {
    const cat = cats[region];
    const targetSize = sideLength === 5 ? 4 + lineIndex : 3;
    const catAxes = hexAxes(sideLength, cat);
    const segments: Position[][] = [];
    for (const axis of shuffle([0, 1, 2], random)) {
      const line = validCells
        .filter((cell) => hexAxes(sideLength, cell)[axis] === catAxes[axis])
        .sort((left, right) => left.row - right.row || left.col - right.col);
      const catIndex = line.findIndex((cell) => key(cell) === key(cat));
      for (let start = Math.max(0, catIndex - targetSize + 1);
        start <= Math.min(catIndex, line.length - targetSize); start += 1) {
        const segment = line.slice(start, start + targetSize);
        if (segment.every((cell) => regions[cell.row][cell.col] === -1 || key(cell) === key(cat))) {
          segments.push(segment);
        }
      }
    }
    const segment = shuffle(segments, random)[0];
    if (!segment) throw new Error('Unable to reserve an obvious axial color region');
    frontiers[region] = segment;
    segment.forEach((cell) => { regions[cell.row][cell.col] = region; });
    lockedRegions.add(region);
  }

  const smallSizes = Array.from({ length: smallRegionCount }, (_, index) =>
    sideLength === 5 && index > 0 ? index + 1 : 1);
  for (const [smallIndex, region] of smallRegions.entries()) {
    const targetSize = smallSizes[smallIndex];
    while (frontiers[region].length < targetSize) {
      const options = frontiers[region].flatMap((cell) => AXIAL_DIRECTIONS.flatMap(([rowDelta, colDelta]) => {
        const next = { row: cell.row + rowDelta, col: cell.col + colDelta };
        return regions[next.row]?.[next.col] === -1 && validCellKeys.has(key(next)) ? [next] : [];
      }));
      const next = shuffle(options, random)[0];
      if (!next) throw new Error('Unable to reserve a small color region');
      regions[next.row][next.col] = region;
      frontiers[region].push(next);
    }
    lockedRegions.add(region);
  }

  let remaining = validCells.filter((cell) => regions[cell.row][cell.col] === -1).length;

  while (remaining > 0) {
    let changed = false;
    for (const region of shuffle(cats.map((_, index) => index), random)) {
      if (lockedRegions.has(region)) continue;
      const options: Position[] = [];
      for (const cell of frontiers[region]) {
        for (const [rowDelta, colDelta] of AXIAL_DIRECTIONS) {
          const row = cell.row + rowDelta;
          const col = cell.col + colDelta;
          if (regions[row]?.[col] === -1 && validCellKeys.has(`${row},${col}`)) {
            options.push({ row, col });
          }
        }
      }
      if (options.length === 0) continue;
      const next = options[Math.floor(random() * options.length)];
      regions[next.row][next.col] = region;
      frontiers[region].push(next);
      remaining -= 1;
      changed = true;
      if (remaining === 0) break;
    }
    if (!changed) throw new Error('Unable to grow all hex color regions');
  }
  return regions;
}

function solveHex(
  puzzle: Puzzle,
  clues: readonly InitialClue[],
  limit: number,
  excluded?: ReadonlySet<string>,
): Position[][] {
  const blocked = new Set(clues.filter((clue) => clue.state === 'marked').map(key));
  const forced = new Map(clues.filter((clue) => clue.state === 'cat')
    .map((clue) => [puzzle.regions[clue.row]?.[clue.col], clue] as const));
  const candidates = Array.from({ length: puzzle.cats.length }, (_, region) => {
    const forcedCell = forced.get(region);
    return hexCells(puzzle.size).filter((cell) => puzzle.regions[cell.row][cell.col] === region
      && !blocked.has(key(cell)) && (!forcedCell || key(forcedCell) === key(cell)));
  });
  if (candidates.some((cells) => cells.length === 0)) return [];

  const solutions: Position[][] = [];
  const selected = new Map<number, Position>();
  const usedAxes = [new Set<number>(), new Set<number>(), new Set<number>()];

  const search = (): void => {
    if (solutions.length >= limit) return;
    if (selected.size === candidates.length) {
      const solution = [...selected.entries()].sort(([left], [right]) => left - right).map(([, cell]) => cell);
      if (!excluded || solution.some((cell) => !excluded.has(key(cell)))) solutions.push(solution);
      return;
    }

    let nextRegion = -1;
    let options: Position[] = [];
    for (let region = 0; region < candidates.length; region += 1) {
      if (selected.has(region)) continue;
      const available = candidates[region].filter((cell) => {
        const values = hexAxes(puzzle.size, cell);
        return values.every((value, index) => !usedAxes[index].has(value));
      });
      if (nextRegion < 0 || available.length < options.length) {
        nextRegion = region;
        options = available;
      }
    }
    for (const cell of options) {
      const values = hexAxes(puzzle.size, cell);
      selected.set(nextRegion, cell);
      values.forEach((value, index) => usedAxes[index].add(value));
      search();
      values.forEach((value, index) => usedAxes[index].delete(value));
      selected.delete(nextRegion);
      if (solutions.length >= limit) return;
    }
  };

  search();
  return solutions;
}

export function findHexPuzzleSolutions(
  puzzle: Puzzle,
  clues: readonly InitialClue[] = puzzle.initialClues,
  limit = 2,
): Position[][] {
  return solveHex(puzzle, clues, limit);
}

export function createHexPuzzle(sideLength: number, seed = Date.now()): Puzzle {
  if (!Number.isInteger(sideLength) || sideLength < 5 || sideLength > 9) {
    throw new RangeError('Hex side length must be an integer between 5 and 9');
  }
  const random = seededRandom(seed);
  const cats = generateCats(sideLength, random);
  for (let attempt = 0; attempt < 32; attempt += 1) {
    try {
      const regions = generateRegions(sideLength, cats, random);
      const palette = createRegionPalette(regions, cats.length, 'hex');
      const puzzle: Puzzle = {
        boardType: 'hex',
        size: sideLength,
        cats,
        catSet: new Set(cats.map(key)),
        regions,
        palette,
        initialClues: [],
      };
      const solutions = findHexPuzzleSolutions(puzzle, [], 2);
      if (solutions.length === 1 && solutions[0].every((cat) => puzzle.catSet.has(key(cat)))) return puzzle;
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith('Unable to')) throw error;
    }
  }
  throw new Error('Unable to generate a clue-free unique hex puzzle after 32 attempts');
}

export function findHexLogicHints(
  puzzle: Puzzle,
  states: readonly (readonly CellState[])[],
): Array<Position & { action: 'cat' | 'empty'; rule: 'base' | 0; reason: string }> {
  const foundCats = puzzle.cats.filter(({ row, col }) => states[row]?.[col] === 'cat');
  for (const cat of foundCats) {
    const region = puzzle.regions[cat.row][cat.col];
    const blocked = hexCells(puzzle.size).find((cell) => states[cell.row]?.[cell.col] === 'hidden'
      && (puzzle.regions[cell.row][cell.col] === region || hexCellsConflict(puzzle.size, cat, cell)));
    if (blocked) return [{ ...blocked, action: 'empty', rule: 'base', reason: 'The revealed Ciri Pups rules out hexs sharing the same color or axis line' }];
  }

  const clues: InitialClue[] = [];
  hexCells(puzzle.size).forEach((cell) => {
    const state = states[cell.row]?.[cell.col];
    if (state === 'marked' || state === 'cat') clues.push({ ...cell, state });
  });
  const solution = findHexPuzzleSolutions(puzzle, clues, 2);
  if (solution.length !== 1) return [];
  const cat = solution[0].find((cell) => states[cell.row]?.[cell.col] === 'hidden');
  return cat ? [{ ...cat, action: 'cat', rule: 0, reason: 'Combining the color and three-axis rules, there is a Ciri Pup here' }] : [];
}
