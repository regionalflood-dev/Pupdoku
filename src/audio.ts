type EffectName = 'mark' | 'cat-found' | 'miss' | 'win' | 'lose' | 'losemgs';

const EFFECT_SOURCES: Record<EffectName, string> = {
  mark: '/audio/mark.mp3',
  'cat-found': '/audio/cat-found.mp3',
  miss: '/audio/miss.mp3',
  win: '/audio/win.mp3',
  lose: '/audio/lose.mp3',
  losemgs: '/audio/losemgs.mp3',
};

// Define your list of background music tracks here
const MUSIC_TRACKS = [
  '/audio/dre.mp3',
  '/audio/pvz.mp3',
  '/audio/warp.mp3',
  '/audio/bgm.mp3'
];

class SoundManager {
  private readonly music = new Audio(); // Start with an empty Audio element
  private readonly effects = new Map<EffectName, HTMLAudioElement[]>();
  private unlocked = false;
  private musicStarted = false;
  muted = localStorage.getItem('meowdoku-muted') === 'true';

  constructor() {
    // Basic music configuration
    this.music.preload = 'auto';
    this.music.volume = 0.24;
    this.music.muted = this.muted;

    // Listen for when a track ends to pick another random one
    this.music.addEventListener('ended', () => {
      this.playRandomTrack();
    });

    for (const [name, source] of Object.entries(EFFECT_SOURCES) as [EffectName, string][]) {
      this.effects.set(name, Array.from({ length: name === 'mark' ? 3 : 2 }, () => {
        const audio = new Audio(source);
        audio.preload = 'auto';
        audio.volume = name === 'mark' ? 0.34 : name === 'miss' ? 0.48 : 0.56;
        audio.muted = this.muted;
        return audio;
      }));
    }
  }

  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    void this.startMusic();
  }

  // Selects a random source, loads it, and plays it
  private playRandomTrack(): void {
    if (this.muted) return;
    
    const randomIndex = Math.floor(Math.random() * MUSIC_TRACKS.length);
    this.music.src = MUSIC_TRACKS[randomIndex];
    this.music.load();
    
    void this.music.play().catch(() => {
      this.musicStarted = false;
    });
  }

  async startMusic(): Promise<void> {
    if (this.muted || this.musicStarted) return;
    
    this.musicStarted = true;
    this.playRandomTrack();
  }

  private playEffect(name: EffectName): void {
    if (this.muted) return;
    const pool = this.effects.get(name);
    if (!pool) return;
    const audio = pool.find((candidate) => candidate.paused || candidate.ended) ?? pool[0];
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    localStorage.setItem('meowdoku-muted', String(muted));
    this.music.muted = muted;
    this.effects.forEach((pool) => pool.forEach((audio) => { audio.muted = muted; }));
    if (muted) {
      this.music.pause();
      this.musicStarted = false;
    } else {
      void this.startMusic();
    }
  }

  mark(): void { this.playEffect('mark'); }
  unmark(): void { this.playEffect('mark'); }
  cat(): void { this.playEffect('cat-found'); }
  miss(): void { this.playEffect('miss'); }
  win(): void { this.playEffect('win'); }
  lose(): void { this.playEffect('lose'); }
  losemgs(): void { this.playEffect('losemgs'); }
}

export const sound = new SoundManager();
