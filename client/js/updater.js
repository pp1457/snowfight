import { createPlayer } from "./player.js";
import { createSnowball } from "./snowball.js";

export function updateGameObject(scene, data) {
  // data: { objectType, id, position, velocity, size?, timestamp?, ... }
  switch (data.objectType) {
    case "player":
      if (data.id === scene.player.id) return;
      if (!scene.players[data.id]) {
        scene.players[data.id] = createPlayer(scene, data.position.x, data.position.y);
        scene.players[data.id].id = data.id;
      }
      const player = scene.players[data.id];
      // const currentTime = Date.now() + (scene.serverTimeOffset || 0);
      // If the server provided a timestamp, use it.
      // const targetTime = data.t || currentTime;
      // Smoothly interpolate position.
      player.container.x = Phaser.Math.Linear(player.container.x, data.position.x, 0.2);
      player.container.y = Phaser.Math.Linear(player.container.y, data.position.y, 0.2);
      if (player.container.body) {
        player.container.body.setVelocity(
          Phaser.Math.Linear(player.container.body.velocity.x, data.velocity.x, 0.2),
          Phaser.Math.Linear(player.container.body.velocity.y, data.velocity.y, 0.2)
        );
      }
      break;

    case "snowball":
      {
        let snowball = scene.snowballs.getChildren().find(s => s.id === data.id);
        if (!snowball) {
          const radius = data.size || 10;
          snowball = createSnowball(scene, data.position.x, data.position.y, radius);
          snowball.id = data.id;
          scene.snowballs.add(snowball);
        }
        // const currentTime = Date.now() + (scene.serverTimeOffset || 0);
        // const targetTime = data.t || currentTime;
        snowball.x = Phaser.Math.Linear(snowball.x, data.position.x, 0.2);
        snowball.y = Phaser.Math.Linear(snowball.y, data.position.y, 0.2);
        if (snowball.body) {
          snowball.body.setVelocity(
            Phaser.Math.Linear(snowball.body.velocity.x, data.velocity.x, 0.2),
            Phaser.Math.Linear(snowball.body.velocity.y, data.velocity.y, 0.2)
          );
        }
      }
      break;

    default:
      console.warn("Unknown object type in update:", data.objectType);
  }
}
