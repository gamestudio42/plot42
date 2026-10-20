import type {
  CityStats,
  Command,
  CommandResult,
  HistoryEntry,
  NewCityOptions,
  RejectReason,
  SimEvent,
  Speed,
} from '@city/shared';
import { RoadNetwork, type World } from '@city/simulation';
import { formatNumber, t } from '../i18n/pt-BR';
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
};

const TOAST_MS = 3500;

/** Wires the worker client, the renderer, the tools and the UI store together. */
export class GameSession {
  readonly client = new CityClient();
  readonly renderer = new GameRenderer();
  readonly ui = new Store<UiState>(initialUi);
  readonly tools = new ToolController(this);
  private readonly eventListeners = new Set<(events: SimEvent[]) => void>();
  private readonly cameraListeners = new Set<() => void>();
  private readonly tileListeners = new Set<() => void>();
  private readonly listeners = new AbortController();
  private roadCache: { world: World; roads: RoadNetwork } | null = null;
  private nextToastId = 1;
  private disposed = false;
  private speedBeforePause: Speed = 1;

  async mount(host: HTMLElement): Promise<void> {
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
        for (const event of events) this.announce(event);
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
    host.addEventListener('pointerleave', () => this.ui.set({ pointer: null }), {
      signal: this.listeners.signal,
    });
    installDebugApi(this);
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
    this.enterGame();
  }

  /** Shows the game screen after a city was created or loaded. */
  enterGame(): void {
    this.ui.set({
      screen: 'game',
      panel: null,
      tutorial: tutorialDone() ? null : 0,
      selected: null,
    });
    this.setTool('select');
    this.setSpeed(1);
    const w = this.client.world;
    if (w) this.renderer.centerOnTile(Math.floor(w.size / 2), Math.floor(w.size / 2));
  }

  backToMenu(): void {
    this.setSpeed(0);
    this.ui.set({ screen: 'menu', panel: null, tutorial: null, selected: null });
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
    this.toast(
      reason === 'INSUFFICIENT_FUNDS' || reason === 'BANKRUPT' ? 'error' : 'warning',
      t.reasons[reason],
    );
  }

  onBuilt(_cost: number): void {
    this.checkTutorial();
  }

  dispose(): void {
    this.disposed = true;
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
    if (key === 'u') return this.setUnderground(!this.ui.get().underground);
    if (key === 'g') return this.setGrid(!this.ui.get().grid);
    const tool = toolByHotkey(key);
    if (tool) this.setTool(tool.id);
  }
}
