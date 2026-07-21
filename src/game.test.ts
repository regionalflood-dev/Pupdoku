import { describe, expect, it } from 'vitest';
import {
  calculateStars,
  createInitialClues,
  createPuzzle,
  findPuzzleSolutions,
  LEVELS,
  type InitialClue,
  type Position,
  type Puzzle,
} from './game';

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

  it('generates every configured level with exactly one solution', () => {
    LEVELS.forEach(({ size }, index) => {
      const puzzle = createPuzzle(size, 20260720 + index * 7919);
      expect(findPuzzleSolutions(puzzle, puzzle.initialClues, 2)).toHaveLength(1);
      expect(findSolutionsIndependently(puzzle, puzzle.initialClues, 2)).toEqual([columns(puzzle.cats)]);
    });
  });

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

describe('level pacing', () => {
  it('repeats two easy, two normal, and one hard level', () => {
    expect(LEVELS.map((level) => level.difficulty)).toEqual([
      'easy', 'easy', 'normal', 'normal', 'hard',
      'easy', 'easy', 'normal', 'normal', 'hard',
    ]);
  });
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
