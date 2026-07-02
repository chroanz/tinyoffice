import Phaser from "phaser";
import { STEP_MS, TILE_SIZE } from "./constants";
import type { Direction } from "../net/messages";

const DIR_ROW: Record<Direction, number> = { down: 0, up: 1, left: 2, right: 3 };

/** Registra as animações do spritesheet de avatar (uma vez por cena). */
export function registerAvatarAnims(scene: Phaser.Scene, key: string) {
  for (const dir of Object.keys(DIR_ROW) as Direction[]) {
    const row = DIR_ROW[dir] * 6;
    scene.anims.create({
      key: `idle-${dir}`,
      frames: scene.anims.generateFrameNumbers(key, { frames: [row, row + 1] }),
      frameRate: 2,
      repeat: -1,
    });
    scene.anims.create({
      key: `walk-${dir}`,
      frames: scene.anims.generateFrameNumbers(key, { frames: [row + 2, row + 3, row + 4, row + 5] }),
      frameRate: 10,
      repeat: -1,
    });
  }
}

/**
 * Avatar no mundo: sprite 32×64 (âncora no pé, ESPECIFICACAO.md §5.2) +
 * nome sobre a cabeça. Movimento tile a tile com tween de STEP_MS e
 * y-sorting via depth = y do pé.
 */
export class Avatar {
  readonly container: Phaser.GameObjects.Container;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private dir: Direction = "down";
  private tween: Phaser.Tweens.Tween | null = null;
  private idleTimer: Phaser.Time.TimerEvent | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    name: string,
    tileX: number,
    tileY: number,
  ) {
    this.sprite = scene.add.sprite(0, 0, "avatar").setOrigin(0.5, 1);
    const label = scene.add
      .text(0, -68, name, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setResolution(4);

    this.container = scene.add.container(px(tileX), py(tileY), [this.sprite, label]);
    this.container.setDepth(this.container.y);
    this.sprite.play("idle-down");
  }

  /** Anda 1 tile até (tileX, tileY), virado para dir. */
  step(tileX: number, tileY: number, dir: Direction) {
    this.dir = dir;
    this.tween?.stop();
    this.sprite.play(`walk-${dir}`, true);
    this.tween = this.scene.tweens.add({
      targets: this.container,
      x: px(tileX),
      y: py(tileY),
      duration: STEP_MS,
      onUpdate: () => this.container.setDepth(this.container.y),
      onComplete: () => this.scheduleIdle(),
    });
  }

  /** Corrige a posição imediatamente (reconciliação/teleporte). */
  snap(tileX: number, tileY: number, dir: Direction) {
    this.tween?.stop();
    this.dir = dir;
    this.container.setPosition(px(tileX), py(tileY));
    this.container.setDepth(this.container.y);
    this.sprite.play(`idle-${dir}`, true);
  }

  /** Vira sem andar. */
  face(dir: Direction) {
    if (this.dir === dir) return;
    this.dir = dir;
    const anim = this.sprite.anims.currentAnim?.key.startsWith("walk") ? "walk" : "idle";
    this.sprite.play(`${anim}-${dir}`, true);
  }

  destroy() {
    this.tween?.stop();
    this.idleTimer?.remove();
    this.container.destroy();
  }

  // Volta ao idle se nenhum novo passo chegar logo após o tween.
  private scheduleIdle() {
    this.idleTimer?.remove();
    this.idleTimer = this.scene.time.delayedCall(80, () => {
      if (!this.tween?.isPlaying()) this.sprite.play(`idle-${this.dir}`, true);
    });
  }
}

// Centro do tile no eixo X; pé do avatar na base do tile no eixo Y.
const px = (tileX: number) => tileX * TILE_SIZE + TILE_SIZE / 2;
const py = (tileY: number) => tileY * TILE_SIZE + TILE_SIZE;
