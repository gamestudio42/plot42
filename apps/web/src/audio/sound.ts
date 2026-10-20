/**
 * Synthesized sound effects (WebAudio oscillators and filtered noise, no audio assets).
 * The AudioContext is created on the first user gesture, as browsers require.
 */
export type SoundName =
  'build' | 'zone' | 'demolish' | 'error' | 'warning' | 'fire' | 'disaster' | 'milestone';

const STORAGE_KEY = 'cityBuilder.muted';
const VOLUME = 0.35;
/** The same effect is not replayed within this window (bursts of events or commands). */
const MIN_INTERVAL_MS = 120;

interface ToneSpec {
  type: OscillatorType;
  freq: number;
  /** Frequency at the end of the note (exponential glide). */
  to?: number;
  start?: number;
  duration: number;
  gain: number;
}

interface NoiseSpec {
  filter: BiquadFilterType;
  freq: number;
  q?: number;
  start?: number;
  duration: number;
  gain: number;
}

class Voice {
  constructor(
    private readonly ctx: AudioContext,
    private readonly out: AudioNode,
    private readonly noiseBuffer: AudioBuffer,
  ) {}

  tone({ type, freq, to, start = 0, duration, gain }: ToneSpec): void {
    const t = this.ctx.currentTime + start;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(to, t + duration);
    osc.connect(this.envelope(t, duration, gain));
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  noise({ filter, freq, q = 1, start = 0, duration, gain }: NoiseSpec): void {
    const t = this.ctx.currentTime + start;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const biquad = this.ctx.createBiquadFilter();
    biquad.type = filter;
    biquad.frequency.value = freq;
    biquad.Q.value = q;
    src.connect(biquad).connect(this.envelope(t, duration, gain));
    src.start(t, 0, duration + 0.05);
  }

  /** Short attack, exponential decay. */
  private envelope(t: number, duration: number, gain: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    g.connect(this.out);
    return g;
  }
}

const RECIPES: Record<SoundName, (v: Voice) => void> = {
  build: (v) => {
    v.tone({ type: 'triangle', freq: 220, to: 110, duration: 0.12, gain: 0.5 });
    v.noise({ filter: 'lowpass', freq: 900, duration: 0.08, gain: 0.25 });
  },
  zone: (v) => {
    v.tone({ type: 'sine', freq: 660, duration: 0.18, gain: 0.25 });
    v.tone({ type: 'sine', freq: 990, start: 0.05, duration: 0.2, gain: 0.18 });
  },
  demolish: (v) => {
    v.noise({ filter: 'bandpass', freq: 420, q: 0.8, duration: 0.35, gain: 0.6 });
    v.tone({ type: 'sine', freq: 120, to: 40, duration: 0.3, gain: 0.45 });
  },
  error: (v) => {
    v.tone({ type: 'square', freq: 196, duration: 0.09, gain: 0.12 });
    v.tone({ type: 'square', freq: 147, start: 0.11, duration: 0.14, gain: 0.12 });
  },
  warning: (v) => {
    v.tone({ type: 'triangle', freq: 440, duration: 0.14, gain: 0.3 });
    v.tone({ type: 'triangle', freq: 330, start: 0.16, duration: 0.2, gain: 0.3 });
  },
  fire: (v) => {
    for (let k = 0; k < 4; k++) {
      v.tone({
        type: 'sawtooth',
        freq: k % 2 ? 900 : 700,
        start: k * 0.16,
        duration: 0.15,
        gain: 0.08,
      });
    }
  },
  disaster: (v) => {
    v.noise({ filter: 'lowpass', freq: 180, duration: 1.4, gain: 0.9 });
    v.tone({ type: 'sine', freq: 55, to: 35, duration: 1.2, gain: 0.5 });
  },
  milestone: (v) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, k) =>
      v.tone({ type: 'triangle', freq, start: k * 0.09, duration: 0.3, gain: 0.22 }),
    );
  },
};

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export class SoundBoard {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private unavailable = false;
  private mutedValue = readMuted();
  private readonly lastPlayed = new Map<SoundName, number>();

  get muted(): boolean {
    return this.mutedValue;
  }

  setMuted(muted: boolean): void {
    this.mutedValue = muted;
    try {
      localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
    } catch {
      // Private mode or disabled storage: the choice lasts for this session only.
    }
    if (this.master) this.master.gain.value = muted ? 0 : VOLUME;
    if (!muted) this.unlock();
  }

  /** Creates or resumes the audio context; call it from a user gesture. */
  unlock(): void {
    if (this.mutedValue) return;
    const ctx = this.context();
    if (ctx?.state === 'suspended') void ctx.resume();
  }

  play(name: SoundName): void {
    if (this.mutedValue) return;
    const ctx = this.context();
    // A suspended context would queue the sound and play it late, after the gesture.
    if (!ctx || ctx.state !== 'running' || !this.master || !this.noiseBuffer) return;
    const now = ctx.currentTime * 1000;
    if (now - (this.lastPlayed.get(name) ?? Number.NEGATIVE_INFINITY) < MIN_INTERVAL_MS) return;
    this.lastPlayed.set(name, now);
    RECIPES[name](new Voice(ctx, this.master, this.noiseBuffer));
  }

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
  }

  private context(): AudioContext | null {
    if (this.ctx || this.unavailable) return this.ctx;
    try {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = this.mutedValue ? 0 : VOLUME;
      master.connect(ctx.destination);
      const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      // Fixed LCG: the noise needs no real randomness.
      let seed = 0x2545f491;
      for (let i = 0; i < data.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        data[i] = seed / 0x80000000 - 1;
      }
      this.ctx = ctx;
      this.master = master;
      this.noiseBuffer = buffer;
    } catch {
      this.unavailable = true;
    }
    return this.ctx;
  }
}
