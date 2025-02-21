import { createPlayer } from "./player.js";
import { createSnowball } from "./snowball.js";

export function checkAlive(scene) {
    const currentTime = Date.now() + (scene.serverTimeOffset || 0);
    scene.snowballs.getChildren().forEach(snowball => {
        if (snowball.isDead || (snowball.expireDate && snowball.expireDate <= currentTime)) {
            snowball.destroy();
            scene.snowballs.remove(snowball);
        }
    });

    Object.entries(scene.players).forEach(([id, player]) => {
        if (player.isDead || (player.expireDate && player.expireDate <= currentTime)) {
            player.container.destroy(true);
            delete scene.players[id];
        }
    });
}

export function updateGameObject(scene, data) {
    // data: { objectType, id, position, velocity, size, charging, newHealth, isDead, ... }
    switch (data.objectType) {
        case "player":
            // If the update is for the local player, update its health.
            // We still ignore position/velocity updates since the local player is controlled locally.
            if (data.id === scene.player.id) {
                scene.player.updateHealth(data.newHealth);
                // Check if the server indicates that the local player is dead.
                if (data.newHealth <= 0) {
                    // Optionally, you could display a "Game Over" message here.
                    // Redirect back to the login page after a brief delay.
                    setTimeout(() => {
                        window.location.href = "login.html";
                    }, 0);
                }
                return;
            }
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
            // Update health for remote players.
            player.updateHealth(data.newHealth);
            player.isDead = data.isDead;
            player.expireDate = data.expireDate;
            break;

        case "snowball": {
            // Find an existing snowball with the given id.
            let snowball = scene.snowballs.getChildren().find(s => s.id === data.id);
            // If the snowball does not exist and is not marked as dead, create it.
            if (!snowball && !data.isDead) {
                const radius = data.size || 10;
                snowball = createSnowball(scene, data.position.x, data.position.y, radius);
                snowball.id = data.id;
                scene.snowballs.add(snowball);
            }
            
            if (snowball) {
                // Update properties for the snowball.
                snowball.isDead = data.isDead;
                snowball.expireDate = data.expireDate;
    
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
            }
            break;
        }

        default:
            console.warn("Unknown object type in update:", data.objectType);
    }
}
