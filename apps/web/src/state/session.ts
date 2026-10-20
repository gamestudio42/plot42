import {
  type CityStats,
  type Command,
  type CommandResult,
  type HistoryEntry,
  type LoadResult,
  type NewCityOptions,
  type RejectReason,
  type SimEvent,
  type Speed,
  type ToolCommand,
} from '@city/shared';
import { RoadNetwork, type World } from '@city/simulation';
import { SoundBoard, type SoundName } from '../audio/sound';
import { formatNumber, t } from '../i18n/pt-BR';
import {
  AUTOSAVE_ID,
  deleteSave,
  listSaves,
  manualSlotId,
  readSave,
  saveFileName,
  SaveStorageError,
  writeSave,
  type SaveSlot,
} from '../persistence/saves';
import { GameRenderer } from '../renderer/GameRenderer';
import type { OverlayMode } from '../renderer/chunkDraw';
import type { Point } from '../renderer/iso';
import { ToolController, type ToolPreview } from '../tools/controller';
import { toolByHotkey, type ToolId } from '../tools/tools';
import { CityClient } from './client';
import { installDebugApi } from './debug';
import { Store } from './store';
import { markTutorialDone, TUTORIAL_CHECKS, tutorialDone } from './tutorial';

export interface Toast {
  id: number;
  kind: 'info' | 'warning' | 'error';
  message: string;
}

export type PanelId = 'budget' | 'charts' | 'overlays' | 'system';
export type Screen = 'menu' | 'game';

export interface UiState {
  screen: Screen;
  /** Floating panel currently open (one at a time). */
  panel: PanelId | null;
  /** Current tutorial step, or null when the tutorial is hidden. */
  tutorial: number | null;
  ready: boolean;
  hover: Point | null;
  selected: Point | null;
  overlay: OverlayMode;
  underground: boolean;
  grid: boolean;
  speed: Speed;
  stats: CityStats | null;
  history: HistoryEntry[];
  tool: ToolId;
  preview: ToolPreview | null;
  /** Client position of the pointer over the map, for the tool tooltip. */
  pointer: Point | null;
  toasts: Toast[];
  /** Saved cities in IndexedDB, most recent first. */
  saves: SaveSlot[];
  /** A save or load is in progress. */
  busy: boolean;
  /** Sound effects off (persisted in localStorage). */
  muted: boolean;
  /** Cars, smoke, water glints and fire engines (persisted in localStorage). */
  animations: boolean;
}

const initialUi: UiState = {
  screen: 'menu',
  panel: null,
  tutorial: null,
  ready: false,
  hover: null,
  selected: null,
  overlay: 'none',
  underground: false,
  grid: false,
  speed: 1,
  stats: null,
  history: [],
  tool: 'select',
  preview: null,
  pointer: null,
  toasts: [],
  saves: [],
  busy: false,
  muted: false,
  animations: true,
};

const ANIMATIONS_KEY = 'cityBuilder.animations';

