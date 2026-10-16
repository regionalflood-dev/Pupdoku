import './style.css';
import { calculateStarRating, createInitialClues, formatTime, getCatAutoMarks, hasCat, puzzleSpan, type CellState, type Puzzle } from './game';
import { findLogicHints, type LogicHint } from './logic';
import {
  formatLevelNumber,
  getDailyChallenge,
  isDailyChallengeKey,
  getHexLevel,
  getMainLevel,
  HEX_LEVEL_COUNT,
  levelToPuzzle,
  MAIN_LEVEL_COUNT,
  pickDailyChallengeKey,
  type DailyChallengeKey,
  type GameMode,
  type StoredLevel,
} from './levels';
import { sound } from './audio';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root not found');

const DOG_IMAGES = [
  './images/dog-token.png',
  './images/hulk-token.png',
  './images/fred-token.png',
  './images/flash-token.png',
  './images/thanos-token.png',
];

const randomIndex = Math.floor(Math.random() * DOG_IMAGES.length);

const ruleCat = '<img class="rule-cat" src="./images/dog-token.png" alt="">';
//const ruleCat = `<img class="rule-cat" src="${DOG_IMAGES[randomIndex]}" alt="">`;
const squareRuleCells = '<i></i>'.repeat(9);
const squareRulesMarkup = `
<div><span class="rule-visual square-rule-visual square-color-rule" aria-hidden="true">${squareRuleCells}${ruleCat}</span><p>Each Color<br><strong>One Pup</strong></p></div>
  <div><span class="rule-visual square-rule-visual square-axis-rule" aria-hidden="true">${squareRuleCells}${ruleCat}</span><p>Each Row/Column<br><strong>One Pup</strong></p></div>
  <div><span class="rule-visual square-rule-visual square-neighbor-rule" aria-hidden="true">${squareRuleCells}${ruleCat}</span><p>Each Pup Cannot<br><strong>Touch Another Pup</strong></p></div>
`;
const hexNeighborCells = '<i class="hex-cell center"></i><i class="hex-cell blocked north"></i><i class="hex-cell blocked north-east"></i><i class="hex-cell blocked south-east"></i><i class="hex-cell blocked south"></i><i class="hex-cell blocked south-west"></i><i class="hex-cell blocked north-west"></i>';
const hexRulesMarkup = `
  <div><span class="rule-visual hex-color-rule" aria-hidden="true"><i class="hex-cell apex"></i><i class="hex-cell blocked lower-left"></i><i class="hex-cell blocked lower-right"></i>${ruleCat}</span><p>Each Color<br><strong>One Pup</strong></p></div>
  <div><span class="rule-visual hex-axis-rule" aria-hidden="true"><i class="hex-cell"></i><b></b><b></b><b></b>${ruleCat}</span><p>Each Direction<br><strong>One Pup</strong></p></div>
  <div><span class="rule-visual hex-neighbor-rule" aria-hidden="true">${hexNeighborCells}${ruleCat}</span><p>Each Pup Cannot<br><strong>Touch Another Pup</strong></p></div>
`;
const hexSelectionFrame = `
  <svg class="hex-selection-frame" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <polygon class="hex-selection-frame-outer" points="26.5,5.8 73.5,5.8 97,50 73.5,94.2 26.5,94.2 3,50"></polygon>
    <polygon class="hex-selection-frame-inner" points="26.5,5.8 73.5,5.8 97,50 73.5,94.2 26.5,94.2 3,50"></polygon>
  </svg>`;

type Phase = 'menu' | 'playing' | 'won' | 'lost';

const storedMainProgress = Number(localStorage.getItem('meowdoku-main-level') ?? localStorage.getItem('meowdoku-level') ?? 0);
let mainLevelIndex = Math.max(0, Math.min(MAIN_LEVEL_COUNT - 1, Number.isFinite(storedMainProgress) ? storedMainProgress : 0));
const storedHexProgress = Number(localStorage.getItem('meowdoku-hex-level') ?? 0);
let hexLevelIndex = Math.max(0, Math.min(HEX_LEVEL_COUNT - 1, Number.isFinite(storedHexProgress) ? storedHexProgress : 0));
let bestStars = JSON.parse(localStorage.getItem('meowdoku-stars') ?? '{}') as Record<number, number>;
let hexBestStars = JSON.parse(localStorage.getItem('meowdoku-hex-stars') ?? '{}') as Record<number, number>;
const totalFishStorageKey = 'meowdoku-total-fish';
const storedTotalFish = Number(localStorage.getItem(totalFishStorageKey) ?? 0);
let totalFish = Number.isFinite(storedTotalFish) ? Math.max(0, Math.floor(storedTotalFish)) : 0;
let mode: GameMode = 'main';
let currentLevel: StoredLevel;
let activeMainIndex = mainLevelIndex;
let activeHexIndex = hexLevelIndex;
let activeDailyDateKey = '';
let activeDailyKey: DailyChallengeKey | undefined;
let puzzle: Puzzle;
let cells: CellState[][];
let givenCells = new Set<string>();
let wrongCells = new Set<string>();
let hintedCell: string | undefined;
let fish = 3;
let mistakes = 0;
let found = 0;
let elapsed = 0;
let phase: Phase = 'menu';
let animateBoardEntrance = false;
let boardEntranceTimer: number | undefined;
let timer: number | undefined;
let messageTimer: number | undefined;
let finishTimer: number | undefined;
let menuCatTimer: number | undefined;
let lastCellClick: { cellKey: string; timeStamp: number; revealed: boolean } | undefined;
let cellDrag: {
  pointerId: number;
  startCell: HTMLButtonElement;
  lastX: number;
  lastY: number;
  dragging: boolean;
  visited: Set<string>;
} | undefined;
let suppressPointerClicksUntil = 0;
const doubleClickWindow = 300;

