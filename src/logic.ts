import type { CellState, Position, Puzzle } from './game';
import { findHexLogicHints } from './hex.ts';

export type LogicRule = 'base' | 0 | 1 | 2 | 3 | 4;
export type HintAction = 'cat' | 'empty';

export interface LogicHint extends Position {
  action: HintAction;
  rule: LogicRule;
  reason: string;
}

export interface LogicSolveReport {
  solved: boolean;
  steps: number;
  rulesUsed: LogicRule[];
  hints: LogicHint[];
}

interface Line {
  kind: 'row' | 'col';
  index: number;
  cells: Position[];
}

const positionKey = ({ row, col }: Position): string => `${row},${col}`;
const lineName = (line: Line): string => `${line.kind === 'row' ? 'Row ' : 'Column '}${line.index + 1}${line.kind === 'row' ? '' : ''}`;

function createLines(size: number): Line[] {
  const rows = Array.from({ length: size }, (_, row): Line => ({
    kind: 'row',
    index: row,
    cells: Array.from({ length: size }, (_, col) => ({ row, col })),
  }));
  const cols = Array.from({ length: size }, (_, col): Line => ({
    kind: 'col',
    index: col,
    cells: Array.from({ length: size }, (_, row) => ({ row, col })),
  }));
  return [...rows, ...cols];
}

function conflicts(left: Position, right: Position): boolean {
  return left.row === right.row
    || left.col === right.col
    || (Math.abs(left.row - right.row) <= 1 && Math.abs(left.col - right.col) <= 1);
}

function cloneStates(states: readonly (readonly CellState[])[]): CellState[][] {
  return states.map((row) => [...row]);
}

function cellsForRegion(puzzle: Puzzle, region: number): Position[] {
  return puzzle.regions.flatMap((row, rowIndex) =>
    row.flatMap((value, col) => value === region ? [{ row: rowIndex, col }] : []));
}

function foundCats(states: readonly (readonly CellState[])[]): Position[] {
  return states.flatMap((row, rowIndex) =>
    row.flatMap((state, col) => state === 'cat' ? [{ row: rowIndex, col }] : []));
}

