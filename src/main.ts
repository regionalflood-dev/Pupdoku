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
  './images/godz-token.png',
  './images/asian-token.png',
  './images/bee-token.png',
  './images/cyke-token.png',
  './images/darth-token.png',
  './images/dp-token.png',
  './images/jugs-token.png',
  './images/kong-token.png',
  './images/mag-token.png',
  './images/sfg-token.png',
  './images/snorlax-token.png',
  './images/spider-token.png',
  './images/squirt-token.png',
  './images/super-token.png',
  './images/leo-token.png',
  './images/wolf-token.png',
  './images/wolv-token.png',
  './images/panda-token.png',
  './images/pika-token.png',
  './images/shark-token.png',
  './images/mario-token.png',
  './images/sailor-token.png',
  './images/ryu-token.png',
  './images/ciri-pup.png',
];

interface PortraitItem {
  id: string;
  name: string;
  image: string;
  cost: number;
}

const STORE_PORTRAITS: PortraitItem[] = [
  { id: 'pup', name: 'Standard Pup Icon', image: './images/pup-icon.png', cost: 0 },
  { id: 'hulk', name: 'Incredible Hulk Pup', image: './images/hulk-token.png', cost: 15 },
  { id: 'fred', name: 'Nightmare on C-Street', image: './images/fred-token.png', cost: 15 },
  { id: 'asian', name: 'Asian Pup', image: './images/asian-token.png', cost: 15 },
  { id: 'dog', name: 'Naked Ciri Pup', image: './images/dog-token.png', cost: 20 },
  { id: 'flash', name: 'Speedy Flash', image: './images/flash-token.png', cost: 20 },
  { id: 'wolf', name: 'Wolf Pup', image: './images/wolf-token.png', cost: 20 },
  { id: 'pika', name: 'Pupachu', image: './images/pika-token.png', cost: 20 },
  { id: 'bee', name: 'Bee Pup', image: './images/bee-token.png', cost: 25 },
  { id: 'leo', name: 'TMN Pup Leo', image: './images/leo-token.png', cost: 25 },
  { id: 'darth', name: 'Sith Lord Pup', image: './images/darth-token.png', cost: 25 },
  { id: 'shark', name: 'Great White Shark', image: './images/shark-token.png', cost: 25 },
  { id: 'spider', name: 'Spider-Pup', image: './images/spider-token.png', cost: 30 },
  { id: 'super', name: 'Super Pup', image: './images/super-token.png', cost: 30 },
  { id: 'dp', name: 'Mercenary Pup', image: './images/dp-token.png', cost: 30 },
  { id: 'mario', name: 'Plumber Pup', image: './images/mario-token.png', cost: 30 },
  { id: 'cyke', name: 'Cyclops Pup', image: './images/cyke-token.png', cost: 40 },
  { id: 'mag', name: 'Cirineto', image: './images/mag-token.png', cost: 40 },
  { id: 'jugs', name: 'The Cirinaut!', image: './images/jugs-token.png', cost: 45 },
  { id: 'sailor', name: 'Sailor Pup', image: './images/sailor-token.png', cost: 45 },
  { id: 'godz', name: 'Kaiju Pup', image: './images/godz-token.png', cost: 45 },
  { id: 'kong', name: 'Skull Island Pup', image: './images/kong-token.png', cost: 45 },
  { id: 'squirt', name: 'Squirtle Squad Pup', image: './images/squirt-token.png', cost: 50 },
  { id: 'ryu', name: 'Street Fighter Pup', image: './images/ryu-token.png', cost: 50 },
  { id: 'sfg', name: 'Ciri the Giant', image: './images/sfg-token.png', cost: 50 },
  { id: 'wolv', name: 'Wolverine Pup', image: './images/wolv-token.png', cost: 50 },
  { id: 'snorlax', name: 'Bigguns Pup', image: './images/snorlax-token.png', cost: 100 },
  { id: 'thanos', name: 'Mad Titan Pup', image: './images/thanos-token.png', cost: 100 },
  { id: 'ciri', name: 'Ciri Pup', image: './images/ciri-baby.png', cost: 999 },
  { id: 'panda', name: 'Expensive Panda Pup', image: './images/panda-token.png', cost: 999 },
];

