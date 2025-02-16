import { DRIFT_THRESHOLD, DRIFT_LERP_FACTOR } from "./constants.js";

export function createSnowball(scene, x, y, radius = 10) {
    const circle = scene.add.circle(x, y, radius, 0x000000);
    scene.physics.add.existing(circle);
    circle.body.setCircle(radius);
    return circle;
}

export function updateSnowballFromServer(snowball, updateData) {
    snowball.setPosition(updateData.x, updateData.y);
    if (snowball.body) {
        snowball.body.setVelocity(updateData.vx, updateData.vy);
    }
    snowball.lastUpdate = updateData.t || Date.now();
    snowball.lastKnownPosition = { x: updateData.x, y: updateData.y };
}

export function checkAlive(scene) {
    const currentTime = Date.now();
    scene.snowballs.getChildren().forEach(snowball => {
        if (snowball.deathDate && currentTime > snowball.deathDate) {
            snowball.destroy();
            scene.snowballs.remove(snowball);
        }
    });
}
