import './style.css';
import { calculateStars, createInitialClues, formatTime, hasCat, puzzleSpan, type CellState, type Puzzle } from './game';
import { findLogicHints, type LogicHint } from './logic';
import {
  CHALLENGE_LEVEL_COUNT,
  formatLevelNumber,
  getDailyChallenge,
  getHexLevel,
  getMainLevel,
  HEX_LEVEL_COUNT,
  levelToPuzzle,
  MAIN_LEVEL_COUNT,
  type GameMode,
  type StoredLevel,
} from './levels';
import { sound } from './audio';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root not found');

type Phase = 'menu' | 'playing' | 'won' | 'lost';

const storedMainProgress = Number(localStorage.getItem('meowdoku-main-level') ?? localStorage.getItem('meowdoku-level') ?? 0);
let mainLevelIndex = Math.max(0, Math.min(MAIN_LEVEL_COUNT - 1, Number.isFinite(storedMainProgress) ? storedMainProgress : 0));
const storedHexProgress = Number(localStorage.getItem('meowdoku-hex-level') ?? 0);
let hexLevelIndex = Math.max(0, Math.min(HEX_LEVEL_COUNT - 1, Number.isFinite(storedHexProgress) ? storedHexProgress : 0));
let bestStars = JSON.parse(localStorage.getItem('meowdoku-stars') ?? '{}') as Record<number, number>;
let hexBestStars = JSON.parse(localStorage.getItem('meowdoku-hex-stars') ?? '{}') as Record<number, number>;
let mode: GameMode = 'main';
let currentLevel: StoredLevel;
let activeMainIndex = mainLevelIndex;
let activeHexIndex = hexLevelIndex;
let puzzle: Puzzle;
let cells: CellState[][];
let givenCells = new Set<string>();
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
    <div class="brand-mark"><img src="./images/app-icon.png" alt="" aria-hidden="true"></div>
    <div class="mode-heading">
      <p>MEOWDOKU</p>
      <h1 id="game-title">猫咪数独</h1>
    </div>
    <div class="mode-list" aria-label="选择游戏模式">
      <button class="mode-card main-mode" id="main-mode-button">
        <span class="mode-card-icon"><img src="./images/cat-token.png" alt="" aria-hidden="true"></span>
        <span class="mode-card-copy">
          <small>主线关卡</small>
          <strong id="main-entry-title">第 001 关</strong>
          <span id="main-entry-progress">进度 1 / 1000</span>
        </span>
        <span class="mode-card-arrow" aria-hidden="true">›</span>
      </button>
      <button class="mode-card daily-mode" id="daily-mode-button">
        <span class="mode-card-icon challenge-icon" aria-hidden="true">◆</span>
        <span class="mode-card-copy">
          <small>复杂关</small>
          <strong>每日挑战</strong>
          <span>今日 9 × 9 · 题库 ${CHALLENGE_LEVEL_COUNT} 关</span>
        </span>
        <span class="mode-card-arrow" aria-hidden="true">›</span>
      </button>
      <button class="mode-card hex-mode" id="hex-mode-button">
        <span class="mode-card-icon hex-icon" aria-hidden="true"><span>⬡</span></span>
        <span class="mode-card-copy">
          <small>六边形主线</small>
          <strong id="hex-entry-title">第 001 关</strong>
          <span id="hex-entry-progress">进度 1 / ${HEX_LEVEL_COUNT}</span>
        </span>
        <span class="mode-card-arrow" aria-hidden="true">›</span>
      </button>
    </div>
    <p class="catalog-note">主线题库 ${MAIN_LEVEL_COUNT} 关</p>
  </section>

  <main class="game-shell" id="game-screen" hidden>
    <header class="topbar">
      <button class="round-button" id="home-button" aria-label="返回模式选择">←</button>
      <div class="header-stat">
        <span id="mode-label">关卡</span><strong id="level-label">001</strong>
      </div>
      <div class="header-stat">
        <span>用时</span><strong id="timer-label">00:00</strong>
      </div>
      <button class="round-button" id="sound-button" aria-label="静音">♪</button>
    </header>

    <section class="status-card">
      <div class="cat-counter"><img class="counter-cat" src="./images/cat-token.png" alt="" aria-hidden="true"><strong id="progress-label">0 / 5</strong></div>
      <div class="fish-info" id="fish-display"></div>
    </section>

    <section class="rules-card">
      <button class="rules-toggle" id="rules-toggle" aria-expanded="true" aria-label="展开或收起规则"><span>玩法提示</span><span id="rule-arrow">⌃</span></button>
      <div class="rules-body" id="rules-body">
        <div><span class="rule-grid">×××<br>×🐱×<br>×××</span><p>一种颜色<br><strong>一只猫</strong></p></div>
        <div><span class="rule-grid">×🐱×<br>×××<br>×××</span><p>同行同列<br><strong>各一只</strong></p></div>
        <div><span class="rule-grid">×××<br>×🐱×<br>×××</span><p>猫咪之间<br><strong>不能接触</strong></p></div>
      </div>
    </section>

    <section class="game-card">
      <div class="board-wrap">
        <div class="board" id="board" role="grid" aria-label="猫咪数独棋盘"></div>
        <div class="toast" id="toast" role="status"></div>
      </div>
      <div class="progress-track" aria-hidden="true"><div class="progress-fill" id="progress-fill"></div></div>
    </section>

    <div class="assist-actions" aria-label="游戏辅助">
      <button class="assist-button hint-button" id="hint-button"><span class="assist-icon">?</span><span>提示</span></button>
      <button class="assist-button find-button" id="find-cat-button"><img src="./images/cat-token.png" alt="" aria-hidden="true"><span>找到猫</span></button>
    </div>

    <p class="tap-hint"><span class="tap-demo">×</span> 单击标记 / 取消 ×　·　双击揭开</p>
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
const progressFill = document.querySelector<HTMLElement>('#progress-fill')!;
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

