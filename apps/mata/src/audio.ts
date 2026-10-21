import { SfxBoard, type DroneTone } from '@shell/chrome';

export type MataSound = 'plant' | 'water' | 'clear' | 'error' | 'save' | 'restore';

const MENU_DRONE: DroneTone[] = [
  { type: 'sine', freq: 174, gain: 0.11 },
  { type: 'triangle', freq: 261, gain: 0.05 },
];

const PLAY_DRONE: DroneTone[] = [
  { type: 'sine', freq: 196, gain: 0.09 },
  { type: 'triangle', freq: 247, gain: 0.045 },
];

export function createMataAudio(): SfxBoard<MataSound> {
  return new SfxBoard({
    mutedKey: 'mata.muted',
    recipes: {
      plant: (v) => {
        v.tone({ type: 'sine', freq: 360, to: 480, duration: 0.14, gain: 0.2 });
        v.tone({ type: 'triangle', freq: 220, duration: 0.1, gain: 0.1 });
      },
      water: (v) => {
        v.tone({ type: 'sine', freq: 520, to: 340, duration: 0.16, gain: 0.14 });
        v.noise({ filter: 'bandpass', freq: 720, q: 1.2, duration: 0.12, gain: 0.12 });
      },
      clear: (v) => {
        v.noise({ filter: 'bandpass', freq: 280, q: 0.6, duration: 0.16, gain: 0.26 });
      },
      error: (v) => {
        v.tone({ type: 'square', freq: 170, duration: 0.08, gain: 0.1 });
        v.tone({ type: 'square', freq: 130, start: 0.1, duration: 0.1, gain: 0.1 });
      },
      save: (v) => {
        v.tone({ type: 'sine', freq: 620, duration: 0.12, gain: 0.15 });
        v.tone({ type: 'sine', freq: 820, start: 0.08, duration: 0.16, gain: 0.13 });
      },
      restore: (v) => {
        [392, 494, 587, 784].forEach((freq, k) =>
          v.tone({ type: 'triangle', freq, start: k * 0.07, duration: 0.22, gain: 0.18 }),
        );
      },
    },
  });
}

export function mataDrone(kind: 'menu' | 'play'): DroneTone[] {
  return kind === 'menu' ? MENU_DRONE : PLAY_DRONE;
}