/** Stored choice, or on unless the system asks for reduced motion. */
function readAnimations(): boolean {
  try {
    const stored = localStorage.getItem(ANIMATIONS_KEY);
    if (stored !== null) return stored === '1';
    return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
}

const EVENT_SOUNDS: Partial<Record<SimEvent['type'], SoundName>> = {
  fireStarted: 'fire',
  buildingDestroyed: 'demolish',
  disasterStarted: 'disaster',
  brownout: 'warning',
  waterShortage: 'warning',
  debt: 'warning',
  bankrupt: 'error',
  milestone: 'milestone',
};

const TOAST_MS = 3500;
/** Real time between autosaves while the game screen is open. */
const AUTOSAVE_MS = 60_000;
const AUTOSAVE_CHECK_MS = 5_000;

/** Wires the worker client, the renderer, the tools and the UI store together. */
export class GameSession {
  readonly client = new CityClient();
  readonly renderer = new GameRenderer();
  readonly sound = new SoundBoard();
  readonly ui = new Store<UiState>({
    ...initialUi,
    muted: this.sound.muted,
    animations: readAnimations(),
  });
  readonly tools = new ToolController(this);
  private readonly eventListeners = new Set<(events: SimEvent[]) => void>();
  private readonly cameraListeners = new Set<() => void>();
  private readonly tileListeners = new Set<() => void>();
  private readonly listeners = new AbortController();
  private roadCache: { world: World; roads: RoadNetwork } | null = null;
  private nextToastId = 1;
  private disposed = false;
  private speedBeforePause: Speed = 1;
  private lastAutosave = { time: 0, tick: -1 };
  private autosaveTimer: ReturnType<typeof setInterval> | null = null;

  async mount(host: HTMLElement): Promise<void> {
    this.renderer.setAnimations(this.ui.get().animations);
    this.renderer.setSimSpeed(this.ui.get().speed);
    await this.renderer.init(host);
    if (this.disposed) return;
    this.client.subscribe({
      onInit: () => {
        const world = this.client.world;
        if (world) this.renderer.setWorld(world, this.client.buildings);
        this.tools.cancel();
        this.ui.set({ ready: true, selected: null, hover: null });
      },
      onTiles: (indices, all) => {
        this.renderer.invalidateTiles(all ? null : indices);
        this.tools.refreshCurrent();
        this.notifyTiles();
      },
      onBuildings: (changed) => {
        this.renderer.invalidateBuildings(changed);
        this.notifyTiles();
      },
      onInfluence: () => {
        this.renderer.invalidateOverlay();
        this.notifyTiles();
      },
      onStats: (stats) => {
        this.ui.set({ stats });
        this.checkTutorial();
      },
      onHistory: (history) => this.ui.set({ history }),
      onEvents: (events) => {
        for (const event of events) {
          this.announce(event);
          if (event.type === 'fireStarted') this.renderer.reportFire(event.x, event.y);
        }
        for (const listener of this.eventListeners) listener(events);
      },
      onError: (message) => this.toast('error', message),
    });
    this.renderer.setInput({
      onHover: (tile) => {
        this.ui.set({ hover: tile });
        this.tools.onHover(tile);
      },
      onPointer: (kind, tile, event) => {
        if (kind === 'move') this.ui.set({ pointer: { x: event.clientX, y: event.clientY } });
        this.tools.onPointer(kind, tile);
      },
      onCamera: () => {
        for (const listener of this.cameraListeners) listener();
      },
    });
    window.addEventListener('keydown', (e) => this.onKey(e), { signal: this.listeners.signal });
    for (const type of ['pointerdown', 'keydown'] as const) {
      window.addEventListener(type, () => this.sound.unlock(), { signal: this.listeners.signal });
    }
    host.addEventListener('pointerleave', () => this.ui.set({ pointer: null }), {
      signal: this.listeners.signal,
    });
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.visibilityState === 'hidden') void this.autosave(true);
      },
      { signal: this.listeners.signal },
    );
    this.autosaveTimer = setInterval(() => void this.autosave(false), AUTOSAVE_CHECK_MS);
    installDebugApi(this);
    void this.refreshSaves();
  }

  newCity(options: NewCityOptions): Promise<void> {
    return this.client.newCity(options);
  }

  /** Road graph of the mirror world, recomputed lazily when tiles change. */
  roads(): RoadNetwork | null {
    const world = this.client.world;
    if (!world) return null;
    if (!this.roadCache || this.roadCache.world !== world) {
      this.roadCache = { world, roads: new RoadNetwork(world) };
    }
    this.roadCache.roads.update();
    return this.roadCache.roads;
  }

  /** Creates a city from the main menu and switches to the game screen. */
  async startCity(options: NewCityOptions): Promise<void> {
    await this.client.newCity(options);
    this.enterGame({ tutorial: true });
  }

  /** Shows the game screen after a city was created or loaded (loaded cities start paused). */
  enterGame({ tutorial, paused = false }: { tutorial: boolean; paused?: boolean }): void {
    this.ui.set({
      screen: 'game',
      panel: null,
      tutorial: tutorial && !tutorialDone() ? 0 : null,
      selected: null,
    });
    this.lastAutosave = { time: Date.now(), tick: this.client.stats?.tick ?? -1 };
    this.setTool('select');
    this.setSpeed(paused ? 0 : 1);
    const w = this.client.world;
    if (w) this.renderer.centerOnTile(Math.floor(w.size / 2), Math.floor(w.size / 2));
  }

  async backToMenu(): Promise<void> {
    this.setSpeed(0);
    await this.autosave(true);
    this.ui.set({ screen: 'menu', panel: null, tutorial: null, selected: null });
  }

  // Saves -------------------------------------------------------------------

  async refreshSaves(): Promise<void> {
    try {
      this.ui.set({ saves: await listSaves() });
    } catch (error) {
      // Without IndexedDB the menu simply shows no saves; export/import still work.
      console.warn('[saves]', error);
      this.ui.set({ saves: [] });
    }
  }

  /** Saves the current city into its manual slot (or the autosave slot). */
  async saveGame(autosave = false): Promise<boolean> {
    if (!this.client.world || this.ui.get().busy) return false;
    this.ui.set({ busy: true });
    try {
      const { text, meta } = await this.client.exportSave(new Date().toISOString());
      const id = autosave ? AUTOSAVE_ID : manualSlotId(meta.name, meta.seed);
      await writeSave({ ...meta, id, autosave, bytes: text.length }, text);
      this.lastAutosave = { time: Date.now(), tick: meta.tick };
      if (!autosave) this.toast('info', t.save.saved);
      await this.refreshSaves();
      return true;
    } catch (error) {
      this.reportStorageError(error, t.save.failed);
      return false;
    } finally {
      this.ui.set({ busy: false });
    }
  }

  /** Autosaves when the game is on screen and time has passed since the last save. */
  private async autosave(force: boolean): Promise<void> {
    const ui = this.ui.get();
    const tick = this.client.stats?.tick ?? -1;
    if (ui.screen !== 'game' || ui.busy || tick === this.lastAutosave.tick) return;
    if (!force && Date.now() - this.lastAutosave.time < AUTOSAVE_MS) return;
    await this.saveGame(true);
  }

  async loadSlot(id: string): Promise<LoadResult | null> {
    try {
      return await this.importText(await readSave(id));
    } catch (error) {
      if (error instanceof SaveStorageError && error.kind === 'missing') {
        await deleteSave(id).catch(() => undefined);
        await this.refreshSaves();
      }
      this.reportStorageError(error, t.save.loadFailed);
      return null;
    }
  }

  async continueLatest(): Promise<void> {
    const latest = this.ui.get().saves[0];
    if (latest) await this.loadSlot(latest.id);
  }

  async deleteSlot(id: string): Promise<void> {
    try {
      await deleteSave(id);
    } catch (error) {
      this.reportStorageError(error, t.save.failed);
    }
    await this.refreshSaves();
  }

  /** Validates and loads save text (from IndexedDB or a file). */
  async importText(text: string): Promise<LoadResult> {
    this.ui.set({ busy: true });
    try {
      const result = await this.client.importSave(text);
      if (!result.ok) {
        const first = result.errors[0];
        console.warn('[saves] invalid save', result.errors);
        this.toast(
          'error',
          `${t.save.loadFailed} ${first ? t.save.errors[first.code] : t.save.errors.INVALID}`,
        );
        return result;
      }
      this.enterGame({ tutorial: false, paused: true });
      this.toast('info', t.save.loaded(result.meta.name));
      if (result.migratedFrom !== null) this.toast('info', t.save.migrated(result.migratedFrom));
      return result;
    } finally {
      this.ui.set({ busy: false });
    }
  }

  async importFile(file: File): Promise<LoadResult> {
    return this.importText(await file.text());
  }

  /** Downloads the current city as a `.city.json` file. */
  async exportFile(): Promise<void> {
    if (!this.client.world) return;
    const { text, meta } = await this.client.exportSave(new Date().toISOString());
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = saveFileName(meta.name);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    this.toast('info', t.save.exported);
  }

  private reportStorageError(error: unknown, fallback: string): void {
    console.warn('[saves]', error);
    if (error instanceof SaveStorageError && error.kind !== 'unknown') {
      this.toast('error', t.save[error.kind]);
    } else {
      this.toast('error', fallback);
    }
  }

  togglePanel(panel: PanelId): void {
    this.ui.set({ panel: this.ui.get().panel === panel ? null : panel });
    this.checkTutorial();
  }

  closePanel(): void {
    this.ui.set({ panel: null });
  }

  advanceTutorial(): void {
    const step = this.ui.get().tutorial;
    if (step === null) return;
    if (step + 1 >= TUTORIAL_CHECKS.length) {
      this.skipTutorial();
      return;
    }
    this.ui.set({ tutorial: step + 1 });
    this.checkTutorial();
  }

  skipTutorial(): void {
    markTutorialDone();
    this.ui.set({ tutorial: null });
  }

  /** Sends a command and reports a refusal to the player. */
  async command(command: Command): Promise<CommandResult> {
    const result = await this.client.command(command);
    if (!result.ok && result.reason) this.notifyReason(result.reason);
    return result;
  }

  onEvents(listener: (events: SimEvent[]) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  onCamera(listener: () => void): () => void {
    this.cameraListeners.add(listener);
    return () => this.cameraListeners.delete(listener);
  }

  /** Called when tiles, buildings or influence maps change in the mirror world. */
  onTilesChanged(listener: () => void): () => void {
    this.tileListeners.add(listener);
    return () => this.tileListeners.delete(listener);
  }

  setTool(id: ToolId): void {
    this.tools.setTool(id);
  }

  select(tile: Point | null): void {
    this.ui.set({ selected: tile });
  }

  setSpeed(speed: Speed): void {
    if (speed !== 0) this.speedBeforePause = speed;
    this.client.setSpeed(speed);
    this.renderer.setSimSpeed(speed);
    this.ui.set({ speed });
  }

  togglePause(): void {
    this.setSpeed(this.ui.get().speed === 0 ? this.speedBeforePause : 0);
  }

  setOverlay(overlay: OverlayMode): void {
    this.renderer.setOverlay(overlay);
    this.ui.set({ overlay });
  }

  setUnderground(underground: boolean): void {
    this.renderer.setUnderground(underground);
    this.ui.set({ underground });
  }

  setGrid(grid: boolean): void {
    this.renderer.setGrid(grid);
    this.ui.set({ grid });
  }

  toast(kind: Toast['kind'], message: string): void {
    const id = this.nextToastId++;
    const toasts = [
      ...this.ui.get().toasts.filter((x) => x.message !== message),
      { id, kind, message },
    ].slice(-4);
    this.ui.set({ toasts });
    setTimeout(() => this.dismissToast(id), TOAST_MS);
  }

  dismissToast(id: number): void {
    this.ui.set({ toasts: this.ui.get().toasts.filter((x) => x.id !== id) });
  }

  notifyReason(reason: RejectReason): void {
    this.sound.play('error');
    this.toast(
      reason === 'INSUFFICIENT_FUNDS' || reason === 'BANKRUPT' ? 'error' : 'warning',
      t.reasons[reason],
    );
  }

  onBuilt(command: ToolCommand): void {
    this.sound.play(
      command.type === 'zone' ? 'zone' : command.type === 'demolish' ? 'demolish' : 'build',
    );
    this.checkTutorial();
  }

  setMuted(muted: boolean): void {
    this.sound.setMuted(muted);
    this.ui.set({ muted });
  }

  setAnimations(animations: boolean): void {
    this.renderer.setAnimations(animations);
    this.ui.set({ animations });
    try {
      localStorage.setItem(ANIMATIONS_KEY, animations ? '1' : '0');
    } catch {
      // Private mode or blocked storage: the choice lasts for this session only.
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.autosaveTimer) clearInterval(this.autosaveTimer);
    this.sound.dispose();
    this.listeners.abort();
    this.renderer.destroy();
    this.client.dispose();
  }

  private notifyTiles(): void {
    for (const listener of this.tileListeners) listener();
  }

  private checkTutorial(): void {
    const step = this.ui.get().tutorial;
    if (step === null) return;
    const check = TUTORIAL_CHECKS[step];
    if (check?.(this)) this.advanceTutorial();
  }

  private announce(event: SimEvent): void {
    const sound = EVENT_SOUNDS[event.type];
    if (sound) this.sound.play(sound);
    const e = t.events;
    switch (event.type) {
      case 'fireStarted':
        return this.toast('error', e.fireStarted);
      case 'buildingDestroyed':
        return this.toast('error', e.buildingDestroyed[event.cause]);
      case 'disasterStarted':
        return this.toast('error', e.disasterStarted(t.disasters[event.disaster]));
      case 'disasterEnded':
        return this.toast('info', e.disasterEnded(t.disasters[event.disaster]));
      case 'brownout':
        return this.toast('warning', e.brownout);
      case 'waterShortage':
        return this.toast('warning', e.waterShortage);
      case 'debt':
        return this.toast('warning', e.debt(event.months));
      case 'bankrupt':
        return this.toast('error', e.bankrupt);
      case 'recovered':
        return this.toast('info', e.recovered);
      case 'milestone':
        return this.toast('info', e.milestone(formatNumber(event.population)));
      case 'newYear':
        return this.toast('info', e.newYear(event.year));
    }
  }

  private onKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
    )
      return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (this.ui.get().screen !== 'game') return;
    const key = e.key.toLowerCase();
    if (key === 'escape') {
      if (this.ui.get().panel) return this.closePanel();
      this.tools.cancel();
      this.setTool('select');
      this.select(null);
      return;
    }
    if (key === 'p') return this.togglePause();
    if (key === 'm') return this.setMuted(!this.ui.get().muted);
    if (key === 'u') return this.setUnderground(!this.ui.get().underground);
    if (key === 'g') return this.setGrid(!this.ui.get().grid);
    const tool = toolByHotkey(key);
    if (tool) this.setTool(tool.id);
  }
}
