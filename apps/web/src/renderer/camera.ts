import type { Container } from 'pixi.js';
import type { Point } from './iso';

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2.5;

/** 2D camera: (x, y) is the world point shown at the centre of the viewport. */
export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  viewWidth = 1;
  viewHeight = 1;
  bounds = { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 };

  apply(root: Container): void {
    root.scale.set(this.zoom);
    root.position.set(
      Math.round(this.viewWidth / 2 - this.x * this.zoom),
      Math.round(this.viewHeight / 2 - this.y * this.zoom),
    );
  }

  screenToWorld(sx: number, sy: number): Point {
    return {
      x: (sx - this.viewWidth / 2) / this.zoom + this.x,
      y: (sy - this.viewHeight / 2) / this.zoom + this.y,
    };
  }

  worldToScreen(wx: number, wy: number): Point {
    return {
      x: (wx - this.x) * this.zoom + this.viewWidth / 2,
      y: (wy - this.y) * this.zoom + this.viewHeight / 2,
    };
  }

  pan(dxScreen: number, dyScreen: number): void {
    this.x -= dxScreen / this.zoom;
    this.y -= dyScreen / this.zoom;
    this.clamp();
  }

  zoomAt(factor: number, sx: number, sy: number): void {
    const before = this.screenToWorld(sx, sy);
    this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom * factor));
    const after = this.screenToWorld(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this.clamp();
  }

  centerOn(wx: number, wy: number): void {
    this.x = wx;
    this.y = wy;
    this.clamp();
  }

  /** Visible world rectangle. */
  visibleRect(): { x: number; y: number; width: number; height: number } {
    const tl = this.screenToWorld(0, 0);
    return {
      x: tl.x,
      y: tl.y,
      width: this.viewWidth / this.zoom,
      height: this.viewHeight / this.zoom,
    };
  }

  private clamp(): void {
    this.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, this.x));
    this.y = Math.max(this.bounds.minY, Math.min(this.bounds.maxY, this.y));
  }
}
