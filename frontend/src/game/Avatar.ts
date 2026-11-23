import Phaser from "phaser";
import { ALL_SHEETS, AVATAR_LAYERS, SHEET, normalizeAvatar, sheetId, textureKey } from "./avatarCatalog";
import { ABOVE_DEPTH, EMOTE_MS, STEP_MS, TILE_SIZE } from "./constants";
import type { AvatarConfig, Direction } from "../net/messages";
import { dust, reducedMotion, ring, squash } from "./feel";

const DIR_ROW: Record<Direction, number> = { down: 0, up: 1, left: 2, right: 3 };
const DIR_VEC: Record<Direction, [number, number]> = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };

// Colunas do sheet (ver backend/cmd/genassets/avatar.go).
const COL_IDLE = 0;
const COL_BLINK = 1;
const WALK_COLS = [2, 3, 4, 5]; // contato → passagem → contato → passagem

// Um ciclo de caminhada (4 frames) cobre 2 passos: 2 frames por tile.
const WALK_FRAME_MS = STEP_MS / 2;

// Nomes e emotes ficam numa camada própria acima de tudo (inclusive dos
// avatares de baixo e da camada Above), para nunca cobrir o rosto de
// ninguém nem sumir atrás de móveis.
const OVERLAY_DEPTH = ABOVE_DEPTH + 1000;
const NAME_Y = -59; // centro da etiqueta, relativo ao pé (boneco GBA: ~54 px de altura)
const NAME_H = 9;
const NAME_SUPERSAMPLE = 4;

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export const overlaps = (a: Rect, b: Rect, pad = 1) =>
  a.x0 < b.x1 + pad && b.x0 < a.x1 + pad && a.y0 < b.y1 + pad && b.y0 < a.y1 + pad;

export const NAME_FONT = '"Inter Variable", Inter, system-ui, sans-serif';

/** Registra as animações de todos os sheets de avatar (uma vez por cena). */
export function registerAvatarAnims(scene: Phaser.Scene) {
  for (const { layer, id } of ALL_SHEETS) {
    const key = textureKey(layer, id);
    for (const dir of Object.keys(DIR_ROW) as Direction[]) {
      const row = DIR_ROW[dir] * SHEET.cols;
      // Parado com piscada: o olho fecha por ~1 frame a cada ~3 s.
      scene.anims.create({
        key: `${key}-idle-${dir}`,
        frames: [
          { key, frame: row + COL_IDLE, duration: 2600 },
          { key, frame: row + COL_BLINK, duration: 110 },
          { key, frame: row + COL_IDLE, duration: 1400 },
          { key, frame: row + COL_BLINK, duration: 110 },
        ],
        repeat: -1,
      });
      scene.anims.create({
        key: `${key}-walk-${dir}`,
        frames: WALK_COLS.map((c) => ({ key, frame: row + c, duration: WALK_FRAME_MS })),
        repeat: -1,
      });
    }
  }
}

/**
 * Avatar no mundo: paper-doll de sprites 64×64 (frames 32×32 de arte, 2×)
 * empilhados (pele, parte de baixo, parte de cima, cabelo, acessório —
 * âncora no pé, ESPECIFICACAO.md §5.2) +
 * sombra + etiqueta de nome + anel de fala + balão de emote em pixel art.
 * Movimento tile a tile com tween de STEP_MS e y-sorting via depth = y.
 */
export class Avatar {
  readonly container: Phaser.GameObjects.Container;
  private readonly overlay: Phaser.GameObjects.Container;
  /** Pivô visual das camadas: squash, pulinho e "tranco" mexem aqui, nunca no container lógico. */
  private readonly body: Phaser.GameObjects.Container;
  private stepCount = 0;
  private lastBumpAt = -Infinity;
  private readonly overlayBias: number;
  private nameplate!: Phaser.GameObjects.Container;
  private nameW = 0;
  private nameShown = true;
  private readonly nameAlpha: number;
  private readonly layers: Phaser.GameObjects.Sprite[] = [];
  private bagSprite: Phaser.GameObjects.Sprite | null = null;
  private readonly keys: string[] = [];
  private readonly speakRing: Phaser.GameObjects.Graphics;
  private readonly emote: Phaser.GameObjects.Sprite;
  private dir: Direction = "down";
  private tween: Phaser.Tweens.Tween | null = null;
  private idleTimer: Phaser.Time.TimerEvent | null = null;
  private emoteTimer: Phaser.Time.TimerEvent | null = null;
  private emoteFloat: Phaser.Tweens.Tween | null = null;
  private speakTween: Phaser.Tweens.Tween | null = null;
  private speaking = false;
  private readonly idleSpeed = 0.8 + Math.random() * 0.4; // piscadas fora de sincronia

