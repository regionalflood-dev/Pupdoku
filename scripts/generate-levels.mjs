
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPuzzle } from '../src/game.ts';
import { createHexPuzzle } from '../src/hex.ts';
import { solvePuzzleLogically } from '../src/logic.ts';

const MAIN_LEVEL_COUNT = 1000;
const CHALLENGE_LEVEL_COUNT = 200;
const DAILY_HEX_LEVEL_COUNT = 200;
const HEX_LEVEL_COUNT = 1000;
const MAIN_ATTEMPTS_PER_LEVEL = 8;
const CHALLENGE_ATTEMPTS_PER_LEVEL = 40;
const HEX_ATTEMPTS_PER_LEVEL = 4;

function mainSpec(index) {
  if (index < 10) return { size: 5, difficulty: 'easy', targetSeconds: 35 };
  if (index < 25) return { size: 6, difficulty: 'easy', targetSeconds: 50 };
  if (index < 50) return { size: 7, difficulty: 'normal', targetSeconds: 75 };
  if (index < 75) return { size: 8, difficulty: 'hard', targetSeconds: 115 };

  const progress = Math.min(1, (index - 75) / 924);
  return {
    size: 9,
    difficulty: progress < 0.2 ? 'hard' : progress < 0.65 ? 'expert' : 'master',
    targetSeconds: Math.round(135 + progress * 100),
  };
}

function mainTarget(index, spec) {
  if (spec.size <= 6) return { minSteps: 0, requireRule4: false };
  if (spec.size === 7) return { minSteps: 12, requireRule4: false };
  if (spec.size === 8) return { minSteps: 24, requireRule4: false };

  const progress = Math.min(1, (index - 75) / 924);
  return {
    minSteps: Math.round(32 + progress * 42),
    requireRule4: progress >= 0.12,
  };
}

function puzzleScore(report) {
  return report.steps
    + (report.rulesUsed.includes(4) ? 32 : 0)
    + Math.max(0, report.rulesUsed.length - 2) * 4;
}

function meetsTarget(report, target) {
  return report.solved
    && report.steps >= target.minSteps
    && (!target.requireRule4 || report.rulesUsed.includes(4));
}

function serializePuzzle(id, spec, seed, puzzle, report, extra = {}) {
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
    ...extra,
  };
}

function expectedFailure(error, phrase) {
  return error instanceof Error && error.message.includes(phrase);
}

function chooseBestSquare(size, startSeed, attempts, target) {
  let best = null;

  for (let offset = 0; offset < attempts; offset += 1) {
    const seed = startSeed + offset;

    try {
      const puzzle = createPuzzle(size, seed);
      const report = solvePuzzleLogically(puzzle);
      if (!report.solved) continue;

      const candidate = {
        seed,
        puzzle,
        report,
        score: puzzleScore(report),
      };

      if (!best || candidate.score > best.score) best = candidate;
    } catch (error) {
      if (!expectedFailure(error, 'clue-free unique puzzle')) throw error;
    }
  }

  return best ? { ...best, targetMet: meetsTarget(best.report, target) } : null;
}

function generateMainLevels() {
  const levels = [];
  let seed = 0x4d454f57;

  while (levels.length < MAIN_LEVEL_COUNT) {
    const index = levels.length;
    const spec = mainSpec(index);
    const target = mainTarget(index, spec);
    const chosen = chooseBestSquare(
      spec.size, seed, MAIN_ATTEMPTS_PER_LEVEL, target
    );

    seed += MAIN_ATTEMPTS_PER_LEVEL;

    if (!chosen) {
      throw new Error(`Could not generate main level ${index + 1}.`);
    }

    levels.push(serializePuzzle(
      index + 1, spec, chosen.seed, chosen.puzzle, chosen.report, {
        difficultyTargetMet: chosen.targetMet,
        difficultyScore: chosen.score,
      }
    ));

    if (levels.length % 50 === 0) {
      process.stdout.write(
        `main ${levels.length}/${MAIN_LEVEL_COUNT}; ` +
        `${chosen.report.steps} steps` +
        `${chosen.targetMet ? '' : ' (best candidate)'}\n`
      );
    }
  }

  return levels;
}

