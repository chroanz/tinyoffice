import Phaser from "phaser";
import { Avatar, registerAvatarAnims } from "../Avatar";
import { CollisionGrid, stepTarget, type TiledJSON } from "../collision";
import { ABOVE_DEPTH, STEP_MS } from "../constants";
import { client } from "../../net/client";
import type { Direction, JoinAck, ServerMessage } from "../../net/messages";

/**
 * Cena principal do mundo (Fase 1): renderiza o mapa Tiled, o próprio
 * avatar com client-side prediction e os demais jogadores interpolados
 * a partir dos deltas autoritativos do servidor.
 */
export class WorldScene extends Phaser.Scene {
  private grid!: CollisionGrid;
  private avatars = new Map<string, Avatar>();
  private unsubscribe: (() => void)[] = [];

  // Estado previsto do próprio avatar (reconciliado com o servidor).
  private selfId = "";
  private selfX = 0;
  private selfY = 0;
  private lastStepAt = -Infinity;
  private lastSentDir: Direction | null = null;

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

    registerAvatarAnims(this, "avatar");
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
    });
  }

  update(time: number) {
    const dir = this.heldDirection();
    if (!dir || !this.selfId) return;
    if (time - this.lastStepAt < STEP_MS) return;

    const self = this.avatars.get(this.selfId);
    if (!self) return;

    const [nx, ny] = stepTarget(this.selfX, this.selfY, dir);
    if (this.grid.walkable(nx, ny)) {
      // Predição: anda já; o delta do servidor confirma (ou corrige).
      this.selfX = nx;
      this.selfY = ny;
      this.lastStepAt = time;
      this.lastSentDir = dir;
      self.step(nx, ny, dir);
      client.move(dir);
    } else {
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
          this.avatars.set(p.playerId, new Avatar(this, p.name, p.x, p.y));
        }
        break;
      }
      case "player_left":
        this.avatars.get(msg.playerId)?.destroy();
        this.avatars.delete(msg.playerId);
        break;
      case "movement":
        for (const m of msg.moves) {
          if (m.playerId === this.selfId) {
            // Reconciliação: só corrige se o servidor divergiu da predição.
            if (m.x !== this.selfX || m.y !== this.selfY) {
              this.selfX = m.x;
              this.selfY = m.y;
              this.avatars.get(this.selfId)?.snap(m.x, m.y, m.dir);
            }
          } else {
            const avatar = this.avatars.get(m.playerId);
            if (!avatar) continue;
            if (m.moving) avatar.step(m.x, m.y, m.dir);
            else avatar.snap(m.x, m.y, m.dir);
          }
        }
        break;
    }
  }

  /** (Re)constrói todos os avatares a partir de um join_ack. */
  private applyJoin(ack: JoinAck) {
    for (const avatar of this.avatars.values()) avatar.destroy();
    this.avatars.clear();

    this.selfId = ack.playerId;
    for (const p of ack.players) {
      const avatar = new Avatar(this, p.name, p.x, p.y);
      this.avatars.set(p.playerId, avatar);
      if (p.playerId === ack.playerId) {
        this.selfX = p.x;
        this.selfY = p.y;
        this.cameras.main.startFollow(avatar.container, true, 0.15, 0.15);
      }
    }
  }

  // ── Input ────────────────────────────────────────────────────

  private setupInput() {
    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: [kb.addKey(K.W), kb.addKey(K.UP)],
      down: [kb.addKey(K.S), kb.addKey(K.DOWN)],
      left: [kb.addKey(K.A), kb.addKey(K.LEFT)],
      right: [kb.addKey(K.D), kb.addKey(K.RIGHT)],
    };
  }

  private heldDirection(): Direction | null {
    for (const dir of ["left", "right", "up", "down"] as const) {
      if (this.keys[dir].some((k) => k.isDown)) return dir;
    }
    return null;
  }
}
