import Phaser from "phaser";
import { Avatar, registerAvatarAnims } from "../Avatar";
import {
  CollisionGrid,
  distanceToObject,
  parseInteractables,
  stepTarget,
  type InteractableDef,
  type TiledJSON,
} from "../collision";
import { ABOVE_DEPTH, EMOTES, STEP_MS, TILE_SIZE } from "../constants";
import { client } from "../../net/client";
import type { Direction, JoinAck, ServerMessage } from "../../net/messages";
import { useGameStore } from "../../state/gameStore";
import { useUIStore } from "../../state/uiStore";

/**
 * Cena principal do mundo: renderiza o mapa Tiled, o próprio avatar com
 * client-side prediction e os demais jogadores interpolados a partir dos
 * deltas autoritativos do servidor. Também cuida de emotes, do realce de
 * objetos interativos e do clique-para-andar.
 */
export class WorldScene extends Phaser.Scene {
  private grid!: CollisionGrid;
  private interactables: InteractableDef[] = [];
  private avatars = new Map<string, Avatar>();
  private unsubscribe: (() => void)[] = [];

  // Estado previsto do próprio avatar (reconciliado com o servidor).
  private selfId = "";
  private selfX = 0;
  private selfY = 0;
  private lastStepAt = -Infinity;
  private lastSentDir: Direction | null = null;

  // Clique-para-andar (RF-WORLD-08): caminho pendente e marcador do destino.
  private path: Direction[] = [];
  private targetMarker!: Phaser.GameObjects.Graphics;

  // Realce do objeto interativo ao alcance (RF-OBJ-02).
  private highlight!: Phaser.GameObjects.Graphics;
  private nearbyId: string | null = null;

  private keys!: Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key[]>;

  constructor() {
    super("world");
  }