function catArt(className = ''): string {
  return `<img class="cat-art ${className}" src="./images/cat-token.png" alt="" aria-hidden="true" draggable="false">`;
}

function createMenuBoard(): void {
  menuBoardTrack.innerHTML = Array.from({ length: 96 }, (_, index) => `
    <span class="menu-board-cell ${index % 13 === 2 || index % 17 === 7 ? 'hopping' : ''}" style="--hop-delay:${(index % 11) * -0.37}s">
      <span class="menu-cell-inner">
        <span class="menu-cell-face"></span>
        <span class="menu-cell-face menu-cell-cat"><img src="./images/cat-token.png" alt=""></span>
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
  document.querySelector('#main-entry-title')!.textContent = `第 ${formatLevelNumber(mainLevelIndex + 1)} 关`;
  document.querySelector('#main-entry-progress')!.textContent = `进度 ${mainLevelIndex + 1} / ${MAIN_LEVEL_COUNT}`;
  document.querySelector('#hex-entry-title')!.textContent = `第 ${formatLevelNumber(hexLevelIndex + 1)} 关`;
  document.querySelector('#hex-entry-progress')!.textContent = `进度 ${hexLevelIndex + 1} / ${HEX_LEVEL_COUNT}`;
}

function renderFish(): void {
  fishDisplay.innerHTML = Array.from({ length: 3 }, (_, index) => `<span class="fish ${index >= fish ? 'empty' : ''}" aria-label="${index < fish ? '小鱼' : '已失去的小鱼'}"><i></i></span>`).join('');
}

function renderProgress(): void {
  progressLabel.textContent = `${found} / ${puzzle.cats.length}`;
  progressFill.style.width = `${(found / puzzle.cats.length) * 100}%`;
}

function cellClass(state: CellState, row: number, col: number): string {
  const cellKey = `${row},${col}`;
  return `cell ${state}${givenCells.has(cellKey) ? ' given' : ''}${hintedCell === cellKey ? ' hinted' : ''}`;
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
      layoutStyle = `;left:${(1.5 * (q + radius) / widthUnits) * 100}%;top:${((r + q / 2 + radius + 0.5) / heightUnits) * 100}%;width:${(2 / widthUnits) * 100}%;height:${(1 / heightUnits) * 100}%`;
    }
    const cellName = puzzle.boardType === 'hex' ? `轴向格 ${row + 1}-${col + 1}` : `第 ${row + 1} 行第 ${col + 1} 列`;
    return `<button class="${cellClass(state, row, col)}" style="--cell-color:${puzzle.palette[region]};--enter-row:${row}${layoutStyle}" data-row="${row}" data-col="${col}" role="gridcell" aria-label="${cellName}${isGiven ? '，初始提示' : ''}${state === 'marked' ? '，已标记没有猫' : state === 'cat' ? '，找到猫咪' : ''}">
      ${state === 'marked' ? '<span class="x-mark">×</span>' : ''}
      ${state === 'cat' ? catArt() : ''}
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
    `第 ${row + 1} 行第 ${col + 1} 列${isGiven ? '，初始提示' : ''}${state === 'marked' ? '，已标记没有猫' : state === 'cat' ? '，找到猫咪' : ''}`,
  );
  cell.innerHTML = state === 'marked' ? '<span class="x-mark">×</span>' : state === 'cat' ? catArt() : '';
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
  const stars = won ? calculateStars(elapsed, mistakes, currentLevel.targetSeconds) : 0;
  if (won) {
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
    }
    sound.win();
  } else sound.lose();

  resultMascot.innerHTML = catArt(won ? 'happy' : 'sad');
  resultEyebrow.textContent = won ? 'PURR-FECT!' : '小鱼吃光啦…';
  resultTitle.textContent = won ? '猫咪全部找到！' : '别灰心，再试一次';
  resultStars.innerHTML = Array.from({ length: 3 }, (_, index) => `<span class="result-star ${index < stars ? 'earned' : ''}" style="--delay:${index * 0.15}s">★</span>`).join('');
  resultStats.innerHTML = won
    ? `<div><span>用时</span><strong>${formatTime(elapsed)}</strong></div><div><span>失误</span><strong>${mistakes} 次</strong></div>`
    : '<p>当前棋盘已经保留，重试会回到同一道题。</p>';
  if (!won) resultButton.textContent = '↻　再来一次';
  else if ((mode === 'main' && activeMainIndex < MAIN_LEVEL_COUNT - 1)
    || (mode === 'hex' && activeHexIndex < HEX_LEVEL_COUNT - 1)) resultButton.textContent = '下一关　›';
  else resultButton.textContent = '返回首页';
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
  if (marking) sound.mark();
  else sound.unmark();
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
  toggleMark(Number(cell.dataset.row), Number(cell.dataset.col));
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
    revealCatAt(row, col, ['喵！找到啦！', '好眼力！', '猫咪侦探真棒！'][found % 3]);
  } else {
    clearHint();
    cells[row][col] = 'marked';
    mistakes += 1;
    fish -= 1;
    sound.miss();
    const cell = updateCell(row, col);
    animateCellClick(cell);
    renderFish();
    showToast('这里没有猫，失去一条小鱼！');
    cell?.classList.add('mistake');
    if (fish === 0) scheduleFinish(false, 650);
  }
}

