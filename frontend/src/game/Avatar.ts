import Phaser from "phaser";
import { AVATAR_CATALOG, AVATAR_LAYERS, textureKey, type AvatarLayer } from "./avatarCatalog";
import { EMOTE_MS, STEP_MS, TILE_SIZE } from "./constants";
import type { AvatarConfig, Direction } from "../net/messages";

const DIR_ROW: Record<Direction, number> = { down: 0, up: 1, left: 2, right: 3 };

/** Registra as animações de todos os sheets de avatar (uma vez por cena). */
export function registerAvatarAnims(scene: Phaser.Scene) {
  for (const layer of AVATAR_LAYERS) {
    for (const item of AVATAR_CATALOG[layer]) {
      const key = textureKey(layer, item.id);
      for (const dir of Object.keys(DIR_ROW) as Direction[]) {
        const row = DIR_ROW[dir] * 6;
        scene.anims.create({
          key: `${key}-idle-${dir}`,
          frames: scene.anims.generateFrameNumbers(key, { frames: [row, row + 1] }),
          frameRate: 2,
          repeat: -1,
        });
        scene.anims.create({
          key: `${key}-walk-${dir}`,
          frames: scene.anims.generateFrameNumbers(key, { frames: [row + 2, row + 3, row + 4, row + 5] }),
          frameRate: 10,
          repeat: -1,
        });
      }
    }
  }
}

/**
 * Avatar no mundo: paper-doll de sprites 32×64 empilhados (corpo, roupa,
 * cabelo — âncora no pé, ESPECIFICACAO.md §5.2) + nome sobre a cabeça +
 * balão de emote. Movimento tile a tile com tween de STEP_MS e y-sorting
 * via depth = y do pé.
 */
export class Avatar {
  readonly container: Phaser.GameObjects.Container;
  private readonly layers: Phaser.GameObjects.Sprite[] = [];
  private readonly keys: string[] = [];
  private readonly emoteText: Phaser.GameObjects.Text;
  private dir: Direction = "down";
  private tween: Phaser.Tweens.Tween | null = null;
  private idleTimer: Phaser.Time.TimerEvent | null = null;
  private emoteTimer: Phaser.Time.TimerEvent | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    name: string,
    avatar: AvatarConfig,
    tileX: number,
    tileY: number,
    isSelf = false,
  ) {
    for (const layer of AVATAR_LAYERS) {
      const key = textureKey(layer as AvatarLayer, avatar[layer]);
      const sprite = scene.add.sprite(0, 0, key).setOrigin(0.5, 1);
      this.layers.push(sprite);
      this.keys.push(key);
    }
    const label = scene.add
      .text(0, -68, name, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: isSelf ? "#6ee7b7" : "#ffffff",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setResolution(4);
    this.emoteText = scene.add
      .text(0, -84, "", { fontSize: "16px" })
      .setOrigin(0.5, 1)
      .setResolution(4)
      .setVisible(false);

    this.container = scene.add.container(px(tileX), py(tileY), [...this.layers, label, this.emoteText]);
    this.container.setDepth(this.container.y);
    this.play("idle", "down");
  }

  /** Anda 1 tile até (tileX, tileY), virado para dir. */
  step(tileX: number, tileY: number, dir: Direction) {
    this.dir = dir;
    this.tween?.stop();
    this.play("walk", dir);
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
    this.play("idle", dir);
  }

  /** Vira sem andar. */
  face(dir: Direction) {
    if (this.dir === dir) return;
    this.dir = dir;
    const anim = this.layers[0].anims.currentAnim?.key.includes("-walk-") ? "walk" : "idle";
    this.play(anim, dir);
  }

  /** Mostra um emoji sobre a cabeça (RF-AVATAR-05); "" esconde. */
  showEmote(emoji: string, persistent = false) {
    this.emoteTimer?.remove();
    this.emoteTimer = null;
    if (!emoji) {
      this.emoteText.setVisible(false);
      return;
    }
    this.emoteText.setText(emoji).setVisible(true).setScale(0.4).setAlpha(1);
    this.scene.tweens.add({ targets: this.emoteText, scale: 1, duration: 180, ease: "Back.Out" });
    if (!persistent) {
      this.emoteTimer = this.scene.time.delayedCall(EMOTE_MS, () => {
        this.scene.tweens.add({
          targets: this.emoteText,
          alpha: 0,
          duration: 250,
          onComplete: () => this.emoteText.setVisible(false),
        });
      });
    }
  }

  destroy() {
    this.tween?.stop();
    this.idleTimer?.remove();
    this.emoteTimer?.remove();
    this.container.destroy();
  }

  private play(anim: "idle" | "walk", dir: Direction) {
    this.layers.forEach((s, i) => s.play(`${this.keys[i]}-${anim}-${dir}`, true));
  }

  // Volta ao idle se nenhum novo passo chegar logo após o tween.
  private scheduleIdle() {
    this.idleTimer?.remove();
    this.idleTimer = this.scene.time.delayedCall(80, () => {
      if (!this.tween?.isPlaying()) this.play("idle", this.dir);
    });
  }
}

// Centro do tile no eixo X; pé do avatar na base do tile no eixo Y.
export const px = (tileX: number) => tileX * TILE_SIZE + TILE_SIZE / 2;
export const py = (tileY: number) => tileY * TILE_SIZE + TILE_SIZE;
