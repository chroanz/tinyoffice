import Phaser from "phaser";
import { ALL_SHEETS, SHEET, sheetURL, textureKey } from "../avatarCatalog";
import { TILE_SIZE } from "../constants";
import { preloadExterior } from "../exterior";
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
    preloadExterior(this);
    this.load.spritesheet("emote-bubbles", "/assets/ui/emote-bubbles.png", { frameWidth: 32, frameHeight: 36 });
    for (const { layer, id } of ALL_SHEETS) {
      this.load.spritesheet(textureKey(layer, id), sheetURL(layer, id), {
        frameWidth: SHEET.frameW,
        frameHeight: SHEET.frameH,
      });
    }
  }

  create() {
    this.drawBackdrop();
    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.drawBackdrop());

    // A fonte das etiquetas de nome precisa estar pronta antes do 1º texto.
    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    const go = (ack: JoinAck) => void fontsReady.then(() => this.scene.start("world", { ack }));

    if (client.lastAck) {
      go(client.lastAck);
      return;
    }
    const off = client.on("joined", (ack) => {
      off();
      go(ack);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  }

  private backdrop?: Phaser.GameObjects.Graphics;

  /** Fundo atrás da tela de entrada: xadrez discreto em tons da UI. */
  private drawBackdrop() {
    this.backdrop?.destroy();
    this.backdrop = this.add.graphics().setDepth(-1);
    const { width, height } = this.scale;
    const s = TILE_SIZE * 2;
    for (let y = 0; y < Math.ceil(height / s); y++) {
      for (let x = 0; x < Math.ceil(width / s); x++) {
        this.backdrop.fillStyle((x + y) % 2 === 0 ? 0x10121b : 0x131622);
        this.backdrop.fillRect(x * s, y * s, s, s);
      }
    }
  }
}
