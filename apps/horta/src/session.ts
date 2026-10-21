import { HORTA_SAVE_EXTENSION, PLOT_RIPE, type HortaSpeed, type HortaStats } from '@horta/sim';
import {
  AUTOSAVE_ID,
  SaveStore,
  slugFileName,
  Store,
  type SfxBoard,
  type ToastItem,
} from '@shell/chrome';
import { createHortaAudio, hortaDrone, type HortaSound } from './audio';
import { HortaClient } from './client';
import { applyDocumentLocale, bootLocale, catalog, persistLocale, type Locale } from './i18n';
import { HortaRenderer } from './renderer';

export type Screen = 'menu' | 'game';

export interface BootState {
  step: 'graphics' | 'garden' | 'done';
  progress: number;
}

export interface HortaSaveSlot {
  id: string;
  savedAt: string;
  name: string;
  autosave: boolean;
  bytes: number;
}

export interface HortaUi {
  boot: BootState;
  screen: Screen;
  speed: HortaSpeed;
  stats: HortaStats | null;
  toasts: ToastItem[];
  locale: Locale;
  name: string;
  seed: string;
  muted: boolean;
  saves: HortaSaveSlot[];
}

const store = new SaveStore<HortaSaveSlot>('horta');

const MENU_PLANTS: [number, number][] = [];
for (let y = 4; y <= 11; y++) {
  for (let x = 4; x <= 11; x++) {
    if ((x + y) % 2 === 0) MENU_PLANTS.push([x, y]);
  }
}

export class HortaSession {
  readonly ui = new Store<HortaUi>({
    boot: { step: 'graphics', progress: 0 },
    screen: 'menu',
    speed: 1,
    stats: null,
    toasts: [],
    locale: bootLocale(),
    name: 'Horta',
    seed: 'horta',
    muted: false,
    saves: [],
  });
  readonly client = new HortaClient();
  readonly renderer = new HortaRenderer();
  readonly sfx: SfxBoard<HortaSound>;
  private toastSeq = 1;
  private readonly keys = new AbortController();

