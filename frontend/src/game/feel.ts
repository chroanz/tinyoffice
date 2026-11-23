import Phaser from "phaser";
import { motionReduced } from "../state/prefsStore";

/**
 * "Juice" do mundo (ver .claude/skills/game-feel). O PixelRooms é um
 * escritório social, não um jogo de ação: só usamos o nível "small" —
 * squash & stretch, poeirinha e anéis com easing. Nada de tremer a tela
 * nem hit-stop (enjoo e sensação de lag numa reunião). Todo efeito é
 * visual: nunca mexe na posição lógica/tile do avatar, e sempre termina
 * exatamente no valor de repouso.
 */

/** Respeita "reduzir movimento" (configurações do app ou do sistema). */
export const reducedMotion = motionReduced;

type Scalable = Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject;

/**
 * Squash & stretch com overshoot: aplica (sx, sy) e volta a 1 com Back.Out.
 * Mata tweens anteriores nos mesmos alvos (o evento pode repetir) e
 * garante o repouso no fim.
 */
export function squash(scene: Phaser.Scene, targets: Scalable[], sx: number, sy: number, duration = 200) {
  if (reducedMotion()) return;
  scene.tweens.killTweensOf(targets);
  for (const t of targets) t.setScale(sx, sy);
  scene.tweens.add({
    targets,
    scaleX: 1,
    scaleY: 1,
    duration,
    ease: "Back.Out",
    onComplete: () => targets.forEach((t) => t.setScale(1)),
  });
}

// Pool de partículas de poeira (quadradinhos de 2×2 px de mundo = 1 px de arte).
const dustPool = new WeakMap<Phaser.Scene, Phaser.GameObjects.Rectangle[]>();

function takeDust(scene: Phaser.Scene) {
  let pool = dustPool.get(scene);
  if (!pool) {
    pool = [];
    dustPool.set(scene, pool);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => dustPool.delete(scene));
  }
  const free = pool.find((r) => !r.visible);
  if (free) return free;
  const r = scene.add.rectangle(0, 0, 2, 2, 0xffffff).setVisible(false);
  pool.push(r);
  return r;
}

/**
 * Poeirinha nos pés: n partículas que sobem um pouco, se espalham para
 * trás do movimento e somem. color: tom claro do chão.
 */
export function dust(
  scene: Phaser.Scene,
  x: number,
  y: number,
  depth: number,
  opts: { n?: number; dirX?: number; dirY?: number; color?: number; spread?: number } = {},
) {
  if (reducedMotion()) return;
  const { n = 3, dirX = 0, dirY = 0, color = 0xf3e6cf, spread = 6 } = opts;
  for (let i = 0; i < n; i++) {
    const p = takeDust(scene);
    const ox = Phaser.Math.FloatBetween(-spread, spread);
    p.setPosition(x + ox, y - Phaser.Math.FloatBetween(0, 2))
      .setFillStyle(color, 0.9)
      .setAlpha(0.9)
      .setScale(1)
      .setDepth(depth)
      .setVisible(true);
    scene.tweens.add({
      targets: p,
      x: p.x - dirX * Phaser.Math.FloatBetween(4, 8) + ox * 0.4,
      y: p.y - Phaser.Math.FloatBetween(3, 7) - dirY * 4,
      alpha: 0,
      scale: 0.5,
      duration: Phaser.Math.Between(260, 420),
      ease: "Quad.Out",
      onComplete: () => p.setVisible(false),
    });
  }
}

/** Anel que se expande no chão (entrada/saída de alguém, teleporte). */
export function ring(scene: Phaser.Scene, x: number, y: number, depth: number, color = 0xc4b5fd) {
  if (reducedMotion()) return;
  const g = scene.add.graphics().setPosition(x, y).setDepth(depth);
  g.lineStyle(2, color, 1).strokeEllipse(0, 0, 20, 8);
  g.setScale(0.6);
  scene.tweens.add({
    targets: g,
    scale: 1.9,
    alpha: 0,
    duration: 420,
    ease: "Cubic.Out",
    onComplete: () => g.destroy(),
  });
}
