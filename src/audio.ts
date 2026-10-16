type EffectName = 'mark' | 'cat-found' | 'miss' | 'win' | 'lose';

const EFFECT_SOURCES: Record<EffectName, string> = {
  mark: '/audio/mark.mp3',
  'cat-found': '/audio/cat-found.mp3',
  miss: '/audio/miss.mp3',
  win: '/audio/win.mp3',
  lose: '/audio/lose.mp3',
  losemgs: '/audio/losemgs.mp3',
};

class SoundManager {
  private readonly music = new Audio('/audio/bgm.mp3');
  private readonly effects = new Map<EffectName, HTMLAudioElement[]>();
  private unlocked = false;
  private musicStarted = false;
  muted = localStorage.getItem('meowdoku-muted') === 'true';

  constructor() {
    this.music.loop = true;
    this.music.preload = 'auto';
    this.music.volume = 0.24;
    this.music.muted = this.muted;

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

  async startMusic(): Promise<void> {
    if (this.muted || this.musicStarted) return;
    try {
      await this.music.play();
      this.musicStarted = true;
    } catch {
      this.musicStarted = false;
    }
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
}

export const sound = new SoundManager();