app.innerHTML = `
  <section class="mode-screen" id="mode-screen" aria-labelledby="game-title">
    <div class="menu-board-bg" aria-hidden="true">
      <div class="menu-board-track" id="menu-board-track"></div>
    </div>
    <button class="round-button menu-sound-button" id="menu-sound-button" aria-label="Mute">♪</button>
    <div class="brand-mark"><img src="./images/pup-icon.png" alt="" aria-hidden="true"></div>
    <div class="mode-heading">
      <p>PUPDOKU</p>
      <h1 id="game-title">Pupdoku</h1>
      <div class="fish-wallet" aria-label="Total Bones Earned">
        <img src="./images/bone-token.png" alt="" aria-hidden="true">
        <span>Bones</span>
        <strong id="total-fish-label">0</strong>
      </div>
    </div>
    <div class="mode-list" aria-label="Select Game Mode">
      <button class="mode-card main-mode" id="main-mode-button">
        <span class="mode-card-icon main-board-icon" aria-hidden="true">${'<i></i>'.repeat(9)}</span>
        <span class="mode-card-copy">
          <small id="main-entry-status">Current Level 001</small>
          <strong>Pup Levels</strong>
        </span>
        <span class="mode-card-arrow" aria-hidden="true">›</span>
      </button>
      <button class="mode-card daily-mode" id="daily-mode-button">
        <span class="mode-card-icon challenge-icon" aria-hidden="true"><i></i><b></b></span>
        <span class="mode-card-copy">
          <small id="daily-entry-status">Updates Daily</small>
          <strong>Daily Challenge</strong>
        </span>
        <span class="mode-card-arrow" aria-hidden="true">›</span>
      </button>
      <button class="mode-card hex-mode" id="hex-mode-button">
        <span class="mode-card-icon hex-icon" aria-hidden="true">${'<i></i>'.repeat(7)}</span>
        <span class="mode-card-copy">
          <small id="hex-entry-status">Current Level 001</small>
          <strong>Hexagonal Mode</strong>
        </span>
        <span class="mode-card-arrow" aria-hidden="true">›</span>
      </button>
    </div>
  </section>

  <main class="game-shell" id="game-screen" hidden>
    <header class="topbar">
      <button class="round-button" id="home-button" aria-label="Return to Mode Selection">←</button>
      <div class="header-stat">
        <span id="mode-label">Level</span><strong id="level-label">001</strong>
      </div>
      <div class="header-stat">
        <span>Time</span><strong id="timer-label">00:00</strong>
      </div>
      <button class="round-button" id="sound-button" aria-label="Mute">♪</button>
    </header>

    <section class="status-card">
      <div class="cat-counter"><img class="counter-cat" src="${DOG_IMAGES[randomIndex]}" alt="" aria-hidden="true"><strong id="progress-label">0 / 5</strong></div>
   //   <div class="cat-counter"><img class="counter-cat" src="./images/dog-token.png" alt="" aria-hidden="true"><strong id="progress-label">0 / 5</strong></div>
      <div class="fish-info" id="fish-display"></div>
    </section>

    <section class="rules-card">
      <button class="rules-toggle" id="rules-toggle" aria-expanded="true" aria-label="Expand or collapse rules"><span>How to Play</span><span id="rule-arrow">⌃</span></button>
      <div class="rules-body" id="rules-body">${squareRulesMarkup}</div>
    </section>

    <div class="game-slot">
      <section class="game-card">
        <div class="board-wrap">
          <div class="board" id="board" role="grid" aria-label="Pupdoku Board"></div>
          <div class="toast" id="toast" role="status"></div>
        </div>
      </section>
    </div>

    <div class="assist-actions" aria-label="Game Assistance">
      <button class="assist-button hint-button" id="hint-button"><span class="assist-icon">?</span><span>Hint</span></button>
      <button class="assist-button find-button" id="find-cat-button"><img src="./images/dog-token.png" alt="" aria-hidden="true"><span>Find a Pup</span></button>
    </div>

    <p class="tap-hint"><span class="tap-demo">X</span> Single tap to mark "No Pup" X  ·  Double tap to locate Pup</p>
  </main>

  <div class="modal-backdrop" id="result-modal" aria-hidden="true">
    <section class="result-card" role="dialog" aria-modal="true">
      <div class="confetti" id="confetti"></div>
      <div class="result-mascot" id="result-mascot"></div>
      <p class="result-eyebrow" id="result-eyebrow"></p>
      <h2 id="result-title"></h2>
      <div class="stars" id="result-stars"></div>
      <div class="result-stats" id="result-stats"></div>
      <button class="primary-button" id="result-button"></button>
    </section>
  </div>
`;

