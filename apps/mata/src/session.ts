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
import { SaveStore, slugFileName, Store, type SfxBoard, type ToastItem } from '@shell/chrome';
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
  hasSession: boolean;
  busy: boolean;
  saveError: boolean;
  bootError: boolean;
  guideOpen: boolean;
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
    hasSession: false,
    busy: false,
    saveError: false,
    bootError: false,
    guideOpen: false,
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
  private activeSlotId: string | null = null;
  private saveQueue: Promise<void> = Promise.resolve();
  private pendingSaves = 0;
  private disposed = false;
  private autosaveTimer: ReturnType<typeof setInterval> | undefined;
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
      onError: () => {
        if (this.disposed) return;
        this.ui.set({ bootError: true });
        this.renderer.setInputEnabled(false);
      },
    });
    this.renderer.setOnPlot(
      (x, y, clear) => void this.handlePlot(x, y, clear).catch(() => this.reportError()),
    );
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
    if (this.disposed) return;
    this.ui.set({ boot: { step: 'grove', progress: 0.55 } });
    await this.startMenuGrove();
    await this.refreshSaves();
    this.ui.set({ boot: { step: 'done', progress: 1 } });
    this.autosaveTimer = setInterval(() => {
      if (this.ui.get().screen === 'game' && !this.ui.get().busy && !this.ui.get().bootError)
        void this.save(false);
    }, 10_000);
    document.addEventListener(
      'visibilitychange',
      () => {
        if (
          document.hidden &&
          this.activeSlotId &&
          !this.ui.get().busy &&
          !this.ui.get().bootError
        ) {
          this.setSpeed(0);
          void this.save(false);
        }
      },
      { signal: this.keys.signal },
    );
    window.addEventListener(
      'beforeunload',
      (event) => {
        if (this.activeSlotId && (this.pendingSaves > 0 || this.ui.get().saveError)) {
          event.preventDefault();
          event.returnValue = '';
        }
      },
      { signal: this.keys.signal },
    );
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
    if (this.ui.get().guideOpen && speed !== 0) return;
    const outcome = this.ui.get().stats?.outcome;
    const next = outcome && outcome !== 'playing' ? 0 : speed;
    this.ui.set({ speed: next });
    this.client.setSpeed(next);
  }

  openGuide(): void {
    this.setSpeed(0);
    this.ui.set({ guideOpen: true });
  }

  closeGuide(): void {
    this.ui.set({ guideOpen: false });
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
    await this.transition(async () => {
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
      this.setSpeed(0);
      this.ui.set({ screen: 'game', inspect: null, guideOpen: true });
      this.activeSlotId = crypto.randomUUID();
      this.ui.set({ hasSession: true });
      this.applyDrone();
      await this.save(false);
    });
  }

  resume(): void {
    if (!this.activeSlotId || this.ui.get().busy) return;
    this.renderer.setAttract(false, true);
    this.renderer.setInputEnabled(true);
    this.ui.set({ screen: 'game' });
    this.applyDrone();
  }

  async continueLatest(): Promise<void> {
    if (this.activeSlotId) {
      this.resume();
      return;
    }
    const latest = this.ui.get().saves[0];
    if (latest) await this.loadSlot(latest.id);
  }

  async loadSlot(id: string): Promise<void> {
    if (id === this.activeSlotId) {
      this.resume();
      return;
    }
    await this.transition(async () => {
      const text = await store.read(id);
      await this.importWorld(text, id);
    });
  }

  async save(notify = true): Promise<boolean> {
    if (notify && this.ui.get().busy) return false;
    const id = this.activeSlotId;
    if (!id || this.disposed) return true;
    this.pendingSaves++;
    const task = this.saveQueue.then(async () => {
      try {
        if (this.disposed) return false;
        const { text, meta } = await this.client.exportSave(new Date().toISOString());
        await store.write(
          {
            id,
            savedAt: meta.savedAt,
            name: meta.name,
            autosave: !notify,
            bytes: new Blob([text]).size,
          },
          text,
        );
        if (this.disposed) return true;
        this.ui.set({ saveError: false });
        await this.refreshSaves();
        if (notify) {
          this.sfx.play('save');
          this.toast('info', catalog(this.ui.get().locale).saved);
        }
        return true;
      } catch {
        if (!this.disposed) this.ui.set({ saveError: true });
        return false;
      } finally {
        this.pendingSaves--;
      }
    });
    this.saveQueue = task.then(() => undefined);
    return task;
  }

  async loadFile(text: string): Promise<void> {
    await this.transition(() => this.importWorld(text, crypto.randomUUID()));
  }

  async openFile(file: File): Promise<void> {
    try {
      await this.loadFile(await file.text());
    } catch {
      this.reportError();
    }
  }

  private async importWorld(text: string, id: string): Promise<void> {
    const result = await this.client.importSave(text);
    if (!result.ok) {
      this.sfx.play('error');
      this.toast('error', catalog(this.ui.get().locale).invalidSave);
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
    this.activeSlotId = id;
    this.ui.set({ hasSession: true, guideOpen: result.meta.tick === 0 });
    await this.save(false);
    this.toast('info', catalog(this.ui.get().locale).loaded);
  }

  exportFile(): void {
    void this.client
      .exportSave(new Date().toISOString())
      .then(({ text, meta }) => {
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = slugFileName(meta.name, MATA_SAVE_EXTENSION, 'mata');
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      })
      .catch(() => this.reportError());
  }

  backToMenu(): void {
    if (this.ui.get().busy) return;
    this.setSpeed(0);
    this.renderer.setInputEnabled(false);
    this.renderer.setAttract(true);
    this.ui.set({ screen: 'menu', inspect: null });
    this.applyDrone();
    void this.save(false);
  }

  private async transition(action: () => Promise<void>): Promise<void> {
    if (this.ui.get().busy || this.ui.get().bootError) return;
    this.ui.set({ busy: true });
    this.renderer.setInputEnabled(false);
    this.setSpeed(0);
    try {
      // Do not replace an active world unless its checkpoint has committed.
      if (this.activeSlotId && !(await this.save(false))) return;
      await action();
    } catch {
      this.reportError();
    } finally {
      if (!this.disposed) {
        this.ui.set({ busy: false });
        this.renderer.setInputEnabled(this.ui.get().screen === 'game' && !this.ui.get().bootError);
      }
    }
  }

  private reportError(): void {
    if (!this.disposed) this.toast('error', catalog(this.ui.get().locale).operationFailed);
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
    this.disposed = true;
    clearInterval(this.autosaveTimer);
    this.keys.abort();
    this.sfx.dispose();
    this.client.dispose();
    this.renderer.destroy();
  }

  private async startMenuGrove(): Promise<void> {
    await this.client.newGame({
      name: 'Mata',
      seed: 'mata-menu',
      size: MATA_SIZE_DEFAULT,
      preset: 'menu',
    });
    this.setSpeed(1);
    this.renderer.setInputEnabled(false);
    this.renderer.setAttract(true);
    this.applyDrone();
  }

  private async refreshSaves(): Promise<void> {
    try {
      this.ui.set({ saves: await store.list() });
    } catch {
      this.ui.set({ saveError: true });
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
      void this.save(false);
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
    if (this.ui.get().busy || this.ui.get().screen !== 'game' || this.ui.get().bootError) return;
    if ((this.ui.get().stats?.outcome ?? 'playing') !== 'playing') return;
    const tool = this.ui.get().tool;
    const command =
      shift || tool === 'clear'
        ? { type: 'clear' as const, x, y }
        : tool === 'water'
          ? { type: 'water' as const, x, y }
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
    void this.save(false);
  }
}