  create(data: { ack: JoinAck }) {
    const map = this.make.tilemap({ key: "lobby" });
    const tileset = map.addTilesetImage("basic", "tiles")!;
    map.createLayer("Ground", tileset)!.setDepth(0);
    map.createLayer("Objects", tileset)!.setDepth(1);
    map.createLayer("Above", tileset)!.setDepth(ABOVE_DEPTH);

    const tmj = this.cache.tilemap.get("lobby").data as TiledJSON;
    this.grid = CollisionGrid.fromTiledJSON(tmj);
    this.interactables = parseInteractables(tmj);

    this.highlight = this.add.graphics().setDepth(2);
    this.targetMarker = this.add.graphics().setDepth(2);

    registerAvatarAnims(this);
    this.setupInput();
    this.applyJoin(data.ack);

    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setZoom(2);

    this.unsubscribe.push(
      client.on("message", (msg) => this.onServerMessage(msg)),
      client.on("joined", (ack) => this.applyJoin(ack)), // reconexão
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe.forEach((u) => u());
      this.unsubscribe = [];
      useGameStore.setState({ nearbyObject: null });
    });
  }

  update(time: number) {
    if (!this.selfId) return;
    const self = this.avatars.get(this.selfId);
    if (!self) return;

    let dir = useUIStore.getState().typing ? null : this.heldDirection();
    if (dir) {
      this.clearPath(); // teclado cancela o clique-para-andar
    } else if (this.path.length && time - this.lastStepAt >= STEP_MS) {
      dir = this.path[0];
    }
    if (!dir) return;
    if (time - this.lastStepAt < STEP_MS) return;

    const [nx, ny] = stepTarget(this.selfX, this.selfY, dir);
    if (this.grid.walkable(nx, ny)) {
      // Predição: anda já; o delta do servidor confirma (ou corrige).
      this.selfX = nx;
      this.selfY = ny;
      this.lastStepAt = time;
      this.lastSentDir = dir;
      self.step(nx, ny, dir);
      client.move(dir);
      if (this.path.length) {
        this.path.shift();
        if (!this.path.length) this.clearPath();
      }
      this.refreshNearby();
    } else {
      this.clearPath();
      self.face(dir);
      if (this.lastSentDir !== dir) {
        this.lastSentDir = dir; // avisa o servidor só na mudança de direção
        client.move(dir);
      }
    }
  }

  // ── Rede ─────────────────────────────────────────────────────

  private onServerMessage(msg: ServerMessage) {
    switch (msg.type) {
      case "player_joined": {
        const p = msg.player;
        if (!this.avatars.has(p.playerId)) {
          this.avatars.set(p.playerId, new Avatar(this, p.name, p.avatar, p.x, p.y));
        }
        break;
      }
      case "player_left":
        this.avatars.get(msg.playerId)?.destroy();
        this.avatars.delete(msg.playerId);
        break;
      case "teleport": {
        const avatar = this.avatars.get(msg.playerId);
        avatar?.snap(msg.x, msg.y, "down");
        if (msg.playerId === this.selfId) {
          // Descarta a predição: a posição do portal é autoritativa.
          this.selfX = msg.x;
          this.selfY = msg.y;
          this.clearPath();
          this.refreshNearby();
        }
        break;
      }
      case "movement":
        for (const m of msg.moves) {
          if (m.playerId === this.selfId) {
            // Reconciliação: só corrige se o servidor divergiu da predição.
            if (m.x !== this.selfX || m.y !== this.selfY) {
              this.selfX = m.x;
              this.selfY = m.y;
              this.avatars.get(this.selfId)?.snap(m.x, m.y, m.dir);
              this.clearPath();
              this.refreshNearby();
            }
          } else {
            const avatar = this.avatars.get(m.playerId);
            if (!avatar) continue;
            if (m.moving) avatar.step(m.x, m.y, m.dir);
            else avatar.snap(m.x, m.y, m.dir);
          }
        }
        break;
      case "emote": {
        const avatar = this.avatars.get(msg.playerId);
        if (!avatar) break;
        const def = EMOTES.find((e) => e.id === msg.emote);
        avatar.showEmote(def?.emoji ?? "", msg.emote === "question");
        break;
      }
    }
  }

  /** (Re)constrói todos os avatares a partir de um join_ack. */
  private applyJoin(ack: JoinAck) {
    for (const avatar of this.avatars.values()) avatar.destroy();
    this.avatars.clear();
    this.clearPath();

    this.selfId = ack.playerId;
    for (const p of ack.players) {
      const isSelf = p.playerId === ack.playerId;
      const avatar = new Avatar(this, p.name, p.avatar, p.x, p.y, isSelf);
      this.avatars.set(p.playerId, avatar);
      if (isSelf) {
        this.selfX = p.x;
        this.selfY = p.y;
        this.cameras.main.startFollow(avatar.container, true, 0.15, 0.15);
      }
    }
    this.refreshNearby();
  }

  // ── Objetos interativos ──────────────────────────────────────

  /** Recalcula o objeto ao alcance e o realce (chamado a cada passo). */
  private refreshNearby() {
    let best: InteractableDef | null = null;
    let bestD = Infinity;
    for (const obj of this.interactables) {
      const d = distanceToObject(obj, this.selfX, this.selfY);
      if (d <= obj.range && d < bestD) {
        best = obj;
        bestD = d;
      }
    }
    if ((best?.objectId ?? null) === this.nearbyId) return;
    this.nearbyId = best?.objectId ?? null;

    this.highlight.clear();
    if (best) {
      const x = best.x0 * TILE_SIZE;
      const y = best.y0 * TILE_SIZE;
      const w = (best.x1 - best.x0 + 1) * TILE_SIZE;
      const h = (best.y1 - best.y0 + 1) * TILE_SIZE;
      this.highlight.lineStyle(2, 0xfacc15, 1).strokeRect(x + 1, y + 1, w - 2, h - 2);
      this.highlight.fillStyle(0xfacc15, 0.12).fillRect(x, y, w, h);
    }
    useGameStore.setState({
      nearbyObject: best
        ? { objectId: best.objectId, type: best.type, title: best.title, url: best.url, text: best.text }
        : null,
    });
  }

  // ── Input ────────────────────────────────────────────────────

  private setupInput() {
    const kb = this.input.keyboard!;
    // Sem captura global: as teclas continuam chegando aos campos de
    // texto da UI (chat); o mundo checa `typing` antes de mover.
    kb.disableGlobalCapture();
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: [kb.addKey(K.W, false), kb.addKey(K.UP, false)],
      down: [kb.addKey(K.S, false), kb.addKey(K.DOWN, false)],
      left: [kb.addKey(K.A, false), kb.addKey(K.LEFT, false)],
      right: [kb.addKey(K.D, false), kb.addKey(K.RIGHT, false)],
    };

    // Clique-para-andar: BFS até o tile clicado (cada passo é validado
    // pelo servidor como um movimento normal).
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (!this.selfId || pointer.button !== 0) return;
      const tx = Math.floor(pointer.worldX / TILE_SIZE);
      const ty = Math.floor(pointer.worldY / TILE_SIZE);
      const path = this.grid.findPath(this.selfX, this.selfY, tx, ty);
      if (!path || !path.length) {
        this.clearPath();
        return;
      }
      this.path = path;
      this.targetMarker
        .clear()
        .lineStyle(2, 0x34d399, 0.9)
        .strokeRect(tx * TILE_SIZE + 4, ty * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
    });
  }

  private clearPath() {
    if (this.path.length) this.path = [];
    this.targetMarker.clear();
  }

  private heldDirection(): Direction | null {
    for (const dir of ["left", "right", "up", "down"] as const) {
      if (this.keys[dir].some((k) => k.isDown)) return dir;
    }
    return null;
  }
}
