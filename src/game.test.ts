import { describe, expect, it } from 'vitest';
import {
  calculateStars,
  createInitialClues,
  createPuzzle,
  findPuzzleSolutions,
  hasCat,
  type CellState,
  type InitialClue,
  type Position,
  type Puzzle,
} from './game';
import { findLogicHints, solvePuzzleLogically } from './logic';
import { areHexNeighbors, createHexPuzzle, findHexPuzzleSolutions, hexAxes, hexCells, hexCellsConflict } from './hex';
import {
  CHALLENGE_LEVEL_COUNT,
  getDailyChallenge,
  getDailyChallengeIndex,
  getHexLevel,
  getMainLevel,
  levelToPuzzle,
  MAIN_LEVEL_COUNT,
  HEX_LEVEL_COUNT,
} from './levels';

const columns = (positions: Position[]): number[] =>
  [...positions].sort((left, right) => left.row - right.row).map(({ col }) => col);

function expectConnectedRegions(puzzle: Puzzle): void {
  for (let region = 0; region < puzzle.size; region += 1) {
    const cells = puzzle.regions.flatMap((row, rowIndex) =>
      row.flatMap((value, col) => value === region ? [{ row: rowIndex, col }] : []));
    expect(cells.length).toBeGreaterThan(0);

    const remaining = new Set(cells.map(({ row, col }) => `${row},${col}`));
    const pending = [cells[0]];
    remaining.delete(`${cells[0].row},${cells[0].col}`);
    while (pending.length > 0) {
      const cell = pending.pop()!;
      for (const [rowDelta, colDelta] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const next = `${cell.row + rowDelta},${cell.col + colDelta}`;
        if (remaining.delete(next)) pending.push({ row: cell.row + rowDelta, col: cell.col + colDelta });
      }
    }
    expect(remaining.size).toBe(0);
  }
}

function fixturePuzzle(regions: number[][], catColumns: number[]): Puzzle {
  const cats = catColumns.map((col, row) => ({ row, col }));
  return {
    boardType: 'square',
    size: regions.length,
    cats,
    catSet: new Set(cats.map(({ row, col }) => `${row},${col}`)),
    regions,
    palette: Array.from({ length: regions.length }, () => '#ffffff'),
    initialClues: [],
  };
}

function findSolutionsIndependently(
  puzzle: Puzzle,
  clues: readonly InitialClue[],
  limit = 2,
): number[][] {
  const forcedColumns = Array<number | undefined>(puzzle.size).fill(undefined);
  const blocked = new Set<string>();
  clues.forEach(({ row, col, state }) => {
    if (state === 'cat') forcedColumns[row] = col;
    else blocked.add(`${row},${col}`);
  });

  const solutions: number[][] = [];
  const columns: number[] = [];
  const search = (row: number, usedColumns: Set<number>, usedRegions: Set<number>): void => {
    if (solutions.length >= limit) return;
    if (row === puzzle.size) {
      solutions.push([...columns]);
      return;
    }

    for (let col = 0; col < puzzle.size; col += 1) {
      const region = puzzle.regions[row][col];
      if (forcedColumns[row] !== undefined && forcedColumns[row] !== col) continue;
      if (blocked.has(`${row},${col}`) || usedColumns.has(col) || usedRegions.has(region)) continue;
      if (row > 0 && Math.abs(columns[row - 1] - col) <= 1) continue;

      columns.push(col);
      usedColumns.add(col);
      usedRegions.add(region);
      search(row + 1, usedColumns, usedRegions);
      usedColumns.delete(col);
      usedRegions.delete(region);
      columns.pop();
    }
  };

  search(0, new Set(), new Set());
  return solutions;
}

