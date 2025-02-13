import { CHARGE_OFFSET_DISTANCE, INITIAL_SNOWBALL_RADIUS, CHARGE_MAX_TIME, MAX_SNOWBALL_RADIUS } from "./constants.js";

export function anyKeyIsDown(keys) {
  return keys.some(key => key.isDown);
}

export function updateMovement(scene, cursors, keyA, keyD, keyW, keyS, player) {
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
    velocityX = velocityX / magnitude;
    velocityY = velocityY / magnitude;
  }
  const speed = scene.registry.get("PLAYER_SPEED");
  player.container.body.setVelocity(velocityX * speed, velocityY * speed);
  return { velocityX: velocityX * speed, velocityY: velocityY * speed };
}

export function updateChargingIndicator(scene, player, chargeStartTime, isCharging) {
  if (isCharging && player.chargingSnowball) {
    const pointer = scene.input.activePointer;
    const worldPoint = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const direction = new Phaser.Math.Vector2(
      worldPoint.x - player.container.x,
      worldPoint.y - player.container.y
    ).normalize();
    player.chargingDirection = direction;
    // Set the charging snowball's offset position.
    const offsetX = direction.x * CHARGE_OFFSET_DISTANCE;
    const offsetY = direction.y * CHARGE_OFFSET_DISTANCE;
    player.chargingSnowball.setPosition(player.container.x + offsetX, player.container.y + offsetY);
    const chargeTime = scene.time.now - chargeStartTime;
    const newRadius = Phaser.Math.Linear(
      INITIAL_SNOWBALL_RADIUS,
      MAX_SNOWBALL_RADIUS,
      Math.min(chargeTime / CHARGE_MAX_TIME, 1)
    );
    player.chargingSnowball.setScale(newRadius / INITIAL_SNOWBALL_RADIUS);
  }
}