function ruleLabel(hint: LogicHint): string {
  return hint.rule === 'base' ? '基础规则' : `推论 ${hint.rule}`;
}

function showLogicalHint(): void {
  if (phase !== 'playing') return;
  clearHint();

  const incorrectMark = puzzle.cats.find(({ row, col }) => cells[row][col] === 'marked');
  if (incorrectMark) {
    hintedCell = `${incorrectMark.row},${incorrectMark.col}`;
    updateCell(incorrectMark.row, incorrectMark.col);
    showToast('这个叉号会导致矛盾，请先取消标记', 3200);
    return;
  }

  const hint = findLogicHints(puzzle, cells).find((candidate) =>
    candidate.action === 'cat' ? hasCat(puzzle, candidate.row, candidate.col) : !hasCat(puzzle, candidate.row, candidate.col));
  if (!hint) {
    showToast('当前没有可用的推论 0-4', 2600);
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
    showToast('所有猫咪都已经找到了');
    return;
  }
  revealCatAt(cat.row, cat.col, '帮你找到一只猫咪！');
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
  modeLabel.textContent = mode === 'daily' ? '挑战' : mode === 'hex' ? '六边形' : '关卡';
  levelLabel.textContent = mode === 'daily' ? '今日' : formatLevelNumber(currentLevel.id);
  document.querySelector('#rules-body')!.innerHTML = puzzle.boardType === 'hex'
    ? '<div><span class="rule-grid hex-rule">⬡</span><p>每种颜色<br><strong>一只猫</strong></p></div><div><span class="rule-grid hex-rule">╱─╲</span><p>三个轴向<br><strong>各一只</strong></p></div><div><span class="rule-grid hex-rule">⬡⬡</span><p>猫咪周围<br><strong>不能有猫</strong></p></div>'
    : '<div><span class="rule-grid">×××<br>×🐱×<br>×××</span><p>一种颜色<br><strong>一只猫</strong></p></div><div><span class="rule-grid">×🐱×<br>×××<br>×××</span><p>同行同列<br><strong>各一只</strong></p></div><div><span class="rule-grid">×××<br>×🐱×<br>×××</span><p>猫咪之间<br><strong>不能接触</strong></p></div>';
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
  } else currentLevel = getDailyChallenge();
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

const soundButton = document.querySelector<HTMLButtonElement>('#sound-button')!;
soundButton.textContent = sound.muted ? '♩' : '♪';
soundButton.classList.toggle('muted', sound.muted);
document.addEventListener('pointerdown', () => sound.unlock(), { once: true });
soundButton.addEventListener('click', (event) => {
  sound.setMuted(!sound.muted);
  (event.currentTarget as HTMLButtonElement).textContent = sound.muted ? '♩' : '♪';
  (event.currentTarget as HTMLButtonElement).classList.toggle('muted', sound.muted);
});

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
