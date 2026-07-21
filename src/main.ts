import './style.css';
import { calculateStars, createInitialClues, createPuzzle, formatTime, hasCat, LEVELS, type CellState, type Puzzle } from './game';
import { sound } from './audio';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root not found');

type Phase = 'playing' | 'won' | 'lost';

let levelIndex = Number(localStorage.getItem('meowdoku-level') ?? 0) % LEVELS.length;
let bestStars = JSON.parse(localStorage.getItem('meowdoku-stars') ?? '{}') as Record<number, number>;
let puzzle: Puzzle;
let cells: CellState[][];
let givenCells = new Set<string>();
let fish = 3;
let mistakes = 0;
let found = 0;
let elapsed = 0;
let phase: Phase = 'playing';
let animateBoardEntrance = false;
let boardEntranceTimer: number | undefined;
let timer: number | undefined;
let messageTimer: number | undefined;
let finishTimer: number | undefined;
let lastCellClick: { cellKey: string; timeStamp: number; revealed: boolean } | undefined;
const doubleClickWindow = 300;

app.innerHTML = `
  <main class="game-shell">
    <header class="topbar">
      <button class="round-button" id="home-button" aria-label="重新开始">⌂</button>
      <div class="header-stat">
        <span>关卡</span><strong id="level-label">01</strong>
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

const board = document.querySelector<HTMLDivElement>('#board')!;
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

function catArt(className = ''): string {
  return `<img class="cat-art ${className}" src="./images/cat-token.png" alt="" aria-hidden="true" draggable="false">`;
}

function renderFish(): void {
  fishDisplay.innerHTML = Array.from({ length: 3 }, (_, index) => `<span class="fish ${index >= fish ? 'empty' : ''}" aria-label="${index < fish ? '小鱼' : '已失去的小鱼'}"><i></i></span>`).join('');
}

function renderProgress(): void {
  progressLabel.textContent = `${found} / ${puzzle.size}`;
  progressFill.style.width = `${(found / puzzle.size) * 100}%`;
}

function renderBoard(): void {
  board.style.setProperty('--size', puzzle.size.toString());
  board.className = `board size-${puzzle.size}${animateBoardEntrance ? ' entering' : ''}`;
  board.innerHTML = cells.flatMap((rowStates, row) => rowStates.map((state, col) => {
    const region = puzzle.regions[row][col];
    const isGiven = givenCells.has(`${row},${col}`);
    return `<button class="cell ${state} ${isGiven ? 'given' : ''}" style="--cell-color:${puzzle.palette[region]};--enter-row:${row}" data-row="${row}" data-col="${col}" role="gridcell" aria-label="第 ${row + 1} 行第 ${col + 1} 列${isGiven ? '，初始提示' : ''}${state === 'marked' ? '，已标记没有猫' : state === 'cat' ? '，找到猫咪' : ''}">
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
  cell.className = `cell ${state} ${isGiven ? 'given' : ''}`;
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

function showToast(text: string): void {
  window.clearTimeout(messageTimer);
  toast.textContent = text;
  toast.classList.add('show');
  messageTimer = window.setTimeout(() => toast.classList.remove('show'), 1350);
}