describe('puzzle generation', () => {
  for (const size of [5, 6, 7, 8, 9]) {
    it(`creates a valid ${size}x${size} puzzle`, () => {
      const puzzle = createPuzzle(size, size * 12345);
      expect(puzzle.cats).toHaveLength(size);
      expect(new Set(puzzle.cats.map((cat) => cat.row)).size).toBe(size);
      expect(new Set(puzzle.cats.map((cat) => cat.col)).size).toBe(size);
      for (let index = 1; index < puzzle.cats.length; index += 1) {
        expect(Math.abs(puzzle.cats[index].col - puzzle.cats[index - 1].col)).toBeGreaterThan(1);
      }
      for (let region = 0; region < size; region += 1) {
        expect(puzzle.cats.filter((cat) => puzzle.regions[cat.row][cat.col] === region)).toHaveLength(1);
        expect(puzzle.regions.flat().filter((value) => value === region).length).toBeGreaterThan(0);
      }
      const regionSizes = Array.from({ length: size }, (_, region) =>
        puzzle.regions.flat().filter((value) => value === region).length,
      );
      expect(regionSizes).toContain(1);
      expect(puzzle.regions.flat().every((region) => Number.isInteger(region) && region >= 0 && region < size)).toBe(true);
      expectConnectedRegions(puzzle);

      const solutions = findPuzzleSolutions(puzzle);
      expect(solutions).toHaveLength(1);
      expect(columns(solutions[0])).toEqual(columns(puzzle.cats));
      expect(findSolutionsIndependently(puzzle, puzzle.initialClues)).toEqual([columns(puzzle.cats)]);
    });
  }

  it('reproduces the complete playable puzzle from the same seed', () => {
    const first = createPuzzle(9, 987654321);
    const second = createPuzzle(9, 987654321);
    expect(first.cats).toEqual(second.cats);
    expect(first.regions).toEqual(second.regions);
    expect(first.palette).toEqual(second.palette);
    expect(first.initialClues).toEqual(second.initialClues);
  });

  it('distinguishes zero, one, and multiple-solution clue sets', () => {
    const puzzle = fixturePuzzle([
      [1, 1, 1, 0, 0],
      [1, 1, 1, 1, 0],
      [2, 4, 3, 0, 0],
      [4, 4, 3, 3, 3],
      [4, 4, 4, 3, 3],
    ], [4, 2, 0, 3, 1]);
    const catClue: InitialClue = { row: 2, col: 0, state: 'cat' };

    expect(findPuzzleSolutions(puzzle, [catClue], 3).map(columns)).toEqual([
      [2, 4, 0, 3, 1],
      [4, 2, 0, 3, 1],
    ]);
    expect(findPuzzleSolutions(puzzle, [catClue, { row: 0, col: 2, state: 'marked' }], 2).map(columns)).toEqual([
      [4, 2, 0, 3, 1],
    ]);
    expect(findPuzzleSolutions(puzzle, [
      { row: 0, col: 4, state: 'cat' },
      { row: 1, col: 3, state: 'cat' },
    ], 2)).toHaveLength(0);
  });
});

describe('star rating', () => {
  it('rewards fast flawless solves', () => expect(calculateStars(40, 0, 60)).toBe(3));
  it('gives two stars for a small miss', () => expect(calculateStars(70, 1, 60)).toBe(2));
  it('always gives one star after completion', () => expect(calculateStars(300, 2, 60)).toBe(1));
});

describe('initial clues', () => {
  it('returns deterministic, immutable truth values that make the puzzle unique', () => {
    for (const size of [5, 6, 7, 8, 9]) {
      const puzzle = createPuzzle(size, size * 24680);
      const clues = createInitialClues(puzzle);
      expect(clues.length).toBeGreaterThanOrEqual(1);
      expect(new Set(clues.map(({ row, col }) => `${row},${col}`)).size).toBe(clues.length);
      clues.forEach(({ row, col, state }) => {
        expect(state).toBe('marked');
        expect(puzzle.catSet.has(`${row},${col}`)).toBe(false);
      });
      expect(findPuzzleSolutions(puzzle, clues, 2)).toHaveLength(1);
      expect(createInitialClues(puzzle)).toEqual(clues);
      expect(createInitialClues(puzzle)).not.toBe(clues);
    }
  });
});

describe('precomputed level catalog', () => {
  it('contains 1000 main levels and 200 complex challenges', () => {
    expect(MAIN_LEVEL_COUNT).toBe(1000);
    expect(CHALLENGE_LEVEL_COUNT).toBe(200);
  });

  it('keeps every main level unique and solvable with rules 0-4', () => {
    for (let index = 0; index < MAIN_LEVEL_COUNT; index += 1) {
      const level = getMainLevel(index);
      const puzzle = levelToPuzzle(level);
      expect(findPuzzleSolutions(puzzle, puzzle.initialClues, 2).map(columns)).toEqual([columns(puzzle.cats)]);
      const report = solvePuzzleLogically(puzzle);
      expect(report.solved, `main level ${level.id}`).toBe(true);
      expect(report.rulesUsed.every((rule) => rule === 'base' || [0, 1, 2, 3, 4].includes(rule))).toBe(true);
    }
  }, 20_000);

  it('keeps every challenge unique, logically solvable, and dependent on rule 4', () => {
    for (let index = 0; index < CHALLENGE_LEVEL_COUNT; index += 1) {
      const level = getDailyChallenge(new Date(2026, 0, index + 1));
      const puzzle = levelToPuzzle(level);
      expect(findPuzzleSolutions(puzzle, puzzle.initialClues, 2).map(columns)).toEqual([columns(puzzle.cats)]);
      const report = solvePuzzleLogically(puzzle);
      expect(report.solved, `challenge ${level.id}`).toBe(true);
      expect(report.rulesUsed).toContain(4);
      expect(report.steps).toBeGreaterThanOrEqual(58);
    }
  }, 20_000);

  it('returns defensive copies and a stable daily selection', () => {
    const first = getMainLevel(0);
    first.regions[0][0] = -1;
    expect(getMainLevel(0).regions[0][0]).not.toBe(-1);

    const morning = new Date(2026, 6, 22, 8, 0);
    const evening = new Date(2026, 6, 22, 22, 0);
    expect(getDailyChallengeIndex(morning)).toBe(getDailyChallengeIndex(evening));
    expect(getDailyChallenge(morning)).toEqual(getDailyChallenge(evening));
  });
});

