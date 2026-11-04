import { POSTO_SAVE_EXTENSION, type Outcome, type PostoStats } from '@posto/sim';
import { SaveStore, slugFileName, Store, type SfxBoard, type ToastItem } from '@shell/chrome';
import { isTyping } from '@shell/view-iso';
import { createPostoAudio, postoDrone, type PostoSound } from './audio';
import { PostoClient } from './client';
import { applyDocumentLocale, bootLocale, catalog, persistLocale, type Locale } from './i18n';
import { PostoRenderer } from './renderer';

export type Screen = 'menu' | 'game';

export interface BootState {
  step: 'graphics' | 'outpost' | 'done';
  progress: number;
}

export interface PostoSaveSlot {
  id: string;
  savedAt: string;
  name: string;
  autosave: boolean;
  bytes: number;
}

export interface PostoUi {
  boot: BootState;
  screen: Screen;
  hasSession: boolean;
  busy: boolean;
  saveError: boolean;
  bootError: boolean;
  stats: PostoStats | null;
  selectedId: number | null;
  toasts: ToastItem[];
  locale: Locale;
  name: string;
  seed: string;
  muted: boolean;
  saves: PostoSaveSlot[];
}

const store = new SaveStore<PostoSaveSlot>('posto');

export class PostoSession {
  readonly ui = new Store<PostoUi>({
    boot: { step: 'graphics', progress: 0 },
    screen: 'menu',
    hasSession: false,
    busy: false,
    saveError: false,
    bootError: false,
    stats: null,
    selectedId: null,
    toasts: [],
    locale: bootLocale(),
    name: 'Posto',
    seed: 'posto',
    muted: false,
    saves: [],
  });
  readonly client = new PostoClient();
  readonly renderer = new PostoRenderer();
  readonly sfx: SfxBoard<PostoSound>;
  private toastSeq = 1;
  private activeSlotId: string | null = null;
  private saveQueue: Promise<void> = Promise.resolve();
  private pendingSaves = 0;
  private disposed = false;
  private autosaveTimer: ReturnType<typeof setInterval> | undefined;
  private lastOutcome: Outcome = 'playing';
  private readonly keys = new AbortController();

  constructor() {
    this.sfx = createPostoAudio();
    this.ui.set({ muted: this.sfx.muted });
    applyDocumentLocale(this.ui.get().locale);
    this.client.subscribe({
      onInit: () => {
        this.renderer.setWorld(this.client.size, this.client.units);
        this.lastOutcome = this.client.stats?.outcome ?? 'playing';
        this.renderer.setOutcome(this.lastOutcome);
      },
      onUnits: () => this.renderer.setUnits(this.client.units),
      onStats: (stats) => {
        this.ui.set({ stats });
        this.announceOutcome(stats.outcome);
      },
      onError: () => {
        if (this.disposed) return;
        this.ui.set({ bootError: true });
        this.renderer.setInputEnabled(false);
      },
    });
    this.renderer.setOnTile((x, y) => void this.handleTile(x, y).catch(() => this.reportError()));
    window.addEventListener(
      'keydown',
      (event) => {
        if (isTyping(event)) return;
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
    if (this.disposed) return;
    this.ui.set({ boot: { step: 'outpost', progress: 0.6 } });
    await this.startMenuOutpost();
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

  async newGame(): Promise<void> {
    await this.transition(async () => {
      const { name, seed } = this.ui.get();
      this.select(null);
      this.lastOutcome = 'playing';
      this.renderer.setAttract(false);
      this.renderer.setInputEnabled(true);
      this.renderer.setOutcome('playing');
      await this.client.newGame({ name: name || 'Posto', seed: seed || 'posto' });
      this.ui.set({ screen: 'game' });
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
    this.select(null);
    this.lastOutcome = result.meta.outcome;
    this.renderer.setAttract(false);
    this.renderer.setInputEnabled(true);
    this.renderer.setOutcome(result.meta.outcome);
    this.ui.set({ screen: 'game', name: result.meta.name, seed: result.meta.seed });
    this.applyDrone();
    this.activeSlotId = id;
    this.ui.set({ hasSession: true });
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
        a.download = slugFileName(meta.name, POSTO_SAVE_EXTENSION, 'posto');
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      })
      .catch(() => this.reportError());
  }

  backToMenu(): void {
    if (this.ui.get().busy) return;
    this.select(null);
    this.renderer.setInputEnabled(false);
    this.renderer.setAttract(true);
    this.ui.set({ screen: 'menu' });
    this.applyDrone();
    void this.save(false);
  }

  private async transition(action: () => Promise<void>): Promise<void> {
    if (this.ui.get().busy || this.ui.get().bootError) return;
    this.ui.set({ busy: true });
    this.renderer.setInputEnabled(false);
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

  private async startMenuOutpost(): Promise<void> {
    await this.client.newGame({ name: 'Posto', seed: 'posto-menu' });
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
    this.sfx.startDrone(postoDrone(this.ui.get().screen === 'menu' ? 'menu' : 'play'));
  }

  private select(id: number | null): void {
    this.ui.set({ selectedId: id });
    this.renderer.setSelected(id);
  }

  private announceOutcome(outcome: Outcome): void {
    if (outcome === this.lastOutcome) return;
    this.lastOutcome = outcome;
    const t = catalog(this.ui.get().locale);
    this.renderer.setOutcome(outcome);
    if (outcome !== 'playing') this.renderer.setInputEnabled(false);
    if (outcome === 'victory') {
      this.sfx.play('victory');
      this.toast('info', t.victory);
    }
    if (outcome === 'defeat') {
      this.sfx.play('defeat');
      this.toast('error', t.defeat);
    }
  }

  private async handleTile(x: number, y: number): Promise<void> {
    if (this.ui.get().busy || this.ui.get().screen !== 'game' || this.ui.get().bootError) return;
    if (this.client.stats?.outcome !== 'playing') return;
    const occupant = this.client.units.find((unit) => unit.hp > 0 && unit.x === x && unit.y === y);
    const selected = this.client.units.find((unit) => unit.id === this.ui.get().selectedId);
    if (occupant?.side === 'player') {
      this.select(occupant.id);
      this.sfx.play('select');
      return;
    }
    if (selected && selected.side === 'player' && selected.hp > 0) {
      if (occupant?.side === 'enemy') {
        const result = await this.client.command({
          type: 'attack',
          unitId: selected.id,
          targetId: occupant.id,
        });
        if (!result.ok) this.sfx.play('error');
        else {
          this.sfx.play('attack');
          void this.save(false);
        }
        const still = this.client.units.find((unit) => unit.id === selected.id);
        this.select(still && still.hp > 0 ? still.id : null);
        return;
      }
      if (!occupant) {
        const result = await this.client.command({ type: 'move', unitId: selected.id, x, y });
        if (!result.ok) this.sfx.play('error');
        else {
          this.sfx.play('move');
          void this.save(false);
        }
        return;
      }
    }
    this.select(null);
  }
}