const unlockedPortraitsKey = 'meowdoku-unlocked-portraits';
const equippedPortraitKey = 'meowdoku-equipped-portrait';

let unlockedPortraits: string[] = JSON.parse(localStorage.getItem(unlockedPortraitsKey) ?? '["pup"]');
let equippedPortraitId: string = localStorage.getItem(equippedPortraitKey) ?? 'pup';

let lastIndex: number = -1; // Keeps track of the last selection

function getNextRandomImage(): string {
  if (DOG_IMAGES.length <= 1) return DOG_IMAGES[0] || "";

  let randomIndex: number;

  do {
    randomIndex = Math.floor(Math.random() * DOG_IMAGES.length);
  } while (randomIndex === lastIndex);

  lastIndex = randomIndex;

  return DOG_IMAGES[randomIndex];
}

const ruleCat = '<img class="rule-cat" src="./images/squirt-token.png" alt="">';
const squareRuleCells = '<i></i>'.repeat(9);
const squareRulesMarkup = `
<div><span class="rule-visual square-rule-visual square-color-rule" aria-hidden="true">${squareRuleCells}${ruleCat}</span><p>Each Color<br><strong>Only One Pup</strong></p></div>
  <div><span class="rule-visual square-rule-visual square-axis-rule" aria-hidden="true">${squareRuleCells}${ruleCat}</span><p>Each Row/Column<br><strong>Only One Pup</strong></p></div>
  <div><span class="rule-visual square-rule-visual square-neighbor-rule" aria-hidden="true">${squareRuleCells}${ruleCat}</span><p>Each Pup Cannot<br><strong>Touch Another Pup</strong></p></div>
`;
const hexNeighborCells = '<i class="hex-cell center"></i><i class="hex-cell blocked north"></i><i class="hex-cell blocked north-east"></i><i class="hex-cell blocked south-east"></i><i class="hex-cell blocked south"></i><i class="hex-cell blocked south-west"></i><i class="hex-cell blocked north-west"></i>';
const hexRulesMarkup = `
  <div><span class="rule-visual hex-color-rule" aria-hidden="true"><i class="hex-cell apex"></i><i class="hex-cell blocked lower-left"></i><i class="hex-cell blocked lower-right"></i>${ruleCat}</span><p>Each Color<br><strong>Only One Pup</strong></p></div>
  <div><span class="rule-visual hex-axis-rule" aria-hidden="true"><i class="hex-cell"></i><b></b><b></b><b></b>${ruleCat}</span><p>Each Direction<br><strong>Only One Pup</strong></p></div>
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
<div class="menu-utility-buttons">
  <button class="round-button menu-sound-button"
    id="menu-sound-button"
    aria-label="Mute"
    title="Unmute/Mute sound">♪</button>

  <button class="round-button menu-reset-button"
    id="menu-reset-button"
    aria-label="Reset game progress"
    title="Reset game progress">☠️</button>
</div>
    <div class="brand-mark" id="brand-avatar-container" style="cursor: pointer; position: relative;" title="Click to change your avatar">
      <img id="menu-avatar-display" src="./images/pup-icon.png" alt="Equipped Avatar" aria-hidden="true" style="width: 100%; height: 100%; object-fit: contain; border-radius: 4px;">
      <span style="position: absolute; bottom: -5px; right: -5px; background: #ffd15c; font-size: 0.7rem; padding: 2px 5px; border-radius: 10px; color: #333; font-weight: bold; border: 1px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">⚙</span>
    </div>
    <div class="mode-heading">
      <p>CIRI PUP</p>
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
          <small id="daily-entry-status">Updated Daily</small>
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
      <div class="cat-counter">
        <img id="game-avatar-display" class="counter-cat" src="./images/dog-token.png" alt="" aria-hidden="true">
        <strong id="progress-label">0 / 5</strong>
      </div>
      <div class="fish-info" id="fish-display"></div>
      <button class="round-button" id="in-game-reset-button" aria-label="Reset Level">↻</button>
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
      <button class="assist-button hint-button" id="hint-button"><span class="assist-icon">?</span><span>Hint</span><img class="hint-bone-icon" src="./images/bone-token.png" alt="Bone"></button>
      <button class="assist-button find-button" id="find-cat-button"><img class="thanos-token" src="./images/thanos-token.png" alt="" aria-hidden="true"><span>Pup Locator</span><img class="bone-token" src="./images/bone-token.png" alt="" aria-hidden="true"></button>
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



<div class="modal-backdrop" id="reset-progress-modal" aria-hidden="true">
  <section
    class="result-card reset-progress-card"
    role="dialog"
    aria-modal="true"
    aria-labelledby="reset-progress-title"
    aria-describedby="reset-progress-description"
  >
    <div class="result-mascot">
      <img src="./images/pup-icon.png" alt="" />
    </div>
<br />
    <p class="result-eyebrow" id="reset-progress-eyebrow">
      ARE YOU SURE?
    </p>

    <h2 id="reset-progress-title">Reset All Progress?</h2>

    <p id="reset-progress-description">
      This will erase your unlocked levels, earned bones, star records,
      daily puzzle history, and collected pups. You'll start over at Level 1.
    </p>

    <div class="reset-progress-actions">
      <button
        class="primary-button reset-confirm-button"
        id="confirm-reset-progress-button"
      >
        Continue to Confirmation
      </button>

      <button
        class="primary-button reset-cancel-button"
        id="cancel-reset-progress-button"
      >
        Keep My Progress
      </button>
    </div>
  </section>
</div>


  <div class="modal-backdrop" id="store-modal" aria-hidden="true">
    <section class="result-card store-card" role="dialog" aria-modal="true" style="max-width: 520px; max-height: 85vh; overflow-y: auto;">

<div class="store-top-icon">
  <img src="./images/ccw.png" alt="CCW" />
</div>

      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 15px;">
        <h2 style="margin: 0; font-size: 1.5rem;">Pup Gallery Store</h2>
        <button class="round-button" id="close-store-button" aria-label="Close Store">×</button>
      </div>
      <p style="margin: 0 0 15px 0; font-size: 0.85rem; color: #666; text-align: center;">Use <strong>Bones</strong> to purchase Pup Icons then click on any <strong>Unlocked</strong> icon to equip it as your profile avatar!</p>
      <div class="store-grid" id="store-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; width: 100%;"></div>
    </section>
  </div>

<div class="modal-backdrop find-pup-backdrop" id="find-pup-modal" aria-hidden="true">
  <section class="result-card find-pup-card"
           role="dialog"
           aria-modal="true"
           aria-labelledby="find-pup-title">

    <div class="result-mascot find-pup-mascot">
      <img src="${getNextRandomImage()}" alt="Ciri Pup">
    </div>

    <p class="result-eyebrow" id="find-pup-eyebrow">PUP DISCOVERED!</p>
    <h2 id="find-pup-title">You Found a Pup!</h2>
    <p class="find-pup-message" id="find-pup-message"></p>

    <div class="find-pup-cost" id="find-pup-cost"></div>

    <button class="primary-button" id="find-pup-close">
      Continue Playing
    </button>
  </section>
</div>


<div class="modal-backdrop find-pup-backdrop" id="restart-level-modal" aria-hidden="true">
  <section class="result-card find-pup-card restart-level-card"
           role="dialog"
           aria-modal="true"
           aria-labelledby="restart-level-title">
    <div class="result-mascot find-pup-mascot">
      <img src="./images/snorlax-token.png" alt="Pup">
    </div>

    <p class="result-eyebrow">TAKE A PAWSE!</p>
    <h2 id="restart-level-title">Restart This Level?</h2>

    <p class="find-pup-message">
      Want a fresh start? Your current board progress and timer
      will be reset. Give this puzzle another try!
    </p>

    <div class="restart-level-actions">
      <button class="primary-button" id="confirm-level-restart">
        ↻ Restart Level
      </button>
      <button class="restart-cancel-button" id="cancel-level-restart">
        Keep Playing
      </button>
    </div>
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
const storeModal = document.querySelector<HTMLElement>('#store-modal')!;
const storeGrid = document.querySelector<HTMLElement>('#store-grid')!;

const menuAvatarDisplay = document.querySelector<HTMLImageElement>('#menu-avatar-display')!;
const gameAvatarDisplay = document.querySelector<HTMLImageElement>('#menu-avatar-display')!;


const findPupModal = document.querySelector<HTMLElement>('#find-pup-modal')!;
const findPupEyebrow = document.querySelector<HTMLElement>('#find-pup-eyebrow')!;
const findPupTitle = document.querySelector<HTMLElement>('#find-pup-title')!;
const findPupMessage = document.querySelector<HTMLElement>('#find-pup-message')!;
const findPupCost = document.querySelector<HTMLElement>('#find-pup-cost')!;
const findPupClose = document.querySelector<HTMLButtonElement>('#find-pup-close')!;

function showFindPupPopup(
  title: string,
  message: string,
  bonesSpent?: number
): void {
  findPupEyebrow.textContent = bonesSpent === undefined
    ? 'TREASURE BONES'
    : 'PUP DISCOVERED!';

  findPupTitle.textContent = title;
  findPupMessage.textContent = message;

  if (bonesSpent !== undefined) {
    findPupCost.innerHTML = `
      <div class="find-pup-cost-row">
        <span>Bones Eaten</span>
        <strong>
          −${bonesSpent}
          <img src="./images/bone-token.png" alt="bones">
        </strong>
      </div>
      <div class="find-pup-cost-row balance">
        <span>Bones Remaining</span>
        <strong>
          ${totalFish}
          <img src="./images/bone-token.png" alt="bones">
        </strong>
      </div>
    `;
  } else {
    findPupCost.innerHTML = `
      <p>Collect more bones by completing levels!</p>
    `;
  }

  findPupModal.classList.add('visible');
  findPupModal.setAttribute('aria-hidden', 'false');
}

function closeFindPupPopup(): void {
  findPupModal.classList.remove('visible');
  findPupModal.setAttribute('aria-hidden', 'true');
}

findPupClose.addEventListener('click', closeFindPupPopup);

findPupModal.addEventListener('click', (event) => {
  if (event.target === findPupModal) {
    closeFindPupPopup();
  }
});



const restartLevelModal =
  document.querySelector<HTMLElement>('#restart-level-modal')!;

const confirmLevelRestart =
  document.querySelector<HTMLButtonElement>('#confirm-level-restart')!;

const cancelLevelRestart =
  document.querySelector<HTMLButtonElement>('#cancel-level-restart')!;

function openRestartLevelModal(): void {
  if (phase !== 'playing') return;

  restartLevelModal.classList.add('visible');
  restartLevelModal.setAttribute('aria-hidden', 'false');
  cancelLevelRestart.focus();
}

function closeRestartLevelModal(): void {
  restartLevelModal.classList.remove('visible');
  restartLevelModal.setAttribute('aria-hidden', 'true');
}

document.querySelector('#in-game-reset-button')
  ?.addEventListener('click', openRestartLevelModal);

confirmLevelRestart.addEventListener('click', () => {
  closeRestartLevelModal();

  if (phase === 'playing') {
    resetCurrentLevel();
    showToast('Level restarted!');
  }
});

cancelLevelRestart.addEventListener('click', closeRestartLevelModal);

restartLevelModal.addEventListener('click', (event) => {
  if (event.target === restartLevelModal) {
    closeRestartLevelModal();
  }
});

document.addEventListener('keydown', (event) => {
  if (
    event.key === 'Escape' &&
    restartLevelModal.classList.contains('visible')
  ) {
    closeRestartLevelModal();
  }
});



function syncAvatarDisplays(): void {
  const currentPortrait = STORE_PORTRAITS.find(p => p.id === equippedPortraitId) ?? STORE_PORTRAITS[0];
  if (menuAvatarDisplay) menuAvatarDisplay.src = currentPortrait.image;
  if (gameAvatarDisplay) gameAvatarDisplay.src = currentPortrait.image;
}

function dailyDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const dailyHistoryStorageKey = 'meowdoku-daily-history-v2';
const dailySelectionStorageKey = 'meowdoku-daily-selection-v2';
const DAILY_LEVELS_PER_DAY = 5;
const dailyProgressStorageKey = 'meowdoku-daily-progress-v1';

function readDailyProgress(dateKey: string): number {
  try {
    const stored = JSON.parse(localStorage.getItem(dailyProgressStorageKey) ?? '{}') as Record<string, unknown>;
    const value = stored[dateKey];
    return typeof value === 'number' ? Math.max(0, Math.min(DAILY_LEVELS_PER_DAY, Math.floor(value))) : 0;
  } catch {
    return 0;
  }
}

function writeDailyProgress(dateKey: string, value: number): void {
  let stored: Record<string, unknown> = {};
  try { stored = JSON.parse(localStorage.getItem(dailyProgressStorageKey) ?? '{}') as Record<string, unknown>; } catch { /* start fresh */ }
  stored[dateKey] = Math.max(0, Math.min(DAILY_LEVELS_PER_DAY, value));
  localStorage.setItem(dailyProgressStorageKey, JSON.stringify(stored));
}

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
  }

  const selection = pickDailyChallengeKey(completed);
  if (selection.reset) localStorage.setItem(dailyHistoryStorageKey, '[]');
  activeDailyKey = selection.key;
  localStorage.setItem(dailySelectionStorageKey, JSON.stringify({ date: dateKey, key: selection.key }));
  return getDailyChallenge(selection.key);
}

function catArt(className = ''): string {
  return `<img class="cat-art ${className}" src="${getNextRandomImage()}" alt="" aria-hidden="true" draggable="false">`;
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
        <span class="menu-cell-face menu-cell-cat"><img src="${getNextRandomImage()}" alt=""></span>
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
  const todayKey = dailyDateKey();
  const dailyCompleted = readDailyProgress(todayKey) >= DAILY_LEVELS_PER_DAY;
  mainEntryStatus.textContent = `Current Level ${formatLevelNumber(mainLevelIndex + 1)} `;
  hexEntryStatus.textContent = `Current Level ${formatLevelNumber(hexLevelIndex + 1)} `;
  totalFishLabel.textContent = totalFish.toLocaleString('en-US');
  dailyModeButton.disabled = dailyCompleted;
  dailyEntryStatus.textContent = dailyCompleted ? '5/5 Completed' : `Daily ${readDailyProgress(todayKey)}/5`; 
  dailyModeButton.setAttribute('aria-label', dailyCompleted ? 'Daily Challenge, Completed' : 'Daily Challenge');
  syncAvatarDisplays();
}


function renderFish(): void {
  fishDisplay.innerHTML = Array.from(
    { length: 3 },
    (_, index) =>
      `<img class="fish ${index >= fish ? 'empty' : ''}" src="./images/bone-token.png" alt="${index < fish ? 'Bones' : 'Lost Bones'}">`
  ).join('');

  // Keep one bone in reserve: hints require at least two bones.
  const hintUnavailable = phase !== 'playing' || fish <= 1;

  hintButton.disabled = hintUnavailable;
  hintButton.setAttribute('aria-disabled', String(hintUnavailable));
  hintButton.title = fish <= 1
    ? 'Keep your last bone! No more hints.'
    : 'Use a hint (costs one bone)';
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
      const progress = Math.min(DAILY_LEVELS_PER_DAY, readDailyProgress(activeDailyDateKey) + 1);
      writeDailyProgress(activeDailyDateKey, progress);
      if (progress >= DAILY_LEVELS_PER_DAY) localStorage.setItem('meowdoku-daily-completed', activeDailyDateKey);
      updateMenu();
    }
    sound.win();
  } else sound.losemgs();

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
  else if (mode === 'daily' && readDailyProgress(activeDailyDateKey) < DAILY_LEVELS_PER_DAY) resultButton.textContent = `Next Daily Puzzle (${readDailyProgress(activeDailyDateKey) + 1}/5)　›`;
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
hintButton.disabled = true;
hintButton.setAttribute('aria-disabled', 'true');
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

  // Never allow a hint to consume the final bone.
  if (fish <= 1) {
    showToast('Keep your last bone! No more hints.', 2600);
    renderFish();
    return;
  }

  clearHint();

  const incorrectMark = puzzle.cats.find(
    ({ row, col }) => cells[row][col] === 'marked'
  );

  if (incorrectMark) {
    hintedCell = `${incorrectMark.row},${incorrectMark.col}`;
    updateCell(incorrectMark.row, incorrectMark.col);
    showToast(
      'This X leads to a contradiction, please clear it first',
      3200
    );
    return;
  }

  const hint = findLogicHints(puzzle, cells).find((candidate) =>
    candidate.action === 'cat'
      ? hasCat(puzzle, candidate.row, candidate.col)
      : !hasCat(puzzle, candidate.row, candidate.col)
  );

  if (!hint) {
    showToast('No logical deductions currently 0-4', 2600);
    return;
  }

  // Charge only after a valid hint has been found.
  fish -= 1;
  renderFish();

  hintedCell = `${hint.row},${hint.col}`;
  updateCell(hint.row, hint.col);
  showToast(`${ruleLabel(hint)}：${hint.reason}`, 4200);
}


function findOneCat(): void {
  if (phase !== 'playing') return;

  // Find all pups that have not been revealed yet.
  const hiddenPups = puzzle.cats.filter(
    ({ row, col }) => cells[row][col] !== 'cat'
  );

  // No hidden pups remain.
  if (hiddenPups.length === 0) {
    showToast('All Pups Found!');
    return;
  }

  // Prevent Find a Pup from revealing the final pup.
  if (hiddenPups.length === 1) {
    showFindPupPopup(
      'One Pup Left!',
      'Only one pup remains! You need to find it yourself to complete the puzzle and earn your reward.'
    );
    return;
  }

  // Require at least 10 bones before using Find a Pup.
  if (totalFish < 10) {
    showFindPupPopup(
    'Not Enough Bones!',
    `You need at least 10 bones to use the Pup Locator.  You currently have ${totalFish}.`
    );
    return;
  }

  // Random cost from 1 to 10 bones.
  const bonesSpent = Math.floor(Math.random() * 10) + 1;

  totalFish -= bonesSpent;
  localStorage.setItem(totalFishStorageKey, String(totalFish));
  updateMenu();

  // Reveal one of the hidden pups.
  const cat = hiddenPups[
    Math.floor(Math.random() * hiddenPups.length)
  ];

  revealCatAt(cat.row, cat.col, 'The Pup Locator finds a Pup!');

  // Show the custom in-game popup with the cost and remaining balance.
  showFindPupPopup(
  'A Pup Appears!',
  '...and randomly ate some of your bones! 😂',
  bonesSpent
  );
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
  modeLabel.textContent = mode === 'daily' ? 'Challenge' : mode === 'hex' ? 'Hex Level' : 'Pup Level';
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
  syncAvatarDisplays();
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

function renderStoreGrid(): void {
  storeGrid.innerHTML = STORE_PORTRAITS.map((item) => {
    const isUnlocked = unlockedPortraits.includes(item.id);
    const isEquipped = equippedPortraitId === item.id;
    const canAfford = totalFish >= item.cost;
    
    let buttonMarkup = '';
    let cardStyle = 'border: 2px solid #eee; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; align-items: center; background: #fff; position: relative; transition: all 0.2s ease; cursor: pointer;';
    
    if (isEquipped) {
      cardStyle += ' border-color: #ffd15c; background: rgba(255, 209, 92, 0.03); box-shadow: 0 4px 12px rgba(255, 209, 92, 0.15);';
      buttonMarkup = `<button class="primary-button equip-portrait-btn" data-id="${item.id}" style="background: #ffd15c; color: #333; margin-top: 8px; font-weight: bold;" disabled>★ Active</button>`;
    } else if (isUnlocked) {
      buttonMarkup = `<button class="primary-button equip-portrait-btn" data-id="${item.id}" style="background: #78cfa8; margin-top: 8px;">Equip</button>`;
    } else {
      buttonMarkup = `
        <button class="primary-button buy-portrait-btn" 
                data-id="${item.id}" 
                data-cost="${item.cost}" 
                style="margin-top: 8px; background: ${canAfford ? '#ff867f' : '#ccc'}" 
                ${!canAfford ? 'disabled' : ''}>
          🦴 ${item.cost} Bones
        </button>`;
    }

    const equippedBadge = isEquipped ? '<span style="position: absolute; top: 5px; right: 5px; background: #ffd15c; font-size: 0.6rem; padding: 1px 4px; border-radius: 4px; font-weight: bold; color: #333;">Equipped</span>' : '';

    return `
      <div class="store-item-card" data-id="${item.id}" data-unlocked="${isUnlocked}" style="${cardStyle}">
        ${equippedBadge}
        <img src="${item.image}" alt="${item.name}" style="width: 70px; height: 70px; object-fit: contain; margin-bottom: 8px; filter: ${isUnlocked ? 'none' : 'grayscale(60%) opacity(80%)'};" draggable="false">
        <strong style="font-size: 0.9rem; text-align: center; min-height: 2.4rem; display: flex; align-items: center; color: ${isUnlocked ? '#333' : '#777'}">${item.name}</strong>
        ${buttonMarkup}
      </div>
    `;
  }).join('');

  storeGrid.querySelectorAll('.buy-portrait-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = e.currentTarget as HTMLButtonElement;
      const id = target.dataset.id!;
      const cost = Number(target.dataset.cost!);
      buyPortrait(id, cost);
    });
  });

  storeGrid.querySelectorAll('.equip-portrait-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = e.currentTarget as HTMLButtonElement;
      const id = target.dataset.id!;
      equipPortrait(id);
    });
  });

  storeGrid.querySelectorAll('.store-item-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLDivElement;
      const id = target.dataset.id!;
      const isUnlocked = target.dataset.unlocked === 'true';
      if (isUnlocked && equippedPortraitId !== id) {
        equipPortrait(id);
      }
    });
  });
}

function buyPortrait(id: string, cost: number): void {
  if (totalFish < cost || unlockedPortraits.includes(id)) return;
  
  totalFish -= cost;
  unlockedPortraits.push(id);
  
  localStorage.setItem(totalFishStorageKey, String(totalFish));
  localStorage.setItem(unlockedPortraitsKey, JSON.stringify(unlockedPortraits));
  
  if (sound && typeof sound.win === 'function') sound.win();
  
  updateMenu();
  renderStoreGrid();
  showToast('Portrait successfully unlocked! Click it to equip.');
}

function equipPortrait(id: string): void {
  if (!unlockedPortraits.includes(id)) return;
  
  equippedPortraitId = id;
  localStorage.setItem(equippedPortraitKey, id);
  
  if (sound && typeof sound.mark === 'function') sound.mark();
  
  updateMenu();
  renderStoreGrid();
  showToast('Avatar avatar equipped successfully!');
}

function openStore(): void {
  renderStoreGrid();
  storeModal.classList.add('visible');
  storeModal.setAttribute('aria-hidden', 'false');
}

function closeStore(): void {
  storeModal.classList.remove('visible');
  storeModal.setAttribute('aria-hidden', 'true');
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
document.querySelector('#close-store-button')?.addEventListener('click', closeStore);
document.querySelector('#brand-avatar-container')?.addEventListener('click', openStore);



const resetProgressModal =
  document.querySelector<HTMLElement>('#reset-progress-modal');

const confirmResetProgressButton =
  document.querySelector<HTMLButtonElement>(
    '#confirm-reset-progress-button'
  );

const cancelResetProgressButton =
  document.querySelector<HTMLButtonElement>(
    '#cancel-reset-progress-button'
  );

let resetConfirmationStep = 1;

function openResetProgressModal(): void {
  if (!resetProgressModal) return;

  resetConfirmationStep = 1;
  updateResetConfirmationStep();

  resetProgressModal.classList.add('visible');
  resetProgressModal.setAttribute('aria-hidden', 'false');
}

function closeResetProgressModal(): void {
  if (!resetProgressModal) return;

  resetProgressModal.classList.remove('visible');
  resetProgressModal.setAttribute('aria-hidden', 'true');
  resetConfirmationStep = 1;
}


function updateResetConfirmationStep(): void {
  const eyebrow = document.querySelector<HTMLElement>(
    '#reset-progress-eyebrow'
  );
  const title = document.querySelector<HTMLElement>(
    '#reset-progress-title'
  );
  const description = document.querySelector<HTMLElement>(
    '#reset-progress-description'
  );

  if (!eyebrow || !title || !description || !confirmResetProgressButton) {
    return;
  }

  if (resetConfirmationStep === 1) {
    eyebrow.textContent = 'ARE YOU SURE?';
    title.textContent = 'Reset All Progress?';
    description.textContent =
      "This will erase your unlocked levels, earned bones, star records, daily puzzle history, and collected pups. You'll start over at Level 1.";

    confirmResetProgressButton.textContent = 'Erase All Progress!';
    confirmResetProgressButton.classList.remove('final-reset-warning');
  } else {
    eyebrow.textContent = 'FINAL PUP CHECK!';
    title.textContent = 'Are You Absolutely Sure?';
    description.textContent =
      'This is permanent! All your saved progress and rewards will be erased. There is no undo button. Do you really want to reset everything?';

    confirmResetProgressButton.textContent = 'Yes, Erase All Progress';
    confirmResetProgressButton.classList.add('final-reset-warning');
  }
}


function resetAllProgress(): void {
  localStorage.removeItem('meowdoku-main-level');
  localStorage.removeItem('meowdoku-level');
  localStorage.removeItem('meowdoku-hex-level');
  localStorage.removeItem('meowdoku-stars');
  localStorage.removeItem('meowdoku-hex-stars');
  localStorage.removeItem('meowdoku-total-fish');
  localStorage.removeItem('meowdoku-daily-completed');
  localStorage.removeItem('meowdoku-daily-history-v2');
  localStorage.removeItem('meowdoku-daily-selection-v2');
  localStorage.removeItem('meowdoku-daily-progress-v1');
  localStorage.removeItem(unlockedPortraitsKey);
  localStorage.removeItem(equippedPortraitKey);

  mainLevelIndex = 0;
  hexLevelIndex = 0;
  totalFish = 0;
  bestStars = {};
  hexBestStars = {};
  unlockedPortraits = ['pup'];
  equippedPortraitId = 'pup';

  closeResetProgressModal();
  updateMenu();
  showToast('Progress reset! Welcome back to Level 1!');
}

document.querySelector('#menu-reset-button')
  ?.addEventListener('click', openResetProgressModal);

document.querySelector('#reset-progress-button')
  ?.addEventListener('click', openResetProgressModal);

confirmResetProgressButton?.addEventListener('click', () => {
  if (resetConfirmationStep === 1) {
    resetConfirmationStep = 2;
    updateResetConfirmationStep();
    return;
  }

  // Progress is erased only on the second confirmation.
  resetAllProgress();
});

cancelResetProgressButton?.addEventListener(
  'click',
  closeResetProgressModal
);

resetProgressModal?.addEventListener('click', (event) => {
  if (event.target === resetProgressModal) {
    closeResetProgressModal();
  }
});

document.addEventListener('keydown', (event) => {
  if (
    event.key === 'Escape' &&
    resetProgressModal?.classList.contains('visible')
  ) {
    closeResetProgressModal();
  }
});

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
  if (mode === 'daily' && readDailyProgress(activeDailyDateKey) < DAILY_LEVELS_PER_DAY) {
    openMode('daily');
  } else if (mode === 'main' && activeMainIndex < MAIN_LEVEL_COUNT - 1) {
    openMode('main');
  } else if (mode === 'hex' && activeHexIndex < HEX_LEVEL_COUNT - 1) {
    openMode('hex');
  } else showMenu();
});

createMenuBoard();
showMenu();