function generateChallengeLevels() {
  const levels = [];
  let seed = 0x43415400;
  const spec = { size: 9, difficulty: 'master', targetSeconds: 210 };
  const target = { minSteps: 58, requireRule4: true };

  while (levels.length < CHALLENGE_LEVEL_COUNT) {
    const index = levels.length;
    const chosen = chooseBestSquare(
      spec.size, seed, CHALLENGE_ATTEMPTS_PER_LEVEL, target
    );

    seed += CHALLENGE_ATTEMPTS_PER_LEVEL;

    if (!chosen) {
      throw new Error(`Could not generate square challenge ${index + 1}.`);
    }

    levels.push(serializePuzzle(
      index + 1, spec, chosen.seed, chosen.puzzle, chosen.report, {
        difficultyTargetMet: chosen.targetMet,
        difficultyScore: chosen.score,
      }
    ));

    if (levels.length % 20 === 0) {
      process.stdout.write(
        `challenges ${levels.length}/${CHALLENGE_LEVEL_COUNT}; ` +
        `${chosen.report.steps} steps` +
        `${chosen.targetMet ? '' : ' (target not met)'}\n`
      );
    }
  }

  return levels;
}

function hexSpec(index, random) {
  if (index < 20) {
    return { size: 5, difficulty: 'easy', targetSeconds: 65 };
  }

  const size = 6 + Math.floor(random() * 3);

  return {
    size,
    difficulty: size === 6 ? 'normal' : size === 7 ? 'hard' : 'expert',
    targetSeconds: size === 6 ? 120 : size === 7 ? 160 : 205,
  };
}

function generateHexCollection(count, seedStart, label, specForIndex, progressEvery) {
  const levels = [];
  let seed = seedStart;

  while (levels.length < count) {
    const index = levels.length;
    const spec = specForIndex(index);
    let accepted = null;

    for (let attempt = 0; attempt < HEX_ATTEMPTS_PER_LEVEL; attempt += 1) {
      const candidateSeed = seed + attempt;

      try {
        accepted = {
          puzzle: createHexPuzzle(spec.size, candidateSeed),
          seed: candidateSeed,
        };
        break;
      } catch (error) {
        if (!expectedFailure(error, 'clue-free unique hex puzzle')) throw error;
      }
    }

    seed += HEX_ATTEMPTS_PER_LEVEL;

    if (!accepted) {
      throw new Error(
        `Could not generate ${label} level ${index + 1} (size ${spec.size}).`
      );
    }

    levels.push(serializePuzzle(
      index + 1,
      spec,
      accepted.seed,
      accepted.puzzle,
      { steps: 0, rulesUsed: [] },
      { difficultyTargetMet: null, difficultyScore: null }
    ));

    if (levels.length % progressEvery === 0) {
      process.stdout.write(`${label} ${levels.length}/${count}\n`);
    }
  }

  return levels;
}

function generateDailyHexLevels() {
  return generateHexCollection(
    DAILY_HEX_LEVEL_COUNT,
    0x44485900,
    'daily hex',
    index => {
      const size = index % 2 === 0 ? 8 : 9;
      return {
        size,
        difficulty: 'expert',
        targetSeconds: size === 8 ? 190 : 235,
      };
    },
    20
  );
}

function generateHexLevels() {
  let state = 0x9e3779b9;

  const random = () => {
    state = Math.imul(state ^ (state >>> 16), 0x21f0aaad);
    state = Math.imul(state ^ (state >>> 15), 0x735a2d97);
    return ((state ^= state >>> 15) >>> 0) / 4294967296;
  };

  return generateHexCollection(
    HEX_LEVEL_COUNT,
    0x48455800,
    'hex',
    index => hexSpec(index, random),
    100
  );
}

const outputPath = resolve(import.meta.dirname, '../src/levels.generated.json');

const catalog = {
  version: 5,
  generatedAt: new Date().toISOString().slice(0, 10),
  main: generateMainLevels(),
  challenges: generateChallengeLevels(),
  dailyHex: generateDailyHexLevels(),
  hex: generateHexLevels(),
};

writeFileSync(outputPath, `${JSON.stringify(catalog)}\n`);

process.stdout.write(
  `Wrote ${catalog.main.length} main levels, ` +
  `${catalog.challenges.length} square challenges, ` +
  `${catalog.dailyHex.length} hex challenges, and ` +
  `${catalog.hex.length} hex levels to ${outputPath}\n`
);
