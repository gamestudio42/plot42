import type { CityStats, HistoryEntry, NewCityOptions, RejectReason, SimEvent, Speed } from '@city/shared';
import { t } from '../i18n/pt-BR';
import { GameRenderer } from '../renderer/GameRenderer';
import type { OverlayMode } from '../renderer/chunkDraw';
import type { Point } from '../renderer/iso';
import { ToolController, type ToolPreview } from '../tools/controller';
import { toolByHotkey, type ToolId } from '../tools/tools';
import { CityClient } from './client';
import { installDebugApi } from './debug';
import { Store } from './store';

export interface Toast {
  id: number;
  kind: 'info' | 'warning' | 'error';
  message: string;
}

export interface UiState {
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
  private readonly listeners = new AbortController();
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
      },
      onBuildings: (changed) => this.renderer.invalidateBuildings(changed),
      onInfluence: () => this.renderer.invalidateOverlay(),
      onStats: (stats) => this.ui.set({ stats }),
      onHistory: (history) => this.ui.set({ history }),
      onEvents: (events) => {
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
    });
    window.addEventListener('keydown', (e) => this.onKey(e), { signal: this.listeners.signal });
    host.addEventListener('pointerleave', () => this.ui.set({ pointer: null }), { signal: this.listeners.signal });
    installDebugApi(this);
  }

  newCity(options: NewCityOptions): Promise<void> {
    return this.client.newCity(options);
  }

  onEvents(listener: (events: SimEvent[]) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
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
    const toasts = [...this.ui.get().toasts.filter((x) => x.message !== message), { id, kind, message }].slice(-4);
    this.ui.set({ toasts });
    setTimeout(() => this.dismissToast(id), TOAST_MS);
  }

  dismissToast(id: number): void {
    this.ui.set({ toasts: this.ui.get().toasts.filter((x) => x.id !== id) });
  }

  notifyReason(reason: RejectReason): void {
    this.toast(reason === 'INSUFFICIENT_FUNDS' || reason === 'BANKRUPT' ? 'error' : 'warning', t.reasons[reason]);
  }

  onBuilt(_cost: number): void {}

  dispose(): void {
    this.disposed = true;
    this.listeners.abort();
    this.renderer.destroy();
    this.client.dispose();
  }

  private onKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 'escape') {
      this.tools.cancel();
      this.setTool('select');
      return;
    }
    if (key === 'p') return this.togglePause();
    if (key === 'u') return this.setUnderground(!this.ui.get().underground);
    if (key === 'g') return this.setGrid(!this.ui.get().grid);
    const tool = toolByHotkey(key);
    if (tool) this.setTool(tool.id);
  }
}