const modeScreen = document.querySelector<HTMLElement>('#mode-screen')!;
const gameScreen = document.querySelector<HTMLElement>('#game-screen')!;
const menuBoardTrack = document.querySelector<HTMLElement>('#menu-board-track')!;
const board = document.querySelector<HTMLDivElement>('#board')!;
const modeLabel = document.querySelector<HTMLElement>('#mode-label')!;
const levelLabel = document.querySelector<HTMLElement>('#level-label')!;
const timerLabel = document.querySelector<HTMLElement>('#timer-label')!;
const fishDisplay = document.querySelector<HTMLElement>('#fish-display')!;
const progressLabel = document.querySelector<HTMLElement>('#progress-label')!;
const toast = document.querySelector<HTMLElement>('#toast')!;
const modal = document.querySelector<HTMLElement>('#result-modal')!;
const resultMascot = document.querySelector<HTMLElement>('#result-mascot')!;
const resultEyebrow = document.querySelector<HTMLElement>('#result-eyebrow')!;
const resultTitle = document.querySelector<HTMLElement>('#result-title')!;
const resultStars = document.querySelector<HTMLElement>('#result-stars')!;
const resultStats = document.querySelector<HTMLElement>('#result-stats')!;
const resultButton = document.querySelector<HTMLButtonElement>('#result-button')!;
const hintButton = document.querySelector<HTMLButtonElement>('#hint-button')!;
const findCatButton = document.querySelector<HTMLButtonElement>('#find-cat-button')!;
const dailyModeButton = document.querySelector<HTMLButtonElement>('#daily-mode-button')!;
const dailyEntryStatus = document.querySelector<HTMLElement>('#daily-entry-status')!;
const mainEntryStatus = document.querySelector<HTMLElement>('#main-entry-status')!;
const hexEntryStatus = document.querySelector<HTMLElement>('#hex-entry-status')!;
const totalFishLabel = document.querySelector<HTMLElement>('#total-fish-label')!;

function dailyDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const dailyHistoryStorageKey = 'meowdoku-daily-history-v2';
const dailySelectionStorageKey = 'meowdoku-daily-selection-v2';

function readDailyHistory(): DailyChallengeKey[] {
  try {
    const stored = JSON.parse(localStorage.getItem(dailyHistoryStorageKey) ?? '[]');
    return Array.isArray(stored)
      ? stored.filter((value): value is DailyChallengeKey => typeof value === 'string' && isDailyChallengeKey(value))
      : [];
  } catch {
    return [];
  }
}

function selectDailyChallenge(dateKey: string): StoredLevel {
  const completed = readDailyHistory();
  try {
    const stored = JSON.parse(localStorage.getItem(dailySelectionStorageKey) ?? 'null') as unknown;
    if (stored && typeof stored === 'object' && 'date' in stored && 'key' in stored) {
      const { date, key } = stored as { date: unknown; key: unknown };
      if (date === dateKey && typeof key === 'string' && isDailyChallengeKey(key) && !completed.includes(key)) {
        activeDailyKey = key;
        return getDailyChallenge(key);
      }
    }
  } catch {
    // Replace malformed saved data with a fresh daily selection below.
  }

  const selection = pickDailyChallengeKey(completed);
  if (selection.reset) localStorage.setItem(dailyHistoryStorageKey, '[]');
  activeDailyKey = selection.key;
  localStorage.setItem(dailySelectionStorageKey, JSON.stringify({ date: dateKey, key: selection.key }));
  return getDailyChallenge(selection.key);
}

function catArt(className = ''): string {
  return `<img class="cat-art ${className}" src="./images/dog-token.png" alt="" aria-hidden="true" draggable="false">`;
}

