/**
 * High-performance, self-contained Web Audio Synthesizer for Games
 * Provides background music loops and sound effects with zero external file dependencies.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private isMuted: boolean = false;
  private activeMusicTimer: number | null = null;
  private currentTrack: "gems" | "race" | null = null;
  private initialized: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.isMuted = localStorage.getItem("data1_game_music_muted") === "true";
    }
  }

  private initCtx() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.65, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.initialized = true;
    } catch (e) {
      console.warn("AudioContext init note:", e);
    }
  }

  public resume() {
    this.initCtx();
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (typeof window !== "undefined") {
      localStorage.setItem("data1_game_music_muted", String(this.isMuted));
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.65, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (typeof window !== "undefined") {
      localStorage.setItem("data1_game_music_muted", String(this.isMuted));
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.65, this.ctx.currentTime);
    }
  }

  // -------------------------------------------------------------
  // SYNTH TONE HELPERS
  // -------------------------------------------------------------
  private playNote(
    freq: number,
    start: number,
    duration: number,
    type: OscillatorType = "sine",
    gainValue = 0.2,
    dest: GainNode | null = this.musicGain
  ) {
    if (!this.ctx || !dest || freq <= 0) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(start);
      osc.stop(start + duration);
    } catch {}
  }

  // -------------------------------------------------------------
  // ROYAL GEMS BACKGROUND MUSIC (Upbeat arcade chiptune melody)
  // -------------------------------------------------------------
  public startGemsMusic() {
    this.resume();
    if (this.currentTrack === "gems") return;
    this.stopMusic();
    this.currentTrack = "gems";

    // C Major / Pentatonic Arpeggios & Melody
    // Frequencies (Hz)
    const notes: Record<string, number> = {
      C4: 261.63,
      D4: 293.66,
      E4: 329.63,
      G4: 392.0,
      A4: 440.0,
      B4: 493.88,
      C5: 523.25,
      D5: 587.33,
      E5: 659.25,
      G5: 783.99,
      A5: 880.0,
      C3: 130.81,
      F3: 174.61,
      G3: 196.0,
      A3: 220.0,
    };

    // Melody sequence (note, beat length)
    const melody = [
      ["E4", 0.25], ["G4", 0.25], ["C5", 0.5], ["A4", 0.25], ["C5", 0.25], ["G4", 0.5],
      ["E4", 0.25], ["D4", 0.25], ["C4", 0.5], ["D4", 0.25], ["E4", 0.25], ["G4", 0.5],
      ["A4", 0.25], ["C5", 0.25], ["E5", 0.5], ["D5", 0.25], ["C5", 0.25], ["A4", 0.5],
      ["G4", 0.25], ["E4", 0.25], ["D4", 0.5], ["C4", 0.5], ["E4", 0.5],
    ];

    const bass = [
      ["C3", 1.0], ["G3", 1.0], ["A3", 1.0], ["F3", 1.0],
      ["C3", 1.0], ["G3", 1.0], ["A3", 1.0], ["G3", 1.0],
    ];

    const stepTime = 0.22; // BPM ~ 135
    let melodyIndex = 0;
    let bassIndex = 0;
    let nextNoteTime = (this.ctx?.currentTime || 0) + 0.05;

    const schedule = () => {
      if (!this.ctx || this.currentTrack !== "gems") return;

      const lookAhead = 1.0;
      while (nextNoteTime < this.ctx.currentTime + lookAhead) {
        // Schedule melody note
        const [mNote, mLen] = melody[melodyIndex % melody.length];
        const freq = notes[mNote as string] || 440;
        const noteDur = (mLen as number) * stepTime * 1.8;
        this.playNote(freq, nextNoteTime, noteDur, "triangle", 0.16);

        // Schedule gentle sparkle harmony
        if (melodyIndex % 2 === 0) {
          const harmFreq = freq * 1.5;
          this.playNote(harmFreq, nextNoteTime + 0.02, noteDur * 0.6, "sine", 0.05);
        }

        // Schedule bass note every 4 beats
        if (melodyIndex % 4 === 0) {
          const [bNote, bLen] = bass[bassIndex % bass.length];
          const bFreq = notes[bNote as string] || 130;
          this.playNote(bFreq, nextNoteTime, (bLen as number) * stepTime * 3.5, "sawtooth", 0.1);
          bassIndex++;
        }

        nextNoteTime += (mLen as number) * stepTime * 1.8;
        melodyIndex++;
      }

      this.activeMusicTimer = window.setTimeout(schedule, 250);
    };

    schedule();
  }

  // -------------------------------------------------------------
  // TURBO RACER BACKGROUND MUSIC (Fast synthwave driving rhythm)
  // -------------------------------------------------------------
  public startRaceMusic() {
    this.resume();
    if (this.currentTrack === "race") return;
    this.stopMusic();
    this.currentTrack = "race";

    // Driving Synthwave Notes
    const notes: Record<string, number> = {
      A2: 110.0,
      C3: 130.81,
      D3: 146.83,
      E3: 164.81,
      G3: 196.0,
      A3: 220.0,
      C4: 261.63,
      D4: 293.66,
      E4: 329.63,
      G4: 392.0,
      A4: 440.0,
    };

    const bassPattern = ["A2", "A2", "C3", "A2", "D3", "A2", "G3", "E3"];
    const leadPattern = [
      ["A4", 0.25], ["C4", 0.25], ["E4", 0.5], ["D4", 0.25],
      ["A3", 0.25], ["C4", 0.5], ["E4", 0.25], ["G4", 0.25],
      ["A4", 0.5], ["G4", 0.25], ["E4", 0.25], ["D4", 0.5],
    ];

    const stepTime = 0.13; // fast tempo ~ 140 BPM
    let bassIndex = 0;
    let leadIndex = 0;
    let nextTime = (this.ctx?.currentTime || 0) + 0.05;

    const schedule = () => {
      if (!this.ctx || this.currentTrack !== "race") return;

      const lookAhead = 1.0;
      while (nextTime < this.ctx.currentTime + lookAhead) {
        // Fast pulsed bass
        const bNote = bassPattern[bassIndex % bassPattern.length];
        const bFreq = notes[bNote] || 110;
        this.playNote(bFreq, nextTime, stepTime * 0.9, "sawtooth", 0.16);

        // Hi-hat / snare noise simulation
        if (bassIndex % 2 === 1) {
          this.playSnare(nextTime);
        }

        // Synth Lead melody every 2 steps
        if (bassIndex % 2 === 0) {
          const [lNote, lDur] = leadPattern[leadIndex % leadPattern.length];
          const lFreq = notes[lNote as string] || 440;
          this.playNote(lFreq, nextTime, (lDur as number) * 0.35, "square", 0.12);
          leadIndex++;
        }

        nextTime += stepTime;
        bassIndex++;
      }

      this.activeMusicTimer = window.setTimeout(schedule, 200);
    };

    schedule();
  }

  private playSnare(time: number) {
    if (!this.ctx || !this.musicGain) return;
    try {
      const bufferSize = this.ctx.sampleRate * 0.05;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 1000;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.08, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      noise.start(time);
      noise.stop(time + 0.05);
    } catch {}
  }

  public stopMusic() {
    if (this.activeMusicTimer !== null) {
      clearTimeout(this.activeMusicTimer);
      this.activeMusicTimer = null;
    }
    this.currentTrack = null;
  }

  // -------------------------------------------------------------
  // SOUND EFFECTS
  // -------------------------------------------------------------

  // Gem Match Sound (pitch rises with combo)
  public playGemMatch(combo = 1) {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const baseFreq = 440 * Math.min(2.5, 1 + (combo - 1) * 0.25);

    [0, 0.06, 0.12].forEach((offset, idx) => {
      const f = baseFreq * (1 + idx * 0.25);
      this.playNote(f, now + offset, 0.18, "sine", 0.3, this.sfxGain);
    });
  }

  // Gem Tap / Select
  public playGemSelect() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    this.playNote(620, now, 0.07, "triangle", 0.25, this.sfxGain);
  }

  // Level Win Fanfare
  public playWinFanfare() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const chords = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    chords.forEach((freq, i) => {
      this.playNote(freq, now + i * 0.1, 0.4, "triangle", 0.35, this.sfxGain);
    });
  }

  // Game Over Sound
  public playGameOver() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const notes = [440, 415.3, 392, 349.23];
    notes.forEach((freq, i) => {
      this.playNote(freq, now + i * 0.12, 0.25, "sawtooth", 0.2, this.sfxGain);
    });
  }

  // Turbo Racer Steer / Dodge Sound
  public playSteer() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    this.playNote(300, now, 0.06, "sine", 0.2, this.sfxGain);
  }

  // Turbo Racer Crash Sound
  public playCrash() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.4);

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.45);
    } catch {}
  }

  // Spin Wheel Tick Sound
  public playSpinTick(pitch = 1.0) {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    this.playNote(700 * pitch, now, 0.03, "sine", 0.3, this.sfxGain);
  }

  // Spin Prize Celebration Fanfare
  public playCelebration() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const notes = [392.0, 523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, idx) => {
      this.playNote(f, now + idx * 0.08, 0.35, "triangle", 0.4, this.sfxGain);
    });
  }

  // Flap / Jump Sound
  public playFlap() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(750, now + 0.12);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch {}
  }

  // Point / Coin Collect Sound
  public playPoint() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    this.playNote(987.77, now, 0.08, "sine", 0.25, this.sfxGain);
    this.playNote(1318.51, now + 0.08, 0.15, "sine", 0.28, this.sfxGain);
  }

  // 2048 Tile Slide Sound
  public playSlide() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    this.playNote(340, now, 0.05, "triangle", 0.15, this.sfxGain);
  }

  // 2048 Tile Merge Sound
  public playMerge(tier = 1) {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const baseFreq = 300 + Math.min(1000, tier * 70);
    this.playNote(baseFreq, now, 0.08, "triangle", 0.28, this.sfxGain);
    this.playNote(baseFreq * 1.5, now + 0.05, 0.14, "sine", 0.22, this.sfxGain);
  }

  // --- 8-BALL POOL SFX ---
  private lastPullSoundTime: number = 0;
  public playCuePull(power = 50) {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    if (now - this.lastPullSoundTime < 0.065) return;
    this.lastPullSoundTime = now;

    const pitch = 320 + (power / 100) * 450;
    this.playNote(pitch, now, 0.022, "triangle", 0.22, this.sfxGain);
    this.playNote(pitch * 1.4, now + 0.004, 0.016, "sine", 0.14, this.sfxGain);
  }

  public playCueStrike(power = 50) {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const clamped = Math.max(0.25, Math.min(1.3, power / 65));
    this.playNote(1180 * clamped, now, 0.035, "triangle", 0.48 * clamped, this.sfxGain);
    this.playNote(540, now + 0.005, 0.06, "sine", 0.32 * clamped, this.sfxGain);
    this.playNote(220, now + 0.015, 0.09, "triangle", 0.25 * clamped, this.sfxGain);
  }

  public playBallHit(intensity = 1) {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const clamped = Math.max(0.15, Math.min(1.2, intensity));
    this.playNote(980 * clamped, now, 0.025, "triangle", 0.35 * clamped, this.sfxGain);
    this.playNote(420, now + 0.005, 0.04, "sine", 0.2 * clamped, this.sfxGain);
  }

  public playPocket() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    this.playNote(140, now, 0.12, "sine", 0.4, this.sfxGain);
    this.playNote(90, now + 0.04, 0.18, "triangle", 0.3, this.sfxGain);
  }

  // --- LUDO SFX ---
  public playDiceRoll() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const t = now + i * 0.055;
      const freq = 600 + Math.random() * 400;
      this.playNote(freq, t, 0.03, "sine", 0.22, this.sfxGain);
    }
  }

  public playPawnMove() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    this.playNote(520, now, 0.05, "sine", 0.25, this.sfxGain);
    this.playNote(780, now + 0.03, 0.06, "sine", 0.2, this.sfxGain);
  }

  public playCapture() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    this.playNote(880, now, 0.06, "sawtooth", 0.3, this.sfxGain);
    this.playNote(440, now + 0.07, 0.12, "sawtooth", 0.35, this.sfxGain);
    this.playNote(220, now + 0.16, 0.18, "sine", 0.4, this.sfxGain);
  }

  // --- TEMPLE SPRINT SFX ---
  public playJump() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    this.playNote(340, now, 0.05, "sine", 0.25, this.sfxGain);
    this.playNote(680, now + 0.04, 0.08, "sine", 0.3, this.sfxGain);
  }

  public playSlideDown() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    this.playNote(500, now, 0.05, "sine", 0.22, this.sfxGain);
    this.playNote(280, now + 0.04, 0.1, "sine", 0.25, this.sfxGain);
  }

  // --- MARBLE SHOOT SFX ---
  public playMarbleShoot() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    this.playNote(750, now, 0.04, "triangle", 0.28, this.sfxGain);
    this.playNote(1100, now + 0.02, 0.06, "sine", 0.3, this.sfxGain);
  }

  public playMarblePop(combo = 1) {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const mult = 1 + (combo - 1) * 0.2;
    this.playNote(440 * mult, now, 0.06, "sine", 0.35, this.sfxGain);
    this.playNote(660 * mult, now + 0.04, 0.08, "triangle", 0.32, this.sfxGain);
    this.playNote(880 * mult, now + 0.09, 0.12, "sine", 0.28, this.sfxGain);
  }
}

export const gameAudio = new SoundEngine();
