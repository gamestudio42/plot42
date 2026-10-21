import {
  diagnoseTile,
  MATA_OVERLAYS,
  MATA_SAVE_EXTENSION,
  MATA_SIZE_DEFAULT,
  toolSpecies,
  type MataOverlay,
  type MataSpeed,
  type MataStats,
  type MataTool,
  type TileFacts,
} from '@mata/sim';
import {
  AUTOSAVE_ID,
  SaveStore,
  slugFileName,
  Store,
  type SfxBoard,
  type ToastItem,
} from '@shell/chrome';
import { isTyping } from '@shell/view-iso';
import { createMataAudio, mataDrone, type MataSound } from './audio';
import { MataClient } from './client';
import { applyDocumentLocale, bootLocale, catalog, persistLocale, type Locale } from './i18n';
import { MataRenderer } from './renderer';

export type Screen = 'menu' | 'game';

export interface BootState {
  step: 'graphics' | 'grove' | 'done';
  progress: number;
}

export interface MataSaveSlot {
  id: string;
  savedAt: string;
  name: string;
  autosave: boolean;
  bytes: number;
}

export interface MataUi {
  boot: BootState;
  screen: Screen;
  speed: MataSpeed;
  stats: MataStats | null;
  toasts: ToastItem[];
  locale: Locale;
  name: string;
  seed: string;
  muted: boolean;
  saves: MataSaveSlot[];
  tool: MataTool;
  overlay: MataOverlay;
  inspect: TileFacts | null;
}

const store = new SaveStore<MataSaveSlot>('mata');

const TOOL_KEYS: Record<string, MataTool> = {
  '1': 'grass',
  '2': 'crown',
  '3': 'fern',
  '4': 'inga',
  '5': 'cactus',
  t: 'water',
  x: 'clear',
};

export class MataSession {
  readonly ui = new Store<MataUi>({
    boot: { step: 'graphics', progress: 0 },
    screen: 'menu',
    speed: 1,
    stats: null,
    toasts: [],
    locale: bootLocale(),
    name: 'Mata',
    seed: 'mata',
    muted: false,
    saves: [],
    tool: 'grass',
    overlay: 'none',
    inspect: null,
  });
  readonly client = new MataClient();
  readonly renderer = new MataRenderer();
  readonly sfx: SfxBoard<MataSound>;
  private toastSeq = 1;
  private readonly keys = new AbortController();
  private sawWarned = false;
  private sawDrought = false;
  private sawOutcome = false;

  constructor() {
    this.sfx = createMataAudio();
    this.ui.set({ muted: this.sfx.muted });
    applyDocumentLocale(this.ui.get().locale);
    this.client.subscribe({
      onInit: () => {
        if (this.client.size) this.renderer.setWorld(this.client);
        this.refreshInspect();
      },
      onWorld: () => {
        this.renderer.setLayers(this.client);
        this.refreshInspect();
      },
      onStats: (stats) => {
        this.ui.set({ stats });
        this.announce(stats);
      },
      onError: (message) => {
        this.sfx.play('error');
        this.toast('error', message);
      },
    });
    this.renderer.setOnPlot((x, y, clear) => void this.handlePlot(x, y, clear));
    this.renderer.setOnHover((tile) => {
      if (!tile) {
        this.ui.set({ inspect: null });
        return;
      }
      this.ui.set({ inspect: diagnoseTile(this.client, tile.x, tile.y) });
    });
    window.addEventListener('keydown', (event) => this.onKey(event), { signal: this.keys.signal });
  }