function colorfulStarArt(index: number): string {
  const gradientId = `rainbow-star-${index}`;
  const delay = index * 0.15;
  return `<svg class="result-star rainbow-star earned" style="--delay:${delay}s" viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <linearGradient id="${gradientId}" gradientUnits="userSpaceOnUse" x1="-24" y1="0" x2="0" y2="0" spreadMethod="repeat">
        <stop offset="0" stop-color="#ff4f79"/><stop offset=".2" stop-color="#ffca4b"/><stop offset=".4" stop-color="#5ee58b"/>
        <stop offset=".6" stop-color="#55dff5"/><stop offset=".8" stop-color="#9a78ff"/><stop offset="1" stop-color="#ff4f79"/>
        <animate attributeName="x1" from="-24" to="0" dur="2.2s" begin="${0.8 + delay}s" repeatCount="indefinite"/>
        <animate attributeName="x2" from="0" to="24" dur="2.2s" begin="${0.8 + delay}s" repeatCount="indefinite"/>
      </linearGradient>
    </defs>
    <path fill="url(#${gradientId})" d="M12 2l2.81 6.63 7.19.61-5.46 4.73L18.18 21 12 17.27 5.82 21l1.64-7.03L2 9.24l7.19-.61L12 2z"/>
  </svg>`;
}

function createMenuBoard(): void {
  menuBoardTrack.innerHTML = Array.from({ length: 96 }, (_, index) => `
    <span class="menu-board-cell ${index % 13 === 2 || index % 17 === 7 ? 'hopping' : ''}" style="--hop-delay:${(index % 11) * -0.37}s">
      <span class="menu-cell-inner">
        <span class="menu-cell-face"></span>
        <span class="menu-cell-face menu-cell-cat"><img src="./images/dog-token.png" alt=""></span>
      </span>
    </span>
  `).join('');
}