function revealAllCats(): void {
  puzzle.cats.forEach(({ row, col }) => {
    if (cells[row][col] !== 'cat') cells[row][col] = 'cat';
  });
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
  const config = LEVELS[levelIndex];
  const stars = won ? calculateStars(elapsed, mistakes, config.targetSeconds) : 0;
  if (won) {
    bestStars[levelIndex] = Math.max(bestStars[levelIndex] ?? 0, stars);
    localStorage.setItem('meowdoku-stars', JSON.stringify(bestStars));
    sound.win();
  } else sound.lose();

  resultMascot.innerHTML = catArt(won ? 'happy' : 'sad');
  resultEyebrow.textContent = won ? 'PURR-FECT!' : '小鱼吃光啦…';
  resultTitle.textContent = won ? '猫咪全部找到！' : '别灰心，再试一次';
  resultStars.innerHTML = Array.from({ length: 3 }, (_, index) => `<span class="result-star ${index < stars ? 'earned' : ''}" style="--delay:${index * 0.15}s">★</span>`).join('');
  resultStats.innerHTML = won
    ? `<div><span>用时</span><strong>${formatTime(elapsed)}</strong></div><div><span>失误</span><strong>${mistakes} 次</strong></div>`
    : `<p>仔细观察行、列和颜色区域，<br>猫咪一定不会挨在一起哦！</p>`;
  resultButton.textContent = won ? (levelIndex === LEVELS.length - 1 ? '从头挑战' : '下一关 →') : '↻　再来一次';
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
  const marking = cells[row][col] === 'hidden';
  cells[row][col] = marking ? 'marked' : 'hidden';
  if (marking) sound.mark();
  else sound.unmark();
  animateCellClick(updateCell(row, col));
}

function revealCell(row: number, col: number): void {
  if (phase !== 'playing' || cells[row][col] === 'cat' || givenCells.has(`${row},${col}`)) return;
  if (hasCat(puzzle, row, col)) {
    cells[row][col] = 'cat';
    found += 1;
    sound.cat();
    animateCellClick(updateCell(row, col));
    renderProgress();
    showToast(['喵！找到啦！', '好眼力！', '猫咪侦探真棒！'][found % 3]);
    if (found === puzzle.size) scheduleFinish(true, 480);
  } else {
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

function startLevel(): void {
  resetClickSequence();
  window.clearTimeout(finishTimer);
  finishTimer = undefined;
  window.clearInterval(timer);
  window.clearTimeout(boardEntranceTimer);
  const config = LEVELS[levelIndex];
  puzzle = createPuzzle(config.size, Date.now() + levelIndex * 7919);
  cells = Array.from({ length: config.size }, () => Array<CellState>(config.size).fill('hidden'));
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
  levelLabel.textContent = (levelIndex + 1).toString().padStart(2, '0');
  timerLabel.textContent = '00:00';
  modal.classList.remove('visible', 'loss');
  modal.setAttribute('aria-hidden', 'true');
  renderFish();
  renderProgress();
  animateBoardEntrance = true;
  renderBoard();
  animateBoardEntrance = false;
  boardEntranceTimer = window.setTimeout(() => {
    board.classList.remove('entering');
  }, config.size * 95 + 500);
  timer = window.setInterval(() => {
    elapsed += 1;
    timerLabel.textContent = formatTime(elapsed);
  }, 1000);
}

board.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('.cell');
  if (!target) return;
  const row = Number(target.dataset.row);
  const col = Number(target.dataset.col);
  const cellKey = `${row},${col}`;
  if (phase !== 'playing' || cells[row][col] === 'cat' || givenCells.has(cellKey)) {
    resetClickSequence();
    return;
  }

  const repeatedQuickly = lastCellClick?.cellKey === cellKey
    && event.timeStamp - lastCellClick.timeStamp <= doubleClickWindow;

  if (repeatedQuickly && lastCellClick?.revealed) {
    lastCellClick.timeStamp = event.timeStamp;
    return;
  }
  if (repeatedQuickly) {
    lastCellClick = { cellKey, timeStamp: event.timeStamp, revealed: true };
    revealCell(row, col);
    return;
  }

  lastCellClick = { cellKey, timeStamp: event.timeStamp, revealed: false };
  toggleMark(row, col);
});

board.addEventListener('dblclick', (event) => event.preventDefault());

document.querySelector('#home-button')?.addEventListener('click', startLevel);
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
  if (phase === 'won') {
    levelIndex = (levelIndex + 1) % LEVELS.length;
    localStorage.setItem('meowdoku-level', String(levelIndex));
  }
  startLevel();
});

startLevel();
