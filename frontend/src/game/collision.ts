import { TILE_SIZE } from "./constants";
import type { Direction } from "../net/messages";

/**
 * Grade de colisão do cliente, derivada da camada "Effects" do .tmj —
 * o MESMO algoritmo do backend (internal/maps), para que a predição
 * local chegue ao mesmo resultado que o servidor autoritativo.
 */
export class CollisionGrid {
  private constructor(
    readonly width: number,
    readonly height: number,
    private readonly blocked: boolean[],
  ) {}

  walkable(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    return !this.blocked[y * this.width + x];
  }

  static fromTiledJSON(tmj: TiledJSON): CollisionGrid {
    const blocked = new Array<boolean>(tmj.width * tmj.height).fill(false);
    const effects = tmj.layers.find((l) => l.name === "Effects" && l.type === "objectgroup");
    for (const obj of effects?.objects ?? []) {
      const effect = obj.properties?.find((p) => p.name === "effect")?.value;
      if (effect !== "impassable") continue;
      const x0 = Math.floor(obj.x / TILE_SIZE);
      const y0 = Math.floor(obj.y / TILE_SIZE);
      const x1 = Math.floor((obj.x + obj.width - 1) / TILE_SIZE);
      const y1 = Math.floor((obj.y + obj.height - 1) / TILE_SIZE);
      for (let y = Math.max(y0, 0); y <= Math.min(y1, tmj.height - 1); y++) {
        for (let x = Math.max(x0, 0); x <= Math.min(x1, tmj.width - 1); x++) {
          blocked[y * tmj.width + x] = true;
        }
      }
    }
    return new CollisionGrid(tmj.width, tmj.height, blocked);
  }
}

export function stepTarget(x: number, y: number, dir: Direction): [number, number] {
  switch (dir) {
    case "up":
      return [x, y - 1];
    case "down":
      return [x, y + 1];
    case "left":
      return [x - 1, y];
    case "right":
      return [x + 1, y];
  }
}

// Subconjunto do Tiled JSON que o cliente precisa ler.
export interface TiledJSON {
  width: number;
  height: number;
  layers: {
    name: string;
    type: string;
    objects?: {
      x: number;
      y: number;
      width: number;
      height: number;
      properties?: { name: string; value: unknown }[];
    }[];
  }[];
}
