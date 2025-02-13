import { GameScene } from "./game.js";

const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  pixelArt: true,
  render: { antialias: false },
  physics: {
    default: "arcade",
    arcade: { debug: false, gravity: { y: 0 } },
  },
  scene: [GameScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  dom: { createContainer: true },
  parent: "game-container",
};

const game = new Phaser.Game(config);

window.addEventListener("resize", () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
  const scene = game.scene.getScene("GameScene");
  if (scene) {
    scene.adjustCameraZoom();
  }
});