  constructor(
    private readonly scene: Phaser.Scene,
    name: string,
    avatar: AvatarConfig,
    tileX: number,
    tileY: number,
    isSelf = false,
  ) {
    const a = normalizeAvatar(avatar);

    const shadow = scene.add.graphics();
    shadow.fillStyle(0x0b0814, 0.28).fillEllipse(0, -3, 22, 8);

    this.speakRing = scene.add.graphics().setVisible(false);
    this.speakRing.lineStyle(2, 0x4ade80, 1).strokeEllipse(0, -3, 28, 11);

    for (const layer of AVATAR_LAYERS) {
      if (a[layer] === "none") continue; // sem cabelo / sem chapéu
      const key = textureKey(layer, sheetId(layer, a));
      const sprite = scene.add.sprite(0, 0, key, 0).setOrigin(0.5, 1);
      if (layer === "bag") this.bagSprite = sprite;
      this.layers.push(sprite);
      this.keys.push(key);
    }

    this.nameAlpha = isSelf ? 1 : 0.9;
    const nameplate = this.buildNameplate(name, isSelf);
    this.nameplate = nameplate;

    this.emote = scene.add.sprite(0, -65, "emote-bubbles", 0).setOrigin(0.5, 1).setVisible(false);

    this.body = scene.add.container(0, 0, this.layers);
    this.container = scene.add.container(px(tileX), py(tileY), [shadow, this.speakRing, this.body]);
    this.overlay = scene.add.container(0, 0, [nameplate, this.emote]);
    this.overlayBias = isSelf ? 0.5 : 0; // o próprio nome por cima em empates
    this.sync();
    this.play("idle", "down");
  }

