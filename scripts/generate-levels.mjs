import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPuzzle } from '../src/game.ts';
import { createHexPuzzle } from '../src/hex.ts';
import { solvePuzzleLogically } from '../src/logic.ts';

const MAIN_LEVEL_COUNT = 1000;
const CHALLENGE_LEVEL_COUNT = 200;
const HEX_LEVEL_COUNT = 1000;

function mainSpec(index) {
  if (index < 100) return { size: 5, difficulty: 'easy', targetSeconds: 55 };
  if (index < 300) return { size: 6, difficulty: index < 200 ? 'easy' : 'normal', targetSeconds: 70 };
  if (index < 550) return { size: 7, difficulty: 'normal', targetSeconds: 88 };
  if (index < 800) return { size: 8, difficulty: index < 675 ? 'normal' : 'hard', targetSeconds: 108 };
  return { size: 9, difficulty: 'hard', targetSeconds: 132 };
}

function serializePuzzle(id, spec, seed, puzzle, report) {
  return {
    id,
    seed,
    boardType: puzzle.boardType,
    size: spec.size,
    difficulty: spec.difficulty,
    targetSeconds: spec.targetSeconds,
    cats: puzzle.cats,
    regions: puzzle.regions,
    palette: puzzle.palette,
    initialClues: puzzle.initialClues,
    logicSteps: report.steps,
    logicRules: report.rulesUsed,
  };
}

function hexSpec(index, random) {
  if (index < 20) return { size: 5, difficulty: 'easy', targetSeconds: 80 };
  const size = 6 + Math.floor(random() * 3);
  return {
    size,
    difficulty: size <= 7 ? 'normal' : 'hard',
    targetSeconds: size === 6 ? 110 : size === 7 ? 140 : 175,
  };
}

function generateMainLevels() {
  const levels = [];
  let seed = 0x4d454f57;
  while (levels.length < MAIN_LEVEL_COUNT) {
    const spec = mainSpec(levels.length);
    const puzzle = createPuzzle(spec.size, seed);
    const report = solvePuzzleLogically(puzzle);
    if (report.solved) {
      levels.push(serializePuzzle(levels.length + 1, spec, seed, puzzle, report));
      if (levels.length % 100 === 0) process.stdout.write(`main ${levels.length}/${MAIN_LEVEL_COUNT}\n`);
    }
    seed += 1;
  }
  return levels;
}

function generateChallengeLevels() {
  const levels = [];
  let seed = 0x43415400;
  const spec = { size: 9, difficulty: 'hard', targetSeconds: 150 };
  while (levels.length < CHALLENGE_LEVEL_COUNT) {
    const puzzle = createPuzzle(spec.size, seed);
    const report = solvePuzzleLogically(puzzle);
    if (report.solved && report.rulesUsed.includes(4) && report.steps >= 58) {
      levels.push(serializePuzzle(levels.length + 1, spec, seed, puzzle, report));
      if (levels.length % 25 === 0) process.stdout.write(`challenge ${levels.length}/${CHALLENGE_LEVEL_COUNT}\n`);
    }
    seed += 1;
  }
  return levels;
}

function generateHexLevels() {
  const levels = [];
  let seed = 0x48455800;
  let specRandom = 0x9e3779b9;
  const nextSizeRandom = () => {
    specRandom = Math.imul(specRandom ^ (specRandom >>> 16), 0x21f0aaad);
    specRandom = Math.imul(specRandom ^ (specRandom >>> 15), 0x735a2d97);
    return ((specRandom ^= specRandom >>> 15) >>> 0) / 4294967296;
  };
  while (levels.length < HEX_LEVEL_COUNT) {
    const spec = hexSpec(levels.length, nextSizeRandom);
    try {
      const puzzle = createHexPuzzle(spec.size, seed);
      levels.push(serializePuzzle(levels.length + 1, spec, seed, puzzle, { steps: 0, rulesUsed: [] }));
      if (levels.length % 100 === 0) process.stdout.write(`hex ${levels.length}/${HEX_LEVEL_COUNT}\n`);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('Unable to make the hex puzzle unique')) throw error;
    }
    seed += 1;
  }
  return levels;
}

const outputPath = resolve(import.meta.dirname, '../src/levels.generated.json');
const catalog = {
  version: 2,
  generatedAt: '2026-07-30',
  main: generateMainLevels(),
  challenges: generateChallengeLevels(),
  hex: generateHexLevels(),
};
writeFileSync(outputPath, `${JSON.stringify(catalog)}\n`);
process.stdout.write(`wrote ${catalog.main.length} main levels, ${catalog.challenges.length} challenges, and ${catalog.hex.length} hex levels to ${outputPath}\n`);
