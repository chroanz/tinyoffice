import Phaser from "phaser";

export const TILE_SIZE = 32; // px — unidade básica do mundo (ESPECIFICACAO.md §5.1)

/**
 * Cena provisória da Fase 0: desenha o grid de tiles 32×32 para validar
 * renderização pixelada. Será substituída pelas cenas de mundo (tilemap
 * Tiled + avatares) na Fase 1.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create() {
    this.drawTileGrid();

    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, "PixelRooms\nmundo em construção — Fase 1", {
        fontFamily: "monospace",
        fontSize: "24px",
        color: "#c0caf5",
        align: "center",
      })
      .setOrigin(0.5);

    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.drawTileGrid());
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
