import { createPlayer } from "./player.js";
import { createSnowball } from "./snowball.js";

export function updateGameObject(scene, data) {
    // data: { objectType, id, position, velocity, size, charging, ... }
    switch (data.objectType) {
        case "player":
            // Skip updating the local player.
            if (data.id === scene.player.id) return;
            // Create the remote player if it doesn't exist.
            if (!scene.players[data.id]) {
                scene.players[data.id] = createPlayer(scene, data.position.x, data.position.y);
                scene.players[data.id].id = data.id;
            }
            const player = scene.players[data.id];
            // Smoothly interpolate the player's position.
            player.container.x = Phaser.Math.Linear(player.container.x, data.position.x, 0.2);
            player.container.y = Phaser.Math.Linear(player.container.y, data.position.y, 0.2);
            // Update the player's velocity if the physics body exists.
            if (player.container.body) {
                player.container.body.setVelocity(data.velocity.x, data.velocity.y);
            }
            player.updateHealth(data.newHealth);
            break;

        case "snowball": {
            let snowball = scene.snowballs.getChildren().find(s => s.id === data.id);
            if (!snowball) {
                const radius = data.size || 10;
                // Create the snowball regardless of whether it's charging or fired.
                snowball = createSnowball(scene, data.position.x, data.position.y, radius);
                snowball.id = data.id;
                scene.snowballs.add(snowball);
            }
            // Update the snowball's death date.
            snowball.deathDate = data.deathDate;
            if (data.charging) {
                // For a charging snowball, interpolate its position and update its radius.
                snowball.x = Phaser.Math.Linear(snowball.x, data.position.x, 0.2);
                snowball.y = Phaser.Math.Linear(snowball.y, data.position.y, 0.2);
                snowball.setRadius(data.size);
            } else {
                // For a fired snowball, set its position and velocity directly.
                snowball.x = data.position.x;
                snowball.y = data.position.y;
                if (snowball.body) {
                    snowball.body.setVelocity(data.velocity.x, data.velocity.y);
                }
            }
            break;
        }

        default:
            console.warn("Unknown object type in update:", data.objectType);
    }
}
