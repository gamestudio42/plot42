import { SfxBoard, type DroneTone } from '@shell/chrome';

export type PostoSound = 'select' | 'move' | 'attack' | 'victory' | 'defeat' | 'error' | 'save';

const MENU_DRONE: DroneTone[] = [
  { type: 'sine', freq: 110, gain: 0.14 },
  { type: 'triangle', freq: 165, gain: 0.05 },
];

const PLAY_DRONE: DroneTone[] = [
  { type: 'sine', freq: 98, gain: 0.12 },
  { type: 'sawtooth', freq: 147, gain: 0.03 },
];

export function createPostoAudio(): SfxBoard<PostoSound> {
  return new SfxBoard({
    mutedKey: 'posto.muted',
    recipes: {
      select: (v) => v.tone({ type: 'sine', freq: 520, duration: 0.07, gain: 0.14 }),
      move: (v) => {
        v.tone({ type: 'triangle', freq: 240, to: 180, duration: 0.1, gain: 0.16 });
        v.noise({ filter: 'lowpass', freq: 400, duration: 0.08, gain: 0.12 });
      },
      attack: (v) => {
        v.noise({ filter: 'bandpass', freq: 700, q: 1.2, duration: 0.12, gain: 0.35 });
        v.tone({ type: 'square', freq: 160, to: 80, duration: 0.14, gain: 0.18 });
      },
      victory: (v) => {
        [392, 494, 587, 784].forEach((freq, k) =>
          v.tone({ type: 'triangle', freq, start: k * 0.1, duration: 0.28, gain: 0.2 }),
        );
      },
      defeat: (v) => {
        v.tone({ type: 'sawtooth', freq: 196, to: 80, duration: 0.55, gain: 0.18 });
        v.noise({ filter: 'lowpass', freq: 160, duration: 0.5, gain: 0.3 });
      },
      error: (v) => {
        v.tone({ type: 'square', freq: 170, duration: 0.08, gain: 0.1 });
        v.tone({ type: 'square', freq: 130, start: 0.1, duration: 0.1, gain: 0.1 });
      },
      save: (v) => {
        v.tone({ type: 'sine', freq: 494, duration: 0.1, gain: 0.14 });
        v.tone({ type: 'sine', freq: 740, start: 0.08, duration: 0.14, gain: 0.12 });
      },
    },
  });
}

export function postoDrone(kind: 'menu' | 'play'): DroneTone[] {
  return kind === 'menu' ? MENU_DRONE : PLAY_DRONE;
}
