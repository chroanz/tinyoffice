import { TILE_SIZE } from "./constants";
import type { Direction } from "../net/messages";
import type { NearbyObject } from "../state/gameStore";

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
      const effect = prop(obj, "effect");
      if (effect !== "impassable") continue;
      const [x0, y0, x1, y1] = tileRect(obj);
      for (let y = Math.max(y0, 0); y <= Math.min(y1, tmj.height - 1); y++) {
        for (let x = Math.max(x0, 0); x <= Math.min(x1, tmj.width - 1); x++) {
          blocked[y * tmj.width + x] = true;
        }
      }
    }
    return new CollisionGrid(tmj.width, tmj.height, blocked);
  }

  /**
   * Caminho mais curto (4 direções) de (sx,sy) até (tx,ty) por BFS —
   * custo uniforme, então BFS equivale a A* e é mais simples. Devolve a
   * lista de direções a seguir, ou null se o destino for inalcançável.
   * Usado no clique-para-andar (RF-WORLD-08); cada passo ainda é validado
   * pelo servidor.
   */
  findPath(sx: number, sy: number, tx: number, ty: number, maxNodes = 4000): Direction[] | null {
    if (!this.walkable(tx, ty)) return null;
    if (sx === tx && sy === ty) return [];
    const idx = (x: number, y: number) => y * this.width + x;
    const prev = new Map<number, [number, Direction]>();
    const start = idx(sx, sy);
    const goal = idx(tx, ty);
    const queue: number[] = [start];
    const seen = new Set<number>([start]);
    const dirs: [Direction, number, number][] = [
      ["up", 0, -1],
      ["down", 0, 1],
      ["left", -1, 0],
      ["right", 1, 0],
    ];
    let head = 0;
    while (head < queue.length && seen.size <= maxNodes) {
      const cur = queue[head++];
      const cx = cur % this.width;
      const cy = Math.floor(cur / this.width);
      for (const [dir, dx, dy] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!this.walkable(nx, ny)) continue;
        const n = idx(nx, ny);
        if (seen.has(n)) continue;
        seen.add(n);
        prev.set(n, [cur, dir]);
        if (n === goal) {
          const path: Direction[] = [];
          for (let at = goal; at !== start; ) {
            const [p, d] = prev.get(at)!;
            path.push(d);
            at = p;
          }
          return path.reverse();
        }
        queue.push(n);
      }
    }
    return null;
  }
}

/** Objeto interativo com footprint em tiles (camada "Interactables"). */
export interface InteractableDef extends NearbyObject {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  range: number;
}

export function parseInteractables(tmj: TiledJSON): InteractableDef[] {
  const layer = tmj.layers.find((l) => l.name === "Interactables" && l.type === "objectgroup");
  const out: InteractableDef[] = [];
  for (const obj of layer?.objects ?? []) {
    const type = prop(obj, "type");
    const objectId = prop(obj, "objectId");
    if (typeof objectId !== "string" || typeof type !== "string") continue;
    if (!["iframe", "image", "video", "note", "link"].includes(type)) continue;
    const [x0, y0, x1, y1] = tileRect(obj);
    const range = prop(obj, "range");
    out.push({
      objectId,
      type: type as InteractableDef["type"],
      title: (prop(obj, "title") as string) || objectId,
      url: prop(obj, "url") as string | undefined,
      text: prop(obj, "text") as string | undefined,
      x0,
      y0,
      x1,
      y1,
      range: typeof range === "number" ? range : 1,
    });
  }
  return out;
}

/** Distância Chebyshev do tile (x,y) ao footprint do objeto. */
export function distanceToObject(obj: InteractableDef, x: number, y: number): number {
  const dx = x < obj.x0 ? obj.x0 - x : x > obj.x1 ? x - obj.x1 : 0;
  const dy = y < obj.y0 ? obj.y0 - y : y > obj.y1 ? y - obj.y1 : 0;
  return Math.max(dx, dy);
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

function tileRect(obj: TiledObject): [number, number, number, number] {
  return [
    Math.floor(obj.x / TILE_SIZE),
    Math.floor(obj.y / TILE_SIZE),
    Math.floor((obj.x + obj.width - 1) / TILE_SIZE),
    Math.floor((obj.y + obj.height - 1) / TILE_SIZE),
  ];
}

function prop(obj: TiledObject, name: string): unknown {
  return obj.properties?.find((p) => p.name === name)?.value;
}

// Subconjunto do Tiled JSON que o cliente precisa ler.
export interface TiledObject {
  x: number;
  y: number;
  width: number;
  height: number;
  properties?: { name: string; value: unknown }[];
}

export interface TiledJSON {
  width: number;
  height: number;
  layers: {
    name: string;
    type: string;
    objects?: TiledObject[];
  }[];
}