  /** Etiqueta de nome: pílula escura translúcida, texto nítido. */
  private buildNameplate(name: string, isSelf: boolean) {
    // Pequena e discreta: o mundo é zoom 2×, então 6px ≈ 12px na tela.
    // Texto desenhado 4× maior e reduzido com filtro LINEAR. Não usamos
    // Text.setResolution: em alguns navegadores/GPUs ela era ignorada no
    // desenho e o nome saía 8× maior que a etiqueta.
    const text = this.scene.add
      .text(isSelf ? 2.5 : 0, 0, name, {
        fontFamily: NAME_FONT,
        fontSize: `${6 * NAME_SUPERSAMPLE}px`,
        fontStyle: "600",
        color: "#f5f3ff",
      })
      .setOrigin(0.5, 0.5)
      .setScale(1 / NAME_SUPERSAMPLE);
    text.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    const w = Math.ceil(text.displayWidth) + (isSelf ? 11 : 7);
    this.nameW = w;
    const h = 9;
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0d0b17, 0.55).fillRoundedRect(-w / 2, -h / 2, w, h, 4.5);
    const parts: Phaser.GameObjects.GameObject[] = [bg, text];
    if (isSelf) {
      const dot = this.scene.add.graphics();
      dot.fillStyle(0x4ade80, 1).fillCircle(-w / 2 + 4.5, 0, 1.5);
      parts.push(dot);
    }
    return this.scene.add.container(0, NAME_Y, parts).setAlpha(this.nameAlpha);
  }

  /** Anda 1 tile até (tileX, tileY), virado para dir. */
  step(tileX: number, tileY: number, dir: Direction) {
    this.dir = dir;
    this.tween?.stop();
    this.idleTimer?.remove();
    this.play("walk", dir);
    // Poeirinha a cada 2 passos, saindo do pé para trás do movimento (nível "small").
    if (this.stepCount++ % 2 === 0) {
      const [dx, dy] = DIR_VEC[dir];
      dust(this.scene, this.container.x, this.container.y - 1, this.container.y - 0.5, { n: 2, dirX: dx, dirY: dy });
    }
    this.tween = this.scene.tweens.add({
      targets: this.container,
      x: px(tileX),
      y: py(tileY),
      duration: STEP_MS,
      onUpdate: () => this.sync(),
      onComplete: () => this.scheduleIdle(),
    });
  }

  /** Corrige a posição imediatamente (reconciliação/teleporte). */
  snap(tileX: number, tileY: number, dir: Direction) {
    this.tween?.stop();
    this.dir = dir;
    this.container.setPosition(px(tileX), py(tileY));
    this.sync();
    this.play("idle", dir);
  }

  /** Teleporte com efeito: estica e some, reaparece no destino com overshoot. */
  teleport(tileX: number, tileY: number, dir: Direction) {
    this.tween?.stop();
    this.scene.tweens.killTweensOf(this.body);
    const depth = this.container.y - 0.5;
    ring(this.scene, this.container.x, this.container.y - 3, depth);
    this.scene.tweens.add({
      targets: this.body,
      scaleX: 0.3,
      scaleY: 1.4,
      alpha: 0,
      duration: 120,
      ease: "Quad.In",
      onComplete: () => {
        this.snap(tileX, tileY, dir);
        ring(this.scene, this.container.x, this.container.y - 3, this.container.y - 0.5);
        this.scene.tweens.add({
          targets: this.body,
          scaleX: 1,
          scaleY: 1,
          alpha: 1,
          duration: 260,
          ease: "Back.Out",
          onComplete: () => this.body.setScale(1).setAlpha(1),
        });
      },
    });
  }

  /** Entrada no mapa: surge esticado e assenta com overshoot + anel no chão. */
  spawnIn() {
    if (reducedMotion()) return;
    this.body.setAlpha(0);
    this.overlay.setAlpha(0);
    this.scene.tweens.add({ targets: [this.body, this.overlay], alpha: 1, duration: 180 });
    squash(this.scene, this.layers, 0.5, 1.5, 340);
    ring(this.scene, this.container.x, this.container.y - 3, this.container.y - 0.5);
  }

  /** Saída do mapa: estica, some e só então destrói. */
  despawn(done: () => void) {
    this.tween?.stop();
    if (reducedMotion()) {
      done();
      return;
    }
    ring(this.scene, this.container.x, this.container.y - 3, this.container.y - 0.5, 0x9a93b8);
    this.scene.tweens.killTweensOf(this.body);
    this.scene.tweens.add({ targets: this.overlay, alpha: 0, duration: 120 });
    this.scene.tweens.add({
      targets: this.body,
      scaleX: 0.3,
      scaleY: 1.4,
      alpha: 0,
      duration: 160,
      ease: "Quad.In",
      onComplete: done,
    });
  }

  /** "Tranco" ao andar contra parede: empurra 2 px e volta, com squash leve. */
  bump(dir: Direction) {
    const now = this.scene.time.now;
    if (now - this.lastBumpAt < 450 || reducedMotion()) return; // segurar a tecla não repete
    this.lastBumpAt = now;
    const [dx, dy] = DIR_VEC[dir];
    this.scene.tweens.killTweensOf(this.body);
    this.body.setPosition(0, 0);
    this.scene.tweens.add({
      targets: this.body,
      x: dx * 2,
      y: dy * 2,
      duration: 60,
      ease: "Quad.Out",
      yoyo: true,
      onComplete: () => this.body.setPosition(0, 0),
    });
    squash(this.scene, this.layers, dx ? 0.88 : 1.08, dx ? 1.06 : 0.9, 220);
  }

  /** Pulinho ao mandar um emote: estica na subida, amassa na aterrissagem. */
  hop() {
    if (reducedMotion()) return;
    this.scene.tweens.killTweensOf(this.body);
    this.body.setPosition(0, 0);
    squash(this.scene, this.layers, 0.86, 1.14, 160);
    this.scene.tweens.add({
      targets: this.body,
      y: -6,
      duration: 130,
      ease: "Quad.Out",
      yoyo: true,
      onComplete: () => {
        this.body.setPosition(0, 0);
        squash(this.scene, this.layers, 1.16, 0.84, 200);
        dust(this.scene, this.container.x, this.container.y - 1, this.container.y - 0.5, { n: 3, spread: 7 });
      },
    });
  }

  /** Vira sem andar. */
  face(dir: Direction) {
    if (this.dir === dir) return;
    this.dir = dir;
    const anim = this.layers[0].anims.currentAnim?.key.includes("-walk-") ? "walk" : "idle";
    this.play(anim, dir);
  }

  /** Anel verde pulsante sob os pés enquanto a pessoa fala. */
  setSpeaking(on: boolean) {
    if (on === this.speaking) return;
    this.speaking = on;
    this.speakTween?.stop();
    if (on) {
      this.speakRing.setVisible(true).setAlpha(1).setScale(1);
      this.speakTween = this.scene.tweens.add({
        targets: this.speakRing,
        alpha: 0.35,
        scale: 1.12,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      });
    } else {
      this.speakRing.setVisible(false);
    }
  }

  /** Balão de emote em pixel art (RF-AVATAR-05); índice < 0 esconde. */
  showEmote(index: number, persistent = false) {
    this.emoteTimer?.remove();
    this.emoteTimer = null;
    this.emoteFloat?.stop();
    this.scene.tweens.killTweensOf(this.emote);
    if (index < 0) {
      this.scene.tweens.add({
        targets: this.emote,
        alpha: 0,
        scale: 0.6,
        duration: 140,
        onComplete: () => this.emote.setVisible(false),
      });
      return;
    }
    this.hop();
    this.emote.setFrame(index).setVisible(true).setAlpha(1).setScale(0.2).setY(-61);
    this.scene.tweens.add({ targets: this.emote, scale: 1, y: -65, duration: 260, ease: "Back.Out" });
    this.emoteFloat = this.scene.tweens.add({
      targets: this.emote,
      y: -68,
      duration: 900,
      delay: 260,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
    if (!persistent) {
      this.emoteTimer = this.scene.time.delayedCall(EMOTE_MS, () => this.showEmote(-1));
    }
  }

  destroy() {
    this.tween?.stop();
    this.idleTimer?.remove();
    this.emoteTimer?.remove();
    this.speakTween?.stop();
    this.emoteFloat?.stop();
    this.container.destroy();
    this.overlay.destroy();
  }

  /** Retângulo da etiqueta de nome (coordenadas do mundo). */
  nameRect(): Rect {
    const { x, y } = this.container;
    return { x0: x - this.nameW / 2, x1: x + this.nameW / 2, y0: y + NAME_Y - NAME_H / 2, y1: y + NAME_Y + NAME_H / 2 };
  }

  /** Retângulo do rosto/cabelo (para o nome de outro não cobrir). */
  headRect(): Rect {
    const { x, y } = this.container;
    return { x0: x - 11, x1: x + 11, y0: y - 54, y1: y - 26 };
  }

  /** Retângulo do corpo inteiro (hover revela o nome). */
  bodyRect(): Rect {
    const { x, y } = this.container;
    return { x0: x - 12, x1: x + 12, y0: y - 56, y1: y };
  }

  get y() {
    return this.container.y;
  }

  /** Mostra/esconde a etiqueta com fade (chamado pelo "declutter" da cena). */
  setNameShown(on: boolean) {
    if (on === this.nameShown) return;
    this.nameShown = on;
    this.scene.tweens.killTweensOf(this.nameplate);
    this.scene.tweens.add({ targets: this.nameplate, alpha: on ? this.nameAlpha : 0, duration: on ? 120 : 180 });
  }

  /** y-sorting do corpo e posição/profundidade da camada de nome+emote. */
  private sync() {
    const { x, y } = this.container;
    this.container.setDepth(y);
    this.overlay.setPosition(x, y).setDepth(OVERLAY_DEPTH + y + this.overlayBias);
  }

  private play(anim: "idle" | "walk", dir: Direction) {
    // De costas a mochila fica por cima do cabelo; nas outras direções, sob ele.
    if (this.bagSprite) {
      if (dir === "up") this.body.bringToTop(this.bagSprite);
      else this.body.moveTo(this.bagSprite, this.layers.indexOf(this.bagSprite));
    }
    this.layers.forEach((s, i) => {
      s.play(`${this.keys[i]}-${anim}-${dir}`, true);
      s.anims.timeScale = anim === "idle" ? this.idleSpeed : 1;
    });
  }

  // Volta ao idle se nenhum novo passo chegar logo após o tween (passos
  // seguidos mantêm o ciclo de caminhada contínuo, sem "travar").
  private scheduleIdle() {
    this.idleTimer?.remove();
    this.idleTimer = this.scene.time.delayedCall(60, () => {
      if (!this.tween?.isPlaying()) this.play("idle", this.dir);
    });
  }
}

// Centro do tile no eixo X; pé do avatar na base do tile no eixo Y.
export const px = (tileX: number) => tileX * TILE_SIZE + TILE_SIZE / 2;
export const py = (tileY: number) => tileY * TILE_SIZE + TILE_SIZE - 2;
