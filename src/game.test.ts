import { describe, expect, it } from 'vitest';
import { calculateStars, createInitialClues, createPuzzle, LEVELS, seededRandom } from './game';

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
    });
  }
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
  it('reveals one or two immutable truth values', () => {
    const puzzle = createPuzzle(7, 24680);
    for (let seed = 0; seed < 20; seed += 1) {
      const clues = createInitialClues(puzzle, seededRandom(seed));
      expect(clues.length).toBeGreaterThanOrEqual(1);
      expect(clues.length).toBeLessThanOrEqual(2);
      expect(new Set(clues.map(({ row, col }) => `${row},${col}`)).size).toBe(clues.length);
      clues.forEach(({ row, col, state }) => {
        expect(state).toBe(puzzle.catSet.has(`${row},${col}`) ? 'cat' : 'marked');
      });
    }
  });
});