function scheduleMenuCats(): void {
  window.clearTimeout(menuCatTimer);
  if (modeScreen.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  menuCatTimer = window.setTimeout(() => {
    const cells = Array.from(menuBoardTrack.querySelectorAll<HTMLElement>('.menu-board-cell:not(.show-cat)'));
    if (cells.length === 0) return scheduleMenuCats();
    const cell = cells[Math.floor(Math.random() * cells.length)];
    cell.classList.add('show-cat');
    window.setTimeout(() => cell.classList.remove('show-cat'), 1700);
    scheduleMenuCats();
  }, 900 + Math.random() * 1100);
}

function updateMenu(): void {
  const dailyCompleted = localStorage.getItem('meowdoku-daily-completed') === dailyDateKey();
  mainEntryStatus.textContent = `Current Level ${formatLevelNumber(mainLevelIndex + 1)} `;
  hexEntryStatus.textContent = `Current Level ${formatLevelNumber(hexLevelIndex + 1)} `;
  totalFishLabel.textContent = totalFish.toLocaleString('en-US');
  dailyModeButton.disabled = dailyCompleted;
  dailyEntryStatus.textContent = dailyCompleted ? 'Completed Today' : 'Updated Daily';
  dailyModeButton.setAttribute('aria-label', dailyCompleted ? 'Daily Challenge, Completed' : 'Daily Challenge');
}

function renderFish(): void {
  fishDisplay.innerHTML = Array.from({ length: 3 }, (_, index) => `<img class="fish ${index >= fish ? 'empty' : ''}" src="./images/bone-token.png" alt="${index < fish ? 'Bones' : 'Lost Bones'}">`).join('');
}

function renderProgress(): void {
  progressLabel.textContent = `${found} / ${puzzle.cats.length}`;
}

function cellClass(state: CellState, row: number, col: number): string {
  const cellKey = `${row},${col}`;
  return `cell ${state}${givenCells.has(cellKey) ? ' given' : ''}${wrongCells.has(cellKey) ? ' wrong' : ''}${hintedCell === cellKey ? ' hinted' : ''}`;
}

function cellStateLabel(state: CellState, row: number, col: number): string {
  if (state === 'cat') return '，Found the Pup';
  if (wrongCells.has(`${row},${col}`)) return '，Wrong, No Pup!';
  return state === 'marked' ? '，Marked as No Pup' : '';
}

function cellContent(state: CellState, row: number, col: number): string {
  const marker = state === 'marked' ? '<span class="x-mark">×</span>' : state === 'cat' ? catArt() : '';
  const selectionFrame = puzzle.boardType === 'hex' && hintedCell === `${row},${col}` ? hexSelectionFrame : '';
  return `${marker}${selectionFrame}`;
}

function renderBoard(): void {
  const span = puzzleSpan(puzzle);
  board.style.setProperty('--size', span.toString());
  board.className = `board ${puzzle.boardType === 'hex' ? 'hex-board' : 'square-board'} size-${puzzle.size}${animateBoardEntrance ? ' entering' : ''}`;
  if (puzzle.boardType === 'hex') {
    const radius = puzzle.size - 1;
    const widthUnits = radius * 3 + 2;
    const heightUnits = radius * 2 + 1;
    board.style.setProperty('--hex-aspect', String(widthUnits / (Math.sqrt(3) * heightUnits)));
  } else board.style.removeProperty('--hex-aspect');
  board.innerHTML = cells.flatMap((rowStates, row) => rowStates.map((state, col) => {
    const region = puzzle.regions[row][col];
    if (region < 0) return '';
    const isGiven = givenCells.has(`${row},${col}`);
    let layoutStyle = '';
    if (puzzle.boardType === 'hex') {
      const radius = puzzle.size - 1;
      const q = col - radius;
      const r = row - radius;
      const widthUnits = radius * 3 + 2;
      const heightUnits = radius * 2 + 1;
      layoutStyle = `;left:${(1.5 * (q + radius) / widthUnits) * 100}%;top:${((r + q / 2 + radius) / heightUnits) * 100}%;width:${(2 / widthUnits) * 100}%;height:${(1 / heightUnits) * 100}%`;
    }
    const cellName = puzzle.boardType === 'hex' ? `HexCell ${row + 1}-${col + 1}` : `Row ${row + 1} Column ${col + 1} `;
    return `<button class="${cellClass(state, row, col)}" style="--cell-color:${puzzle.palette[region]};--enter-row:${row}${layoutStyle}" data-row="${row}" data-col="${col}" role="gridcell" aria-label="${cellName}${isGiven ? '，初始提示' : ''}${cellStateLabel(state, row, col)}">
      ${cellContent(state, row, col)}
    </button>`;
  })).join('');
}

function updateCell(row: number, col: number): HTMLButtonElement | null {
  const cell = board.querySelector<HTMLButtonElement>(`[data-row="${row}"][data-col="${col}"]`);
  if (!cell) return null;
  const state = cells[row][col];
  const isGiven = givenCells.has(`${row},${col}`);
  cell.className = cellClass(state, row, col);
  cell.setAttribute(
    'aria-label',
    `Row ${row + 1} Column ${col + 1} ${isGiven ? '，Initial Clue' : ''}${cellStateLabel(state, row, col)}`,
  );
  cell.innerHTML = cellContent(state, row, col);
  return cell;
}

function animateCellClick(cell: HTMLButtonElement | null): void {
  if (!cell) return;
  cell.classList.remove('cell-click');
  void cell.offsetWidth;
  cell.classList.add('cell-click');
  cell.addEventListener('animationend', () => cell.classList.remove('cell-click'), { once: true });
}

function showToast(text: string, duration = 1800): void {
  window.clearTimeout(messageTimer);
  toast.textContent = text;
  toast.classList.add('show');
  messageTimer = window.setTimeout(() => toast.classList.remove('show'), duration);
}

function clearHint(): void {
  if (!hintedCell) return;
  const [row, col] = hintedCell.split(',').map(Number);
  hintedCell = undefined;
  updateCell(row, col);
}

function revealAllCats(): void {
  puzzle.cats.forEach(({ row, col }) => {
    if (cells[row][col] !== 'cat') cells[row][col] = 'cat';
  });
  hintedCell = undefined;
  renderBoard();
  board.classList.add('reveal');
}

function resetClickSequence(): void {
  lastCellClick = undefined;
}

function finish(won: boolean): void {
  resetClickSequence();
  finishTimer = undefined;
  phase = won ? 'won' : 'lost';
  window.clearInterval(timer);
  if (!won) revealAllCats();
  const rating = won ? calculateStarRating(elapsed, mistakes) : { stars: 0, colorful: false };
  const { stars } = rating;
  if (won) {
    totalFish += fish;
    localStorage.setItem(totalFishStorageKey, String(totalFish));
    if (mode === 'main') {
      bestStars[activeMainIndex] = Math.max(bestStars[activeMainIndex] ?? 0, stars);
      localStorage.setItem('meowdoku-stars', JSON.stringify(bestStars));
      if (activeMainIndex === mainLevelIndex && mainLevelIndex < MAIN_LEVEL_COUNT - 1) {
        mainLevelIndex += 1;
        localStorage.setItem('meowdoku-main-level', String(mainLevelIndex));
        updateMenu();
      }
    } else if (mode === 'hex') {
      hexBestStars[activeHexIndex] = Math.max(hexBestStars[activeHexIndex] ?? 0, stars);
      localStorage.setItem('meowdoku-hex-stars', JSON.stringify(hexBestStars));
      if (activeHexIndex === hexLevelIndex && hexLevelIndex < HEX_LEVEL_COUNT - 1) {
        hexLevelIndex += 1;
        localStorage.setItem('meowdoku-hex-level', String(hexLevelIndex));
        updateMenu();
      }
    } else {
      const completed = new Set(readDailyHistory());
      if (activeDailyKey) completed.add(activeDailyKey);
      localStorage.setItem(dailyHistoryStorageKey, JSON.stringify([...completed]));
      localStorage.setItem('meowdoku-daily-completed', activeDailyDateKey);
      updateMenu();
    }
    sound.win();
  } else sound.lose();

  resultMascot.innerHTML = catArt(won ? 'happy' : 'sad');
  resultEyebrow.textContent = won ? 'PUP-FECT!' : 'No more bones left…';
  resultTitle.textContent = won ? 'All Pups Found!' : 'Pups do not give up, try again!';
  resultStars.classList.toggle('colorful', rating.colorful);
  resultStars.setAttribute('aria-label', won ? `${rating.colorful ? '彩色' : ''}${stars} 星通关` : 'Level failed');
  resultStars.innerHTML = Array.from({ length: 3 }, (_, index) => rating.colorful
    ? colorfulStarArt(index)
    : `<span class="result-star ${index < stars ? 'earned' : ''}" style="--delay:${index * 0.15}s">★</span>`).join('');
  resultStats.innerHTML = won
    ? `<div><span>Time</span><strong>${formatTime(elapsed)}</strong></div><div><span>Mistakes</span><strong>${mistakes} </strong></div>`
    : '<p>The current board is saved. Click to try again.</p>';
  if (!won) resultButton.textContent = '↻　Try Again!';
  else if ((mode === 'main' && activeMainIndex < MAIN_LEVEL_COUNT - 1)
    || (mode === 'hex' && activeHexIndex < HEX_LEVEL_COUNT - 1)) resultButton.textContent = 'Next Level　›';
  else resultButton.textContent = 'Back to Home';
  document.querySelector('#confetti')!.innerHTML = won ? Array.from({ length: 28 }, (_, index) => `<i style="--x:${Math.random() * 100}%;--r:${Math.random() * 360}deg;--d:${Math.random() * 1.5}s;--c:${['#ff867f','#ffd15c','#78cfa8','#79bff0','#b39be7'][index % 5]}"></i>`).join('') : '';
  modal.classList.toggle('loss', !won);
  modal.classList.add('visible');
  modal.setAttribute('aria-hidden', 'false');
}

function scheduleFinish(won: boolean, delay: number): void {
  window.clearTimeout(finishTimer);
  window.clearInterval(timer);
  phase = won ? 'won' : 'lost';
  finishTimer = window.setTimeout(() => finish(won), delay);
}

function toggleMark(row: number, col: number): void {
  if (phase !== 'playing' || cells[row][col] === 'cat' || givenCells.has(`${row},${col}`)) return;
  clearHint();
  const marking = cells[row][col] === 'hidden';
  cells[row][col] = marking ? 'marked' : 'hidden';
  wrongCells.delete(`${row},${col}`);
  if (marking) sound.mark();
  else sound.unmark();
  animateCellClick(updateCell(row, col));
}

function addMark(row: number, col: number): void {
  if (phase !== 'playing' || cells[row][col] !== 'hidden' || givenCells.has(`${row},${col}`)) return;
  clearHint();
  cells[row][col] = 'marked';
  sound.mark();
  animateCellClick(updateCell(row, col));
}

function cellAtPoint(x: number, y: number): HTMLButtonElement | null {
  const cell = document.elementFromPoint(x, y)?.closest<HTMLButtonElement>('.cell') ?? null;
  return cell && board.contains(cell) ? cell : null;
}

function dragOverCell(cell: HTMLButtonElement): void {
  if (!cellDrag) return;
  const cellKey = `${cell.dataset.row},${cell.dataset.col}`;
  if (cellDrag.visited.has(cellKey)) return;
  cellDrag.visited.add(cellKey);
  addMark(Number(cell.dataset.row), Number(cell.dataset.col));
}

function cellsAlongDrag(fromX: number, fromY: number, toX: number, toY: number): HTMLButtonElement[] {
  const distance = Math.hypot(toX - fromX, toY - fromY);
  const sampleStep = Math.max(4, Math.min(board.clientWidth, board.clientHeight) / puzzle.size / 3);
  const steps = Math.max(1, Math.ceil(distance / sampleStep));
  const result: HTMLButtonElement[] = [];
  for (let step = 1; step <= steps; step += 1) {
    const progress = step / steps;
    const cell = cellAtPoint(
      fromX + (toX - fromX) * progress,
      fromY + (toY - fromY) * progress,
    );
    if (cell && result.at(-1) !== cell) result.push(cell);
  }
  return result;
}

function revealCatAt(row: number, col: number, toastText: string): void {
  clearHint();
  cells[row][col] = 'cat';
  wrongCells.delete(`${row},${col}`);
  getCatAutoMarks(puzzle, { row, col }).forEach((position) => {
    if (cells[position.row][position.col] !== 'hidden') return;
    cells[position.row][position.col] = 'marked';
    updateCell(position.row, position.col);
  });
  found += 1;
  sound.cat();
  animateCellClick(updateCell(row, col));
  renderProgress();
  showToast(toastText);
  if (found === puzzle.cats.length) scheduleFinish(true, 480);
}

function revealCell(row: number, col: number): void {
  if (phase !== 'playing' || cells[row][col] === 'cat' || givenCells.has(`${row},${col}`)) return;
  if (hasCat(puzzle, row, col)) {
    revealCatAt(row, col, ['Awooo! Found it!', 'Ciri Pup!', 'Pup Detective!'][found % 3]);
  } else {
    clearHint();
    cells[row][col] = 'marked';
    wrongCells.add(`${row},${col}`);
    mistakes += 1;
    fish -= 1;
    sound.miss();
    const cell = updateCell(row, col);
    animateCellClick(cell);
    renderFish();
    showToast('No pup here, you lost a bone!');
    cell?.classList.add('mistake');
    if (fish === 0) scheduleFinish(false, 650);
  }
}

function ruleLabel(hint: LogicHint): string {
  return hint.rule === 'base' ? 'Basic Rule' : `Logic ${hint.rule}`;
}

function showLogicalHint(): void {
  if (phase !== 'playing') return;
  clearHint();

  const incorrectMark = puzzle.cats.find(({ row, col }) => cells[row][col] === 'marked');
  if (incorrectMark) {
    hintedCell = `${incorrectMark.row},${incorrectMark.col}`;
    updateCell(incorrectMark.row, incorrectMark.col);
    showToast('This X leads to a contradiction, please clear it first', 3200);
    return;
  }

  const hint = findLogicHints(puzzle, cells).find((candidate) =>
    candidate.action === 'cat' ? hasCat(puzzle, candidate.row, candidate.col) : !hasCat(puzzle, candidate.row, candidate.col));
  if (!hint) {
    showToast('No logical deductions currently 0-4', 2600);
    return;
  }

  hintedCell = `${hint.row},${hint.col}`;
  updateCell(hint.row, hint.col);
  showToast(`${ruleLabel(hint)}：${hint.reason}`, 4200);
}

function findOneCat(): void {
  if (phase !== 'playing') return;
  const cat = puzzle.cats.find(({ row, col }) => cells[row][col] !== 'cat');
  if (!cat) {
    showToast('All Pups Found!');
    return;
  }
  revealCatAt(cat.row, cat.col, 'The Pup helps you find a Pup！');
}

function resetCurrentLevel(): void {
  resetClickSequence();
  window.clearTimeout(finishTimer);
  finishTimer = undefined;
  window.clearInterval(timer);
  window.clearTimeout(boardEntranceTimer);
  hintedCell = undefined;
  const span = puzzleSpan(puzzle);
  cells = Array.from({ length: span }, () => Array<CellState>(span).fill('hidden'));
  givenCells = new Set<string>();
  wrongCells = new Set<string>();
  const initialClues = createInitialClues(puzzle);
  initialClues.forEach(({ row, col, state }) => {
    cells[row][col] = state;
    givenCells.add(`${row},${col}`);
  });
  fish = 3;
  mistakes = 0;
  found = initialClues.filter(({ state }) => state === 'cat').length;
  elapsed = 0;
  phase = 'playing';
  modeLabel.textContent = mode === 'daily' ? 'Challenge' : mode === 'hex' ? 'Hex' : 'Level';
  levelLabel.textContent = mode === 'daily' ? 'Daily' : formatLevelNumber(currentLevel.id);
  document.querySelector('#rules-body')!.innerHTML = puzzle.boardType === 'hex' ? hexRulesMarkup : squareRulesMarkup;
  timerLabel.textContent = '00:00';
  modal.classList.remove('visible', 'loss');
  modal.setAttribute('aria-hidden', 'true');
  renderFish();
  renderProgress();
  animateBoardEntrance = true;
  renderBoard();
  animateBoardEntrance = false;
  boardEntranceTimer = window.setTimeout(() => board.classList.remove('entering'), currentLevel.size * 95 + 500);
  timer = window.setInterval(() => {
    elapsed += 1;
    timerLabel.textContent = formatTime(elapsed);
  }, 1000);
}

function openMode(selectedMode: GameMode): void {
  mode = selectedMode;
  if (mode === 'main') {
    activeMainIndex = mainLevelIndex;
    currentLevel = getMainLevel(activeMainIndex);
  } else if (mode === 'hex') {
    activeHexIndex = hexLevelIndex;
    currentLevel = getHexLevel(activeHexIndex);
  } else {
    const today = new Date();
    activeDailyDateKey = dailyDateKey(today);
    currentLevel = selectDailyChallenge(activeDailyDateKey);
  }
  puzzle = levelToPuzzle(currentLevel);
  window.clearTimeout(menuCatTimer);
  modeScreen.hidden = true;
  gameScreen.hidden = false;
  resetCurrentLevel();
}

function showMenu(): void {
  resetClickSequence();
  window.clearInterval(timer);
  window.clearTimeout(finishTimer);
  window.clearTimeout(boardEntranceTimer);
  modal.classList.remove('visible', 'loss');
  modal.setAttribute('aria-hidden', 'true');
  phase = 'menu';
  gameScreen.hidden = true;
  modeScreen.hidden = false;
  updateMenu();
  scheduleMenuCats();
}

board.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary) return;
  const startCell = (event.target as HTMLElement).closest<HTMLButtonElement>('.cell');
  if (!startCell) return;
  cellDrag = {
    pointerId: event.pointerId,
    startCell,
    lastX: event.clientX,
    lastY: event.clientY,
    dragging: false,
    visited: new Set(),
  };
  board.setPointerCapture(event.pointerId);
});