describe('hex puzzle mode', () => {
  const obviousRegions = (puzzle: Puzzle): { small: number; axial: number } => {
    const regions = Array.from({ length: puzzle.cats.length }, (_, region) =>
      hexCells(puzzle.size).filter((cell) => puzzle.regions[cell.row][cell.col] === region));
    return {
      small: regions.filter((cells) => cells.length <= 3).length,
      axial: regions.filter((cells) => cells.length > 1 && [0, 1, 2].some((axis) =>
        new Set(cells.map((cell) => hexAxes(puzzle.size, cell)[axis])).size === 1)).length,
    };
  };

  it('creates a valid unique puzzle on every supported side length', () => {
    for (const size of [5, 6, 7, 8]) {
      const puzzle = createHexPuzzle(size, 0x600d + size);
      expect(puzzle.boardType).toBe('hex');
      expect(hexCells(size)).toHaveLength(3 * size * (size - 1) + 1);
      expect(puzzle.cats).toHaveLength(size * 2 - 1);
      const obvious = obviousRegions(puzzle);
      expect(obvious.small).toBeGreaterThanOrEqual(size === 5 ? 3 : size <= 7 ? 2 : 1);
      expect(obvious.axial).toBeGreaterThanOrEqual(size === 5 ? 2 : 1);
      for (let left = 0; left < puzzle.cats.length; left += 1) {
        const region = puzzle.regions[puzzle.cats[left].row][puzzle.cats[left].col];
        expect(puzzle.cats.filter((cat) => puzzle.regions[cat.row][cat.col] === region)).toHaveLength(1);
        for (let right = left + 1; right < puzzle.cats.length; right += 1) {
          expect(hexCellsConflict(size, puzzle.cats[left], puzzle.cats[right])).toBe(false);
          expect(areHexNeighbors(size, puzzle.cats[left], puzzle.cats[right])).toBe(false);
        }
      }
      expect(findHexPuzzleSolutions(puzzle, puzzle.initialClues, 2)).toEqual([puzzle.cats]);
    }
  }, 20_000);

  it('contains 1000 hex levels with the requested side-length pacing', () => {
    expect(HEX_LEVEL_COUNT).toBe(1000);
    const levels = Array.from({ length: HEX_LEVEL_COUNT }, (_, index) => getHexLevel(index));
    expect(levels.slice(0, 20).every((level) => level.size === 5 && level.difficulty === 'easy')).toBe(true);
    expect(levels.slice(20).every((level) => level.size >= 6 && level.size <= 8)).toBe(true);
    expect(new Set(levels.slice(20).map((level) => level.size))).toEqual(new Set([6, 7, 8]));
    levels.forEach((level) => {
      const puzzle = levelToPuzzle(level);
      const obvious = obviousRegions(puzzle);
      expect(obvious.small, `hex level ${level.id}`).toBeGreaterThanOrEqual(level.size === 5 ? 3 : level.size <= 7 ? 2 : 1);
      expect(obvious.axial, `hex level ${level.id}`).toBeGreaterThanOrEqual(level.size === 5 ? 2 : 1);
      expect(findHexPuzzleSolutions(puzzle, puzzle.initialClues, 2)).toEqual([puzzle.cats]);
    });
  }, 30_000);
});

describe('logic hints', () => {
  it('finds a rule 0 cat when a color has one candidate left', () => {
    const puzzle = levelToPuzzle(getMainLevel(0));
    const states = Array.from({ length: puzzle.size }, () => Array<CellState>(puzzle.size).fill('hidden'));
    const region = puzzle.regions[puzzle.cats[0].row][puzzle.cats[0].col];
    puzzle.regions.forEach((row, rowIndex) => row.forEach((value, col) => {
      if (value === region && !hasCat(puzzle, rowIndex, col)) states[rowIndex][col] = 'marked';
    }));
    const hint = findLogicHints(puzzle, states)[0];
    expect(hint).toMatchObject({ ...puzzle.cats[0], action: 'cat', rule: 0 });
  });

  it('only emits truth-preserving hints along a full solve', () => {
    const puzzle = levelToPuzzle(getMainLevel(999));
    const report = solvePuzzleLogically(puzzle);
    expect(report.solved).toBe(true);
    report.hints.forEach((hint) => {
      expect(hint.action === 'cat' ? hasCat(puzzle, hint.row, hint.col) : !hasCat(puzzle, hint.row, hint.col)).toBe(true);
    });
  });
});
