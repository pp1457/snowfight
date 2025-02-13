import { createPlayer } from "./player.js";
import { createSnowball } from "./snowball.js";

export function updateGameObject(scene, data) {
  // data: { objectType, id, position, velocity, size?, ... }
  switch (data.objectType) {
    case "player":
      // Skip updating our own player if needed.
      if (data.id === scene.player.id) return;

      if (!scene.players[data.id]) {
        // Create a new player for this id.
        scene.players[data.id] = createPlayer(scene, data.position.x, data.position.y);
        scene.players[data.id].id = data.id;
      } else {
        // Update existing player.
        scene.players[data.id].container.setPosition(data.position.x, data.position.y);
        if (scene.players[data.id].container.body) {
          scene.players[data.id].container.body.setVelocity(data.velocity.x, data.velocity.y);
        }
      }
      break;

    case "snowball":
      {
        let snowball = scene.snowballs.getChildren().find(s => s.id === data.id);
        if (!snowball) {
          // Create new snowball, using provided size if available.
          const radius = data.size || 10;
          snowball = createSnowball(scene, data.position.x, data.position.y, radius);
          snowball.id = data.id;
          scene.snowballs.add(snowball);
        } else {
          // Update existing snowball.
          snowball.setPosition(data.position.x, data.position.y);
          if (snowball.body) {
            snowball.body.setVelocity(data.velocity.x, data.velocity.y);
          }
        }
      }
      break;

    // In the future, you can add cases for other object types (like "tree") here.
    default:
      console.warn("Unknown object type in update:", data.objectType);
  }
}
