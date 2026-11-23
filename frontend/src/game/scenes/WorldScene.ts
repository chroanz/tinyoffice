import Phaser from "phaser";
import { Avatar, overlaps, registerAvatarAnims, type Rect } from "../Avatar";
import {
  CollisionGrid,
  distanceToObject,
  parseInteractables,
  stepTarget,
  type InteractableDef,
  type TiledJSON,
} from "../collision";
import { ABOVE_DEPTH, EMOTES, STEP_MS, TILE_SIZE } from "../constants";
import { buildExterior, EXTERIOR_MARGIN } from "../exterior";
import { client } from "../../net/client";
import type { Direction, JoinAck, ServerMessage } from "../../net/messages";
import { useGameStore } from "../../state/gameStore";
import { useMediaStore } from "../../state/mediaStore";
import { prefs, usePrefs } from "../../state/prefsStore";
import { useUIStore } from "../../state/uiStore";

let activeWorld: WorldScene | null = null;

/**
 * Retângulo do próprio avatar em pixels da tela (para o tutorial destacar
 * o personagem). null se o mundo ainda não está pronto.
 */
export function selfScreenRect(): { x: number; y: number; w: number; h: number } | null {
  const scene = activeWorld;
  const self = scene?.selfAvatar();
  if (!scene || !self) return null;
  const cam = scene.cameras.main;
  const canvas = scene.game.canvas.getBoundingClientRect();
  const z = cam.zoom;
  const sx = canvas.left + (self.container.x - cam.worldView.x) * z;
  const feet = canvas.top + (self.container.y - cam.worldView.y) * z;
  return { x: sx - 16 * z, y: feet - 58 * z, w: 32 * z, h: 60 * z };
}

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

  selfAvatar() {
    return this.avatars.get(this.selfId);
  }

  create(data: { ack: JoinAck }) {
    activeWorld = this;
    const map = this.make.tilemap({ key: "lobby" });
    const tileset = map.addTilesetImage("basic", "tiles")!;
    buildExterior(this, map.widthInPixels, map.heightInPixels);
    map.createLayer("Ground", tileset)!.setDepth(0);
    map.createLayer("Objects", tileset)!.setDepth(1);
    map.createLayer("Above", tileset)!.setDepth(ABOVE_DEPTH);

    const tmj = this.cache.tilemap.get("lobby").data as TiledJSON;
    this.grid = CollisionGrid.fromTiledJSON(tmj);
    this.interactables = parseInteractables(tmj);

    this.highlight = this.add.graphics().setDepth(2);
    this.tweens.add({ targets: this.highlight, alpha: 0.45, duration: 700, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    this.targetMarker = this.add.graphics().setDepth(2).setVisible(false);
    this.drawTargetMarker();

    registerAvatarAnims(this);
    this.setupInput();
    this.applyJoin(data.ack);

    // Câmera pode mostrar o jardim em volta: bordas visíveis em todas as direções.
    const M = EXTERIOR_MARGIN;
    this.cameras.main.setBounds(-M, -M, map.widthInPixels + 2 * M, map.heightInPixels + 2 * M);
    this.cameras.main.setZoom(usePrefs.getState().zoom);
    this.setupZoom();

    this.unsubscribe.push(
      client.on("message", (msg) => this.onServerMessage(msg)),
      client.on("joined", (ack) => this.applyJoin(ack)), // reconexão
      useMediaStore.subscribe((s, prev) => {
        if (s.speaking !== prev.speaking) this.applySpeaking(s.speaking);
      }),
      usePrefs.subscribe((s, prev) => {
        if (s.zoom !== prev.zoom) this.cameras.main.zoomTo(s.zoom, 220, "Sine.easeInOut", true);
      }),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (activeWorld === this) activeWorld = null;
      this.unsubscribe.forEach((u) => u());
      this.unsubscribe = [];
      useGameStore.setState({ nearbyObject: null });
    });
  }

  update(time: number) {
    this.declutterNames();
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
      self.bump(dir);
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
          const avatar = new Avatar(this, p.name, p.avatar, p.x, p.y);
          avatar.setSpeaking(useMediaStore.getState().speaking.includes(p.playerId));
          avatar.spawnIn();
          this.avatars.set(p.playerId, avatar);
        }
        break;
      }
      case "player_updated": {
        // Recria o boneco no mesmo lugar com o visual novo (com o "pop" de entrada).
        const p = msg.player;
        const old = this.avatars.get(p.playerId);
        if (!old) break;
        const isSelf = p.playerId === this.selfId;
        const x = isSelf ? this.selfX : Math.round((old.container.x - TILE_SIZE / 2) / TILE_SIZE);
        const y = isSelf ? this.selfY : Math.round((old.container.y + 2 - TILE_SIZE) / TILE_SIZE);
        old.destroy();
        const avatar = new Avatar(this, p.name, p.avatar, x, y, isSelf);
        avatar.setSpeaking(useMediaStore.getState().speaking.includes(p.playerId));
        avatar.spawnIn();
        this.avatars.set(p.playerId, avatar);
        if (isSelf) this.cameras.main.startFollow(avatar.container, true, 0.15, 0.15, 0, 28);
        break;
      }
      case "player_left": {
        const avatar = this.avatars.get(msg.playerId);
        this.avatars.delete(msg.playerId);
        avatar?.despawn(() => avatar.destroy());
        break;
      }
      case "teleport": {
        const avatar = this.avatars.get(msg.playerId);
        avatar?.teleport(msg.x, msg.y, "down");
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
        avatar.showEmote(
          EMOTES.findIndex((e) => e.id === msg.emote),
          msg.emote === "question",
        );
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
        avatar.spawnIn();
        this.selfX = p.x;
        this.selfY = p.y;
        // Avatar um pouco abaixo do centro: a faixa de vídeos ocupa o topo.
        this.cameras.main.startFollow(avatar.container, true, 0.15, 0.15, 0, 28);
      }
    }
    this.applySpeaking(useMediaStore.getState().speaking);
    this.refreshNearby();
  }

  private applySpeaking(ids: string[]) {
    for (const [id, avatar] of this.avatars) avatar.setSpeaking(ids.includes(id));
  }

  /**
   * Etiquetas de nome sem bagunça: quando duas colidem, fica a de maior
   * prioridade (passando o mouse > você > quem fala > mais perto de você);
   * uma etiqueta que cobriria o rosto de quem está logo atrás também some.
   * Passar o mouse sobre um avatar sempre revela o nome dele.
   */
  private declutterNames() {
    if (!this.avatars.size) return;
    const pointer = this.input.activePointer;
    const world = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    const pr: Rect = { x0: world.x, x1: world.x, y0: world.y, y1: world.y };
    const speaking = useMediaStore.getState().speaking;
    const self = this.avatars.get(this.selfId);
    const mode = usePrefs.getState().names;

    let hovered: string | null = null;
    let hoveredY = -Infinity;
    for (const [id, a] of this.avatars) {
      if (overlaps(a.bodyRect(), pr, 0) && a.y > hoveredY) {
        hovered = id;
        hoveredY = a.y;
      }
    }

    const score = (id: string, a: Avatar) => {
      if (id === hovered) return 1e9;
      if (id === this.selfId) return 1e8;
      let s = speaking.includes(id) ? 1e7 : 0;
      if (self) s -= Phaser.Math.Distance.Between(a.container.x, a.y, self.container.x, self.y);
      return s;
    };
    const ranked = [...this.avatars].sort((x, y) => score(y[0], y[1]) - score(x[0], x[1]));
    const placed: Rect[] = [];
    for (const [id, a] of ranked) {
      if (mode === "always") {
        a.setNameShown(true);
        continue;
      }
      if (mode === "hover" && id !== hovered && id !== this.selfId) {
        a.setNameShown(false);
        continue;
      }
      const r = a.nameRect();
      let ok = !placed.some((p) => overlaps(p, r));
      if (ok && id !== hovered) {
        // não cobre o rosto de quem está atrás (y menor)
        for (const b of this.avatars.values()) {
          if (b !== a && b.y < a.y && overlaps(b.headRect(), r, 0)) {
            ok = false;
            break;
          }
        }
      }
      a.setNameShown(ok);
      if (ok) placed.push(r);
    }
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
      this.highlight.fillStyle(0xfde68a, 0.16).fillRoundedRect(x - 2, y - 2, w + 4, h + 4, 6);
      this.highlight.lineStyle(2, 0xfde047, 1).strokeRoundedRect(x - 2, y - 2, w + 4, h + 4, 6);
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
      this.showTargetMarker(tx, ty);
    });
  }

  /**
   * Zoom (RF-WORLD): roda do mouse/trackpad, teclas + e − e os botões da
   * UI mudam prefs.zoom; a câmera anima até o nível. Níveis múltiplos de
   * 0,5 mantêm cada pixel da arte com tamanho inteiro na tela.
   */
  private setupZoom() {
    let acc = 0;
    let lastStep = 0;
    this.input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (_p: Phaser.Input.Pointer, _objs: unknown, _dx: number, dy: number) => {
        acc += dy;
        const now = this.time.now;
        if (Math.abs(acc) < 60 || now - lastStep < 140) return;
        prefs.zoomBy(acc < 0 ? 1 : -1);
        acc = 0;
        lastStep = now;
      },
    );
  }

  /** Marcador do destino do clique: cantoneiras que "pousam" e pulsam. */
  private drawTargetMarker() {
    const g = this.targetMarker;
    const h = TILE_SIZE / 2 - 2;
    const l = 7;
    g.fillStyle(0xa78bfa, 0.18).fillRoundedRect(-h, -h, h * 2, h * 2, 4);
    g.lineStyle(2, 0xc4b5fd, 1);
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      g.beginPath();
      g.moveTo(sx * h, sy * (h - l));
      g.lineTo(sx * h, sy * h);
      g.lineTo(sx * (h - l), sy * h);
      g.strokePath();
    }
  }

  private markerTween?: Phaser.Tweens.Tween;

  private showTargetMarker(tx: number, ty: number) {
    this.markerTween?.stop();
    this.targetMarker
      .setPosition(tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE / 2)
      .setVisible(true)
      .setScale(1.6)
      .setAlpha(0);
    this.markerTween = this.tweens.add({
      targets: this.targetMarker,
      scale: 1,
      alpha: 1,
      duration: 180,
      ease: "Back.Out",
      onComplete: () => {
        this.markerTween = this.tweens.add({
          targets: this.targetMarker,
          scale: 0.86,
          duration: 520,
          yoyo: true,
          repeat: -1,
          ease: "Sine.InOut",
        });
      },
    });
  }

  private clearPath() {
    if (this.path.length) this.path = [];
    this.markerTween?.stop();
    this.targetMarker.setVisible(false);
  }

  private heldDirection(): Direction | null {
    for (const dir of ["left", "right", "up", "down"] as const) {
      if (this.keys[dir].some((k) => k.isDown)) return dir;
    }
    return null;
  }
}