board.addEventListener('pointermove', (event) => {
  if (!cellDrag || event.pointerId !== cellDrag.pointerId) return;
  const crossedCells = cellsAlongDrag(cellDrag.lastX, cellDrag.lastY, event.clientX, event.clientY);
  cellDrag.lastX = event.clientX;
  cellDrag.lastY = event.clientY;

  if (!cellDrag.dragging) {
    const startKey = `${cellDrag.startCell.dataset.row},${cellDrag.startCell.dataset.col}`;
    if (!crossedCells.some((cell) => `${cell.dataset.row},${cell.dataset.col}` !== startKey)) return;
    cellDrag.dragging = true;
    resetClickSequence();
    dragOverCell(cellDrag.startCell);
  }

  event.preventDefault();
  crossedCells.forEach(dragOverCell);
});

function finishCellDrag(event: PointerEvent): void {
  if (!cellDrag || event.pointerId !== cellDrag.pointerId) return;
  const { dragging, startCell } = cellDrag;
  cellDrag = undefined;
  if (event.type !== 'pointerup') return;

  suppressPointerClicksUntil = Date.now() + 600;
  if (!dragging) handleCellClick(startCell, event.timeStamp);
}

board.addEventListener('pointerup', finishCellDrag);
board.addEventListener('pointercancel', finishCellDrag);

