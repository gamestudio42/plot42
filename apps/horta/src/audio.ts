import { SfxBoard, type DroneTone } from '@shell/chrome';

export type HortaSound = 'plant' | 'harvest' | 'clear' | 'error' | 'save';

const MENU_DRONE: DroneTone[] = [
  { type: 'sine', freq: 196, gain: 0.12 },
  { type: 'triangle', freq: 294, gain: 0.06 },
];

const PLAY_DRONE: DroneTone[] = [
  { type: 'sine', freq: 220, gain: 0.1 },
  { type: 'triangle', freq: 330, gain: 0.05 },
];

export function createHortaAudio(): SfxBoard<HortaSound> {
  return new SfxBoard({
    mutedKey: 'horta.muted',
    recipes: {
      plant: (v) => {
        v.tone({ type: 'sine', freq: 420, to: 520, duration: 0.12, gain: 0.22 });
        v.tone({ type: 'triangle', freq: 260, duration: 0.1, gain: 0.12 });
      },
      harvest: (v) => {
        [523, 659, 784].forEach((freq, k) =>
          v.tone({ type: 'triangle', freq, start: k * 0.06, duration: 0.18, gain: 0.2 }),
        );
      },
      clear: (v) => {
        v.noise({ filter: 'bandpass', freq: 380, q: 0.7, duration: 0.16, gain: 0.28 });
      },
      error: (v) => {
        v.tone({ type: 'square', freq: 180, duration: 0.08, gain: 0.1 });
        v.tone({ type: 'square', freq: 140, start: 0.1, duration: 0.1, gain: 0.1 });
      },
      save: (v) => {
        v.tone({ type: 'sine', freq: 660, duration: 0.12, gain: 0.16 });
        v.tone({ type: 'sine', freq: 880, start: 0.08, duration: 0.16, gain: 0.14 });
      },
    },
  });
}

export function hortaDrone(kind: 'menu' | 'play'): DroneTone[] {
  return kind === 'menu' ? MENU_DRONE : PLAY_DRONE;
}