export function findLogicHints(
  puzzle: Puzzle,
  states: readonly (readonly CellState[])[],
): LogicHint[] {
  if (puzzle.boardType === 'hex') return findHexLogicHints(puzzle, states);
  if (states.length !== puzzle.size || states.some((row) => row.length !== puzzle.size)) return [];

  const hints = new Map<string, LogicHint>();
  const addHint = (hint: LogicHint): void => {
    if (states[hint.row][hint.col] !== 'hidden') return;
    const key = positionKey(hint);
    if (!hints.has(key)) hints.set(key, hint);
  };
  const cats = foundCats(states);

  // Immediate consequences of an already confirmed cat take priority over derived rules.
  for (const cat of cats) {
    const catRegion = puzzle.regions[cat.row][cat.col];
    for (let row = 0; row < puzzle.size; row += 1) {
      for (let col = 0; col < puzzle.size; col += 1) {
        const cell = { row, col };
        if (states[row][col] === 'hidden'
          && (puzzle.regions[row][col] === catRegion || conflicts(cat, cell))) {
          addHint({
            ...cell,
            action: 'empty',
            rule: 'base',
            reason: `Found pups rule out any other cat at Row ${row + 1},  ${col + 1} Cannot have another pup`,
          });
        }
      }
    }
  }
  if (hints.size > 0) return [...hints.values()];

  const lines = createLines(puzzle.size);
  const unresolvedRegions = Array.from({ length: puzzle.size }, (_, region) => region)
    .filter((region) => !cats.some(({ row, col }) => puzzle.regions[row][col] === region));

  // Rule 0: a color with one candidate has its cat in that cell.
  for (const region of unresolvedRegions) {
    const candidates = cellsForRegion(puzzle, region)
      .filter(({ row, col }) => states[row][col] === 'hidden');
    if (candidates.length === 1) {
      addHint({
        ...candidates[0],
        action: 'cat',
        rule: 0,
        reason: `This color only has one Pup option left at Row ${candidates[0].row + 1}, Column ${candidates[0].col + 1} `,
      });
    }
  }
  if (hints.size > 0) return [...hints.values()];

  // Rule 1: if a line contains candidates of only one color, that color is locked to the line.
  for (const line of lines) {
    if (line.cells.some(({ row, col }) => states[row][col] === 'cat')) continue;
    const candidates = line.cells.filter(({ row, col }) => states[row][col] === 'hidden');
    const regions = new Set(candidates.map(({ row, col }) => puzzle.regions[row][col]));
    if (candidates.length === 0 || regions.size !== 1) continue;
    const [region] = regions;
    const lineCells = new Set(line.cells.map(positionKey));
    for (const cell of cellsForRegion(puzzle, region)) {
      if (!lineCells.has(positionKey(cell))) {
        addHint({
          ...cell,
          action: 'empty',
          rule: 1,
          reason: `${lineName(line)} only has one color left, so the Pup for that color must in ${lineName(line)} instead`,
        });
      }
    }
  }
  if (hints.size > 0) return [...hints.values()];

  // Rule 2: if a color exists only on one line, that line is occupied by the color.
  for (const region of unresolvedRegions) {
    const candidates = cellsForRegion(puzzle, region)
      .filter(({ row, col }) => states[row][col] === 'hidden');
    if (candidates.length === 0) continue;
    const lockingLines = lines.filter((line) => {
      const lineCells = new Set(line.cells.map(positionKey));
      return candidates.every((cell) => lineCells.has(positionKey(cell)));
    });
    for (const line of lockingLines) {
      for (const cell of line.cells) {
        if (puzzle.regions[cell.row][cell.col] !== region) {
          addHint({
            ...cell,
            action: 'empty',
            rule: 2,
            reason: `One of the colors is only on ${lineName(line)}, so the Pup for this line must be in that color instead`,
          });
        }
      }
    }
  }
  if (hints.size > 0) return [...hints.values()];

  // Rule 3: two colors confined to two lines occupy both lines.
  for (let leftRegionIndex = 0; leftRegionIndex < unresolvedRegions.length; leftRegionIndex += 1) {
    for (let rightRegionIndex = leftRegionIndex + 1; rightRegionIndex < unresolvedRegions.length; rightRegionIndex += 1) {
      const leftRegion = unresolvedRegions[leftRegionIndex];
      const rightRegion = unresolvedRegions[rightRegionIndex];
      const candidates = [...cellsForRegion(puzzle, leftRegion), ...cellsForRegion(puzzle, rightRegion)]
        .filter(({ row, col }) => states[row][col] === 'hidden');
      if (candidates.length === 0) continue;

      for (let firstLineIndex = 0; firstLineIndex < lines.length; firstLineIndex += 1) {
        for (let secondLineIndex = firstLineIndex + 1; secondLineIndex < lines.length; secondLineIndex += 1) {
          const firstLine = lines[firstLineIndex];
          const secondLine = lines[secondLineIndex];
          if (firstLine.cells.some(({ row, col }) => states[row][col] === 'cat')
            || secondLine.cells.some(({ row, col }) => states[row][col] === 'cat')) continue;
          const union = new Set([...firstLine.cells, ...secondLine.cells].map(positionKey));
          if (!candidates.every((cell) => union.has(positionKey(cell)))) continue;

          for (const cell of [...firstLine.cells, ...secondLine.cells]) {
            const region = puzzle.regions[cell.row][cell.col];
            if (region !== leftRegion && region !== rightRegion) {
              addHint({
                ...cell,
                action: 'empty',
                rule: 3,
                reason: `Two colors are locked into ${lineName(firstLine)} and ${lineName(secondLine)}, so other colors cannot occupy these lines`,
              });
            }
          }
        }
      }
    }
  }
  if (hints.size > 0) return [...hints.values()];

  // Rule 4: assuming X is a cat must not remove every candidate of another color.
  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      if (states[row][col] !== 'hidden') continue;
      const assumed = { row, col };
      const assumedRegion = puzzle.regions[row][col];
      for (const region of unresolvedRegions) {
        if (region === assumedRegion) continue;
        const candidates = cellsForRegion(puzzle, region)
          .filter((cell) => states[cell.row][cell.col] === 'hidden');
        if (candidates.length > 0 && candidates.every((cell) => conflicts(assumed, cell))) {
          addHint({
            row,
            col,
            action: 'empty',
            rule: 4,
            reason: `A Pup cannot be placed here, since it would rule out all the options for another color`,
          });
          break;
        }
      }
    }
  }

  return [...hints.values()];
}

export function solvePuzzleLogically(puzzle: Puzzle): LogicSolveReport {
  const states = Array.from({ length: puzzle.size }, () =>
    Array<CellState>(puzzle.size).fill('hidden'));
  puzzle.initialClues.forEach(({ row, col, state }) => {
    states[row][col] = state;
  });

  const usedRules = new Set<LogicRule>();
  const appliedHints: LogicHint[] = [];
  const maxSteps = puzzle.size * puzzle.size * 2;

  while (foundCats(states).length < puzzle.size && appliedHints.length < maxSteps) {
    const hint = findLogicHints(puzzle, states)[0];
    if (!hint) break;
    states[hint.row][hint.col] = hint.action === 'cat' ? 'cat' : 'marked';
    usedRules.add(hint.rule);
    appliedHints.push(hint);
  }

  const finalCats = foundCats(states);
  const matchesTarget = finalCats.length === puzzle.size
    && finalCats.every(({ row, col }) => puzzle.catSet.has(`${row},${col}`));
  return {
    solved: matchesTarget,
    steps: appliedHints.length,
    rulesUsed: [...usedRules],
    hints: appliedHints,
  };
}

export function copyCellStates(states: readonly (readonly CellState[])[]): CellState[][] {
  return cloneStates(states);
}