function handleCellClick(target: HTMLButtonElement, timeStamp: number): void {
  const row = Number(target.dataset.row);
  const col = Number(target.dataset.col);
  const cellKey = `${row},${col}`;
  if (phase !== 'playing' || cells[row][col] === 'cat' || givenCells.has(cellKey)) {
    resetClickSequence();
    return;
  }

  const repeatedQuickly = lastCellClick?.cellKey === cellKey
    && timeStamp - lastCellClick.timeStamp <= doubleClickWindow;
  if (repeatedQuickly && lastCellClick?.revealed) {
    lastCellClick.timeStamp = timeStamp;
    return;
  }
  if (repeatedQuickly) {
    lastCellClick = { cellKey, timeStamp, revealed: true };
    revealCell(row, col);
    return;
  }

  lastCellClick = { cellKey, timeStamp, revealed: false };
  toggleMark(row, col);
}

board.addEventListener('click', (event) => {
  if (event.detail > 0 && Date.now() < suppressPointerClicksUntil) {
    event.preventDefault();
    return;
  }
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('.cell');
  if (target) handleCellClick(target, event.timeStamp);
});

board.addEventListener('dblclick', (event) => event.preventDefault());
document.querySelector('#main-mode-button')?.addEventListener('click', () => openMode('main'));
document.querySelector('#daily-mode-button')?.addEventListener('click', () => openMode('daily'));
document.querySelector('#hex-mode-button')?.addEventListener('click', () => openMode('hex'));
document.querySelector('#home-button')?.addEventListener('click', showMenu);
hintButton.addEventListener('click', showLogicalHint);
findCatButton.addEventListener('click', findOneCat);

