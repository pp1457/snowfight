import { updateGameObject } from "./updater.js";

export function sendPositionUpdate(scene, socket, player, velocityX, velocityY) {
  if (!scene.lastSentPosition) {
    scene.lastSentPosition = { x: player.container.x, y: player.container.y };
  }
  const posChanged =
    Math.abs(player.container.x - scene.lastSentPosition.x) > 0.5 ||
    Math.abs(player.container.y - scene.lastSentPosition.y) > 0.5;

  if (posChanged && socket.readyState === WebSocket.OPEN) {
    const updateMsg = {
      type: "movement",
      objectType: "player",
      id: player.id,
      position: { x: player.container.x, y: player.container.y },
      velocity: { x: velocityX, y: velocityY },
      t: Date.now() + (scene.serverTimeOffset || 0),
    };
    socket.send(JSON.stringify(updateMsg));
    scene.lastSentPosition = { x: player.container.x, y: player.container.y };
  }
}

export function handleServerMessage(event) {
  const data = JSON.parse(event.data);
  switch (data.type) {
    case "pong": {
      // Calculate round-trip time (RTT) and offset.
      const T3 = Date.now();
      const T1 = data.clientTime;
      const T2 = data.serverTime;
      const rtt = T3 - T1;
      const offset = T2 - (T1 + rtt / 2);
      // Store the offset in the scene.
      this.serverTimeOffset = offset;
      console.log("Calculated server time offset:", offset);
      break;
    }
    case "movement":
      updateGameObject(this, data);
      break;
    case "hit":
      handleHit(this, data);
      break;
    case "death":
      handleDeath(this, data);
      break;
    case "respawn":
      handleRespawn(this, data);
      break;
    default:
      console.warn("Unknown message type:", data.type);
  }
}

function handleHit(scene, data) {
  if (data.targetId === scene.player.id) {
    scene.player.updateHealth(data.newHealth);
    scene.cameras.main.shake(100, 0.01);
  }
}

function handleDeath(scene, data) {
  if (data.playerId === scene.player.id) {
    scene.isAlive = false;
    scene.player.container.setAlpha(0.5);
    scene.time.delayedCall(3000, () => {
      scene.socket.send(JSON.stringify({
        type: "respawn",
        id: scene.player.id,
      }));
    });
  }
}

function handleRespawn(scene, data) {
  if (data.playerId === scene.player.id) {
    scene.isAlive = true;
    scene.currentHealth = 100;
    scene.player.container.setAlpha(1);
    scene.player.container.setPosition(data.position.x, data.position.y);
    scene.player.updateHealth(100);
  }
}
