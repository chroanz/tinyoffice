import Phaser from "phaser";
import { TILE_SIZE } from "./constants";
import { reducedMotion } from "./feel";

/**
 * Exterior animado em volta do mapa: o escritório fica num jardim, então
 * as bordas aparecem em todas as direções (nada de vazio preto ao afastar
 * o zoom ou chegar na parede). Camadas, de trás para frente:
 *   gramado (TileSprite) → sombra do prédio → árvores que balançam →
 *   flores ao vento → sombras de nuvens passando → borboletas.
 * Tudo fica abaixo da profundidade do mapa (o prédio cobre o que estiver
 * "dentro"). Posições são determinísticas (mesma semente para todos).
 */
export const EXTERIOR_MARGIN = 6 * TILE_SIZE;

const D_MEADOW = -100;
const D_SHADOW = -90;
const D_FLOWERS = -80;
const D_TREES = -70;
const D_CLOUDS = -60;
const D_BUTTERFLIES = -50;

export function preloadExterior(scene: Phaser.Scene) {
  scene.load.image("meadow", "/assets/world/meadow.png");
  scene.load.spritesheet("tree", "/assets/world/tree.png", { frameWidth: 56, frameHeight: 64 });
  scene.load.spritesheet("flowers", "/assets/world/flowers.png", { frameWidth: 12, frameHeight: 16 });
  scene.load.spritesheet("butterfly", "/assets/world/butterfly.png", { frameWidth: 14, frameHeight: 10 });
}

/** Gerador pseudoaleatório com semente (mulberry32). */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildExterior(scene: Phaser.Scene, mapW: number, mapH: number) {
  const M = EXTERIOR_MARGIN;
  const rand = rng(1337);
  const still = reducedMotion();

  if (!scene.anims.exists("flower-a")) {
    scene.anims.create({ key: "flower-a", frames: scene.anims.generateFrameNumbers("flowers", { frames: [0, 1] }), frameRate: 1.6, repeat: -1 });
    scene.anims.create({ key: "flower-b", frames: scene.anims.generateFrameNumbers("flowers", { frames: [2, 3] }), frameRate: 1.6, repeat: -1 });
    scene.anims.create({ key: "bfly-a", frames: scene.anims.generateFrameNumbers("butterfly", { frames: [0, 1] }), frameRate: 9, repeat: -1 });
    scene.anims.create({ key: "bfly-b", frames: scene.anims.generateFrameNumbers("butterfly", { frames: [2, 3] }), frameRate: 9, repeat: -1 });
  }

  // Gramado cobrindo tudo (o mapa por cima esconde o miolo).
  scene.add.tileSprite(-M, -M, mapW + 2 * M, mapH + 2 * M, "meadow").setOrigin(0).setDepth(D_MEADOW);

  // Sombra do prédio no gramado (luz de cima-esquerda → sombra para baixo-direita).
  const shadow = scene.add.graphics().setDepth(D_SHADOW);
  shadow.fillStyle(0x0b1a08, 0.28).fillRect(10, mapH, mapW, 10).fillRect(mapW, 10, 10, mapH);

  const inMapZone = (x: number, y: number, pad: number) => x > -pad && x < mapW + pad && y > -pad && y < mapH + pad;

  // Anel de árvores (2 fileiras irregulares) em volta do prédio.
  const trees: Phaser.GameObjects.Sprite[] = [];
  const ring = (offset: number, step: number) => {
    const place = (x: number, y: number) => {
      const jx = (rand() - 0.5) * 18;
      const jy = (rand() - 0.5) * 14;
      const t = scene.add
        .sprite(x + jx, y + jy, "tree", rand() < 0.5 ? 0 : 1)
        .setOrigin(0.5, 0.92)
        .setDepth(D_TREES + (y + jy) / 10000);
      if (rand() < 0.5) t.setFlipX(true);
      trees.push(t);
    };
    for (let x = -offset; x <= mapW + offset; x += step) {
      place(x, -offset);
      place(x, mapH + offset + 40);
    }
    for (let y = -offset + step; y <= mapH + offset; y += step) {
      place(-offset, y);
      place(mapW + offset, y);
    }
  };
  ring(64, 52);
  ring(150, 60);

  // Balanço ao vento: rotação pequena a partir do tronco, cada árvore no seu tempo.
  if (!still) {
    for (const t of trees) {
      scene.tweens.add({
        targets: t,
        angle: { from: -1.4, to: 1.4 },
        duration: 1800 + rand() * 1400,
        delay: rand() * 1500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      });
    }
  }

  // Flores espalhadas no gramado (fora do prédio).
  for (let i = 0; i < 140; i++) {
    const x = -M + rand() * (mapW + 2 * M);
    const y = -M + rand() * (mapH + 2 * M);
    if (inMapZone(x, y, 12)) continue;
    const f = scene.add.sprite(x, y, "flowers", 0).setDepth(D_FLOWERS);
    if (!still) f.play({ key: rand() < 0.6 ? "flower-a" : "flower-b", startFrame: rand() < 0.5 ? 0 : 1 });
    else f.setFrame(rand() < 0.6 ? 0 : 2);
  }

  if (still) return;

  // Sombras de nuvens: manchas suaves atravessando o mapa devagar.
  const clouds: { g: Phaser.GameObjects.Graphics; speed: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const g = scene.add.graphics().setDepth(D_CLOUDS);
    const w = 260 + rand() * 220;
    const h = w * 0.45;
    for (let k = 0; k < 5; k++) {
      g.fillStyle(0x0b1a08, 0.035).fillEllipse(0, 0, w * (1 - k * 0.14), h * (1 - k * 0.14));
    }
    g.setPosition(-M + rand() * (mapW + 2 * M), -M + rand() * (mapH + 2 * M));
    clouds.push({ g, speed: 6 + rand() * 6 });
  }

  // Borboletas: voo em senoide, batendo as asas.
  const flies = Array.from({ length: 9 }, (_, i) => {
    const s = scene.add.sprite(0, 0, "butterfly", 0).setDepth(D_BUTTERFLIES);
    s.play({ key: i % 2 ? "bfly-a" : "bfly-b", startFrame: i % 2 });
    return { s, cx: 0, cy: 0, r: 20 + rand() * 40, phase: rand() * Math.PI * 2, speed: 0.35 + rand() * 0.35 };
  });
  const homeFor = (f: (typeof flies)[number]) => {
    // um ponto qualquer do jardim, longe do prédio
    for (;;) {
      const x = -M + 20 + rand() * (mapW + 2 * M - 40);
      const y = -M + 20 + rand() * (mapH + 2 * M - 40);
      if (!inMapZone(x, y, 40)) {
        f.cx = x;
        f.cy = y;
        return;
      }
    }
  };
  flies.forEach(homeFor);

  const onUpdate = (_t: number, dt: number) => {
    const s = dt / 1000;
    for (const c of clouds) {
      c.g.x += c.speed * s;
      c.g.y += c.speed * 0.35 * s;
      if (c.g.x > mapW + M + 300) {
        c.g.x = -M - 300;
        c.g.y = -M + Math.random() * (mapH + 2 * M);
      }
    }
    for (const f of flies) {
      f.phase += f.speed * s;
      const x = f.cx + Math.cos(f.phase) * f.r;
      const y = f.cy + Math.sin(f.phase * 2) * f.r * 0.45 + Math.sin(f.phase * 7) * 2;
      f.s.setFlipX(Math.sin(f.phase) > 0).setPosition(x, y);
      if (f.phase > Math.PI * 2 * 3) {
        f.phase = 0;
        homeFor(f);
      }
    }
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate));
}