const soundButtons = [
  document.querySelector<HTMLButtonElement>('#menu-sound-button')!,
  document.querySelector<HTMLButtonElement>('#sound-button')!,
];

function updateSoundButtons(): void {
  soundButtons.forEach((button) => {
    button.textContent = sound.muted ? '♩' : '♪';
    button.classList.toggle('muted', sound.muted);
    button.setAttribute('aria-label', sound.muted ? 'Unmute' : 'Mute');
  });
}

updateSoundButtons();
document.addEventListener('pointerdown', () => sound.unlock(), { once: true });
soundButtons.forEach((button) => button.addEventListener('click', () => {
  sound.setMuted(!sound.muted);
  updateSoundButtons();
}));

document.querySelector('#rules-toggle')?.addEventListener('click', (event) => {
  const button = event.currentTarget as HTMLButtonElement;
  const expanded = button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', String(!expanded));
  document.querySelector('#rules-body')?.classList.toggle('collapsed', expanded);
  document.querySelector('#rule-arrow')!.textContent = expanded ? '⌄' : '⌃';
});

resultButton.addEventListener('click', () => {
  if (phase === 'lost') {
    resetCurrentLevel();
    return;
  }
  if (mode === 'main' && activeMainIndex < MAIN_LEVEL_COUNT - 1) {
    openMode('main');
  } else if (mode === 'hex' && activeHexIndex < HEX_LEVEL_COUNT - 1) {
    openMode('hex');
  } else showMenu();
});

createMenuBoard();
showMenu();
