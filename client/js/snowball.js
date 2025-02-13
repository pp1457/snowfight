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

export function updateSnowballDrift(snowballsGroup) {
  snowballsGroup.getChildren().forEach((snowball) => {
    if (snowball.lastKnownPosition) {
      const dx = snowball.lastKnownPosition.x - snowball.x;
      const dy = snowball.lastKnownPosition.y - snowball.y;
      if (Math.abs(dx) > DRIFT_THRESHOLD || Math.abs(dy) > DRIFT_THRESHOLD) {
        snowball.x = Phaser.Math.Linear(snowball.x, snowball.lastKnownPosition.x, DRIFT_LERP_FACTOR);
        snowball.y = Phaser.Math.Linear(snowball.y, snowball.lastKnownPosition.y, DRIFT_LERP_FACTOR);
      }
    }
  });
}