  constructor() {
    this.sfx = createHortaAudio();
    this.ui.set({ muted: this.sfx.muted });
    applyDocumentLocale(this.ui.get().locale);
    this.client.subscribe({
      onInit: () => {
        if (this.client.plots) this.renderer.setWorld(this.client.size, this.client.plots);
      },
      onPlots: () => {
        if (this.client.plots) this.renderer.setPlots(this.client.plots);
      },
      onStats: (stats) => this.ui.set({ stats }),
      onError: (message) => {
        this.sfx.play('error');
        this.toast('error', message);
      },
    });
    this.renderer.setOnPlot((x, y, clear) => void this.handlePlot(x, y, clear));
    window.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'm' || event.key === 'M') {
          if (event.ctrlKey || event.metaKey || event.altKey) return;
          this.setMuted(!this.ui.get().muted);
        }
      },
      { signal: this.keys.signal },
    );
  }

  async boot(host: HTMLElement): Promise<void> {
    this.ui.set({ boot: { step: 'graphics', progress: 0.2 } });
    await this.renderer.init(host);
    this.ui.set({ boot: { step: 'garden', progress: 0.55 } });
    await this.startMenuGarden();
    await this.refreshSaves();
    this.ui.set({ boot: { step: 'done', progress: 1 } });
  }

  setLocale(locale: Locale): void {
    persistLocale(locale);
    applyDocumentLocale(locale);
    this.ui.set({ locale });
  }

  setName(name: string): void {
    this.ui.set({ name });
  }

  setSeed(seed: string): void {
    this.ui.set({ seed });
  }

  setMuted(muted: boolean): void {
    this.sfx.setMuted(muted);
    this.ui.set({ muted });
    if (!muted) this.applyDrone();
  }

  setSpeed(speed: HortaSpeed): void {
    this.ui.set({ speed });
    this.client.setSpeed(speed);
  }

  async newGame(): Promise<void> {
    const { name, seed } = this.ui.get();
    this.renderer.setAttract(false);
    this.renderer.setInputEnabled(true);
    await this.client.newGame({ name: name || 'Horta', seed: seed || 'horta', size: 16 });
    this.setSpeed(1);
    this.ui.set({ screen: 'game' });
    this.applyDrone();
  }

  async continueLatest(): Promise<void> {
    const latest = this.ui.get().saves[0];
    if (!latest) return;
    const text = await store.read(latest.id);
    await this.loadFile(text);
  }

  async loadSlot(id: string): Promise<void> {
    const text = await store.read(id);
    await this.loadFile(text);
  }

  async save(): Promise<void> {
    const { text, meta } = await this.client.exportSave(new Date().toISOString());
    await store.write(
      {
        id: AUTOSAVE_ID,
        savedAt: meta.savedAt,
        name: meta.name,
        autosave: true,
        bytes: text.length,
      },
      text,
    );
    await this.refreshSaves();
    this.sfx.play('save');
    this.toast('info', catalog(this.ui.get().locale).saved);
  }

  async loadFile(text: string): Promise<void> {
    const result = await this.client.importSave(text);
    if (!result.ok) {
      this.sfx.play('error');
      this.toast('error', result.errors[0]?.code ?? 'INVALID');
      return;
    }
    this.renderer.setAttract(false);
    this.renderer.setInputEnabled(true);
    this.setSpeed(0);
    this.ui.set({ screen: 'game', name: result.meta.name, seed: result.meta.seed });
    this.applyDrone();
    this.toast('info', catalog(this.ui.get().locale).loaded);
  }

  exportFile(): void {
    void this.client.exportSave(new Date().toISOString()).then(({ text, meta }) => {
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = slugFileName(meta.name, HORTA_SAVE_EXTENSION, 'horta');
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  backToMenu(): void {
    this.setSpeed(0);
    this.renderer.setInputEnabled(false);
    this.renderer.setAttract(true);
    this.ui.set({ screen: 'menu' });
    this.applyDrone();
  }

  toast(kind: ToastItem['kind'], message: string): void {
    const id = this.toastSeq++;
    this.ui.set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    window.setTimeout(() => this.dismissToast(id), 2800);
  }

  dismissToast(id: number): void {
    this.ui.set((s) => ({ toasts: s.toasts.filter((toast) => toast.id !== id) }));
  }

  dispose(): void {
    this.keys.abort();
    this.sfx.dispose();
    this.client.dispose();
    this.renderer.destroy();
  }

  private async startMenuGarden(): Promise<void> {
    await this.client.newGame({ name: 'Horta', seed: 'horta-menu', size: 16 });
    for (const [x, y] of MENU_PLANTS) {
      await this.client.command({ type: 'plant', x, y });
    }
    this.setSpeed(1);
    this.renderer.setInputEnabled(false);
    this.renderer.setAttract(true);
    this.applyDrone();
  }

  private async refreshSaves(): Promise<void> {
    try {
      this.ui.set({ saves: await store.list() });
    } catch {
      this.ui.set({ saves: [] });
    }
  }

  private applyDrone(): void {
    if (this.sfx.muted) {
      this.sfx.stopDrone();
      return;
    }
    this.sfx.startDrone(hortaDrone(this.ui.get().screen === 'menu' ? 'menu' : 'play'));
  }

  private async handlePlot(x: number, y: number, clear: boolean): Promise<void> {
    const plots = this.client.plots;
    if (!plots) return;
    const state = plots[y * this.client.size + x];
    const type = clear ? 'clear' : state === PLOT_RIPE ? 'harvest' : 'plant';
    const result = await this.client.command({ type, x, y });
    if (!result.ok) {
      this.sfx.play('error');
      return;
    }
    this.sfx.play(type);
  }
}
