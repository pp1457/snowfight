import {
    CHARGE_OFFSET_DISTANCE,
    INITIAL_SNOWBALL_RADIUS,
    CHARGE_MAX_TIME,
    MAX_SNOWBALL_RADIUS
} from "./constants.js";

export function anyKeyIsDown(keys) {
    return keys.some(key => key.isDown);
}

export function updateMovement(scene, cursors, keyA, keyD, keyW, keyS, player) {
    // Reset velocity before applying new movement.
    player.container.body.setVelocity(0);

    const leftKeys = [cursors.left, keyA];
    const rightKeys = [cursors.right, keyD];
    const upKeys = [cursors.up, keyW];
    const downKeys = [cursors.down, keyS];

    let velocityX = 0;
    let velocityY = 0;

    if (anyKeyIsDown(leftKeys)) {
        velocityX = -1;
    } else if (anyKeyIsDown(rightKeys)) {
        velocityX = 1;
    }

    if (anyKeyIsDown(upKeys)) {
        velocityY = -1;
    } else if (anyKeyIsDown(downKeys)) {
        velocityY = 1;
    }

    // Normalize diagonal movement.
    if (velocityX !== 0 && velocityY !== 0) {
        const magnitude = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
        velocityX /= magnitude;
        velocityY /= magnitude;
    }

    const speed = scene.registry.get("PLAYER_SPEED");
    const finalVx = velocityX * speed;
    const finalVy = velocityY * speed;
    player.container.body.setVelocity(finalVx, finalVy);

    return { velocityX: finalVx, velocityY: finalVy };
}

export function updateChargingIndicator(scene, player, chargeStartTime, isCharging) {
    if (isCharging && player.snowball) {
        // Get the pointer and calculate the direction from the player to the pointer.
        const pointer = scene.input.activePointer;
        const worldPoint = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const direction = new Phaser.Math.Vector2(
            worldPoint.x - player.container.x,
            worldPoint.y - player.container.y
        ).normalize();

        // Save the direction for future use.
        player.chargingDirection = direction;

        // Calculate the new position using the fixed offset.
        const newX = player.container.x + direction.x * CHARGE_OFFSET_DISTANCE;
        const newY = player.container.y + direction.y * CHARGE_OFFSET_DISTANCE;

        // Compute the new radius based on how long the player has been charging.
        const chargeTime = scene.time.now - chargeStartTime;
        const newRadius = Phaser.Math.Linear(
            INITIAL_SNOWBALL_RADIUS,
            MAX_SNOWBALL_RADIUS,
            Math.min(chargeTime / CHARGE_MAX_TIME, 1)
        );

        // Update the snowball's position and size.
        player.snowball.setPosition(newX, newY);
        player.snowball.setRadius(newRadius);

        // Send update to the server so others see the charging state.
        if (scene.socket.readyState === WebSocket.OPEN) {
            scene.socket.send(JSON.stringify({
                type: "movement",
                objectType: "snowball",
                id: player.snowball.id, // Use the same id throughout.
                position: { x: newX, y: newY },
                size: newRadius,
                charging: true
            }));
        }
    }
}
