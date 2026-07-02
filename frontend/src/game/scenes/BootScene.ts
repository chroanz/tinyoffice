import Phaser from "phaser";
import { TILE_SIZE } from "../constants";
import { client } from "../../net/client";
import type { JoinAck } from "../../net/messages";

/**
 * Carrega os assets do mundo e espera o join_ack do servidor (o usuário
 * entra pelo overlay React); com os dois prontos, inicia a WorldScene.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload() {
    this.load.tilemapTiledJSON("lobby", "/assets/maps/templates/lobby.tmj");
    this.load.image("tiles", "/assets/tilesets/basic.png");
    this.load.spritesheet("avatar", "/assets/avatars/body/placeholder.png", {
      frameWidth: 32,
      frameHeight: 64,
    });
  }

  create() {
    this.drawTileGrid();
    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.drawTileGrid());

    if (client.lastAck) {
      this.enterWorld(client.lastAck);
      return;
    }
    const off = client.on("joined", (ack) => {
      off();
      this.enterWorld(ack);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  }

  private enterWorld(ack: JoinAck) {
    this.scene.start("world", { ack });
  }

  private grid?: Phaser.GameObjects.Graphics;

  private drawTileGrid() {
    this.grid?.destroy();
    this.grid = this.add.graphics().setDepth(-1);

    const { width, height } = this.scale;
    for (let y = 0; y < Math.ceil(height / TILE_SIZE); y++) {
      for (let x = 0; x < Math.ceil(width / TILE_SIZE); x++) {
        this.grid.fillStyle((x + y) % 2 === 0 ? 0x1f2335 : 0x24283b);
        this.grid.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }
}