  async boot(host: HTMLElement): Promise<void> {
    this.ui.set({ boot: { step: 'graphics', progress: 0.2 } });
    await this.renderer.init(host);
    this.ui.set({ boot: { step: 'grove', progress: 0.55 } });
    await this.startMenuGrove();
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

  setSpeed(speed: MataSpeed): void {
    const outcome = this.ui.get().stats?.outcome;
    const next = outcome && outcome !== 'playing' ? 0 : speed;
    this.ui.set({ speed: next });
    this.client.setSpeed(next);
  }

  setTool(tool: MataTool): void {
    this.ui.set({ tool });
  }

  setOverlay(overlay: MataOverlay): void {
    this.ui.set({ overlay });
    this.renderer.setOverlay(overlay);
  }

  cycleOverlay(): void {
    const current = this.ui.get().overlay;
    const i = MATA_OVERLAYS.indexOf(current);
    this.setOverlay(MATA_OVERLAYS[(i + 1) % MATA_OVERLAYS.length] ?? 'none');
  }

  async newGame(): Promise<void> {
    const { name, seed } = this.ui.get();
    this.sawWarned = false;
    this.sawDrought = false;
    this.sawOutcome = false;
    this.renderer.setAttract(false);
    this.renderer.setInputEnabled(true);
    await this.client.newGame({
      name: name || 'Mata',
      seed: seed || 'mata',
      size: MATA_SIZE_DEFAULT,
      preset: 'wild',
    });
    this.renderer.setInputEnabled(true);
    this.setSpeed(1);
    this.ui.set({ screen: 'game', inspect: null });
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
    this.sawWarned = result.meta.outcome !== 'playing';
    this.sawDrought = result.meta.outcome !== 'playing';
    this.sawOutcome = result.meta.outcome !== 'playing';
    this.renderer.setAttract(false);
    this.renderer.setInputEnabled(result.meta.outcome === 'playing');
    this.setSpeed(0);
    this.ui.set({ screen: 'game', name: result.meta.name, seed: result.meta.seed, inspect: null });
    this.applyDrone();
    this.toast('info', catalog(this.ui.get().locale).loaded);
  }

  exportFile(): void {
    void this.client.exportSave(new Date().toISOString()).then(({ text, meta }) => {
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = slugFileName(meta.name, MATA_SAVE_EXTENSION, 'mata');
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  backToMenu(): void {
    this.setSpeed(0);
    this.renderer.setInputEnabled(false);
    this.renderer.setAttract(true);
    this.ui.set({ screen: 'menu', inspect: null });
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

  private async startMenuGrove(): Promise<void> {
    await this.client.newGame({ name: 'Mata', seed: 'mata-menu', size: MATA_SIZE_DEFAULT, preset: 'menu' });
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
    this.sfx.startDrone(mataDrone(this.ui.get().screen === 'menu' ? 'menu' : 'play'));
  }

  private refreshInspect(): void {
    const inspect = this.ui.get().inspect;
    if (!inspect || !this.client.size) return;
    this.ui.set({ inspect: diagnoseTile(this.client, inspect.x, inspect.y) });
  }

  private announce(stats: MataStats): void {
    if (this.ui.get().screen !== 'game') return;
    const t = catalog(this.ui.get().locale);
    if (stats.phase === 'warned' && !this.sawWarned) {
      this.sawWarned = true;
      this.toast('info', t.droughtWarn.replace('{n}', String(stats.droughtIn)));
    }
    if (stats.phase === 'drought' && !this.sawDrought) {
      this.sawDrought = true;
      this.toast('error', t.droughtNow.replace('{n}', String(stats.droughtLeft)));
    }
    if (stats.outcome !== 'playing' && !this.sawOutcome) {
      this.sawOutcome = true;
      this.setSpeed(0);
      this.renderer.setInputEnabled(false);
      this.sfx.play(stats.outcome === 'won' ? 'restore' : 'error');
    }
  }

  private onKey(event: KeyboardEvent): void {
    if (isTyping(event) || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === 'm') {
      this.setMuted(!this.ui.get().muted);
      return;
    }
    if (this.ui.get().screen !== 'game') return;
    if (key === 'p') {
      this.setSpeed(this.ui.get().speed === 0 ? 1 : 0);
      return;
    }
    if (key === 'o') {
      this.cycleOverlay();
      return;
    }
    const tool = TOOL_KEYS[key];
    if (tool) this.setTool(tool);
  }

  private async handlePlot(x: number, y: number, shift: boolean): Promise<void> {
    if ((this.ui.get().stats?.outcome ?? 'playing') !== 'playing') return;
    const tool = this.ui.get().tool;
    const command = shift || tool === 'clear'
      ? ({ type: 'clear' as const, x, y })
      : tool === 'water'
        ? ({ type: 'water' as const, x, y })
        : (() => {
            const species = toolSpecies(tool);
            return species ? { type: 'plant' as const, x, y, species } : null;
          })();
    if (!command) return;
    const result = await this.client.command(command);
    if (!result.ok) {
      this.sfx.play('error');
      return;
    }
    this.sfx.play(command.type === 'plant' ? 'plant' : command.type);
  }
}
