import type { CityStats, HistoryEntry, NewCityOptions, Speed } from '@city/shared';
import { GameRenderer } from '../renderer/GameRenderer';
import type { OverlayMode } from '../renderer/chunkDraw';
import type { Point } from '../renderer/iso';
import { CityClient } from './client';
import { installDebugApi } from './debug';
import { Store } from './store';

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
};

/** Wires the worker client, the renderer and the UI store together. */
export class GameSession {
  readonly client = new CityClient();
  readonly renderer = new GameRenderer();
  readonly ui = new Store<UiState>(initialUi);
  private disposed = false;

  async mount(host: HTMLElement): Promise<void> {
    await this.renderer.init(host);
    if (this.disposed) return;
    this.client.subscribe({
      onInit: () => {
        const world = this.client.world;
        if (world) this.renderer.setWorld(world, this.client.buildings);
        this.ui.set({ ready: true, selected: null, hover: null });
      },
      onTiles: (indices, all) => this.renderer.invalidateTiles(all ? null : indices),
      onBuildings: (changed) => this.renderer.invalidateBuildings(changed),
      onInfluence: () => this.renderer.invalidateOverlay(),
      onStats: (stats) => this.ui.set({ stats }),
      onHistory: (history) => this.ui.set({ history }),
    });
    this.renderer.setInput({
      onHover: (tile) => this.ui.set({ hover: tile }),
      onPointer: (kind, tile) => {
        if (kind === 'down' && tile) this.ui.set({ selected: tile });
      },
    });
    installDebugApi(this);
  }

  newCity(options: NewCityOptions): Promise<void> {
    return this.client.newCity(options);
  }

  setSpeed(speed: Speed): void {
    this.client.setSpeed(speed);
    this.ui.set({ speed });
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

  dispose(): void {
    this.disposed = true;
    this.renderer.destroy();
    this.client.dispose();
  }
}
