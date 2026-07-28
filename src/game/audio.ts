import type { ZoneId } from './profile';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private muted = false;
  private volume = 0.5;
  private currentMusic: OscillatorNode[] = [];
  private currentMusicGains: GainNode[] = [];
  private musicInterval: ReturnType<typeof setInterval> | null = null;

  private ensureContext() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.6;
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.25;
      this.musicGain.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) this.masterGain.gain.value = this.muted ? 0 : this.volume;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.masterGain) this.masterGain.gain.value = this.muted ? 0 : this.volume;
    return this.muted;
  }

  isMuted() {
    return this.muted;
  }

  playAttack() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playHit() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playDamage() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  playCollect() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523, now);
    osc.frequency.setValueAtTime(659, now + 0.06);
    osc.frequency.setValueAtTime(784, now + 0.12);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  playLevelUp() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const notes = [523, 659, 784, 1047];
    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = notes[i];
      gain.gain.setValueAtTime(0, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.25, now + i * 0.12 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.2);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.22);
    }
  }

  playQuestComplete() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const notes = [440, 554, 659, 880];
    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = notes[i];
      gain.gain.setValueAtTime(0, now + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.2, now + i * 0.15 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.3);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.32);
    }
  }

  playBossWarning() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100 + i * 20, now + i * 0.2);
      osc.frequency.exponentialRampToValueAtTime(60, now + i * 0.2 + 0.15);
      gain.gain.setValueAtTime(0.3, now + i * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.2 + 0.18);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + i * 0.2);
      osc.stop(now + i * 0.2 + 0.2);
    }
  }

  playDeath() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.8);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 1.1);
  }

  playHeal() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(880, now + 0.2);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  startZoneAmbient(zone: ZoneId) {
    this.stopZoneAmbient();
    this.ensureContext();
    if (!this.ctx || !this.musicGain) return;

    const zoneConfigs: Record<
      ZoneId,
      { baseFreq: number; chordFreqs: number[]; tempo: number; waveform: OscillatorType }
    > = {
      aldea: {
        baseFreq: 196,
        chordFreqs: [196, 247, 294, 330],
        tempo: 800,
        waveform: 'sine',
      },
      bosque: {
        baseFreq: 165,
        chordFreqs: [165, 196, 247, 294],
        tempo: 1000,
        waveform: 'triangle',
      },
      ruinas: {
        baseFreq: 147,
        chordFreqs: [147, 175, 208, 247],
        tempo: 1200,
        waveform: 'sine',
      },
      desierto: {
        baseFreq: 220,
        chordFreqs: [220, 262, 330, 392],
        tempo: 900,
        waveform: 'triangle',
      },
      cueva: {
        baseFreq: 110,
        chordFreqs: [110, 131, 165, 196],
        tempo: 1400,
        waveform: 'sine',
      },
    };

    const config = zoneConfigs[zone];
    let noteIndex = 0;

    this.musicInterval = setInterval(() => {
      if (!this.ctx || !this.musicGain || this.muted) return;

      const freq = config.chordFreqs[noteIndex % config.chordFreqs.length];
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = config.waveform;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, now + (config.tempo / 1000) * 0.8);
      osc.connect(gain);
      gain.connect(this.musicGain!);
      osc.start(now);
      osc.stop(now + config.tempo / 1000);

      this.currentMusic.push(osc);
      this.currentMusicGains.push(gain);

      if (this.currentMusic.length > 8) {
        const old = this.currentMusic.shift();
        const oldGain = this.currentMusicGains.shift();
        if (old) {
          try {
            old.stop();
          } catch {
            // already stopped
          }
        }
        if (oldGain) oldGain.disconnect();
      }

      noteIndex++;
    }, config.tempo);
  }

  stopZoneAmbient() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    for (const osc of this.currentMusic) {
      try {
        osc.stop();
      } catch {
        // already stopped
      }
    }
    for (const gain of this.currentMusicGains) {
      gain.disconnect();
    }
    this.currentMusic = [];
    this.currentMusicGains = [];
  }

  destroy() {
    this.stopZoneAmbient();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
