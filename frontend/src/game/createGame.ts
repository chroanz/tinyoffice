import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { WorldScene } from "./scenes/WorldScene";

export function createGame(parent: HTMLElement): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#1a1b26",
    pixelArt: true, // filtro NEAREST em todas as texturas (RNF-27)
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, WorldScene],
  });
  // Só em dev: permite inspecionar a cena no console e em testes headless.
  if (import.meta.env.DEV) Object.assign(window, { game });
  return game;
}
