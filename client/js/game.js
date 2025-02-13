// ------------------------------
// Global Constants & Variables
// ------------------------------
const PLAYER_SPEED = 200;
const CHARGE_MAX_TIME = 2000;
const INITIAL_SNOWBALL_RADIUS = 5;
const MAX_SNOWBALL_RADIUS = 20;
const CHARGE_OFFSET_DISTANCE = 30;
const PLAYER_RADIUS = 20;
const PLAYER_SIZE = 40;
const SNOWBALL_SPEED = 500;
const DRIFT_THRESHOLD = 1;
const DRIFT_LERP_FACTOR = 0.1;
const FIXED_VIEW_WIDTH = 1600;
const FIXED_VIEW_HEIGHT = 900;

let player, players = {}, cursors, socket, snowballs;
let isCharging = false;
let chargeStartTime = 0;
let currentHealth = 100;
let isAlive = true; // <-- Added missing variable.
let keyA, keyD, keyW, keyS;

// ------------------------------
// Phaser Game Configuration
// ------------------------------
const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  pixelArt: true, // Enforce pixel art rendering.
  render: {
    antialias: false // Disable antialiasing.
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
      gravity: { y: 0 }
    }
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  dom: {
    createContainer: true,
  },
  parent: 'game-container',
};

const game = new Phaser.Game(config);

// ------------------------------
// Preload Assets
// ------------------------------
function preload() {
  this.load.image('tiles', 'assets/tiny-ski.png');
  this.load.tilemapTiledJSON('map', 'assets/tiny-ski.tmj');
}

// ------------------------------
// Create the Scene
// ------------------------------
function create() {
  // Create Tilemap & Layers.
  const map = this.make.tilemap({ key: 'map' });
  const tileset = map.addTilesetImage('tiny-ski', 'tiles');
  const groundLayer = map.createLayer('Ground', tileset);
  const treeLayer = map.createLayer('Trees', tileset);
  treeLayer.setCollisionByProperty({ collides: true });

  this.mapWidth = map.widthInPixels;
  this.mapHeight = map.heightInPixels;
  this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight);
  this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight);
  this.cameras.main.roundPixels = true;

  console.log(`Map size in pixels: ${this.mapWidth} x ${this.mapHeight}`);
  console.log(`Tile size: ${map.tileWidth} x ${map.tileHeight}`);
  console.log(`Tile count: ${map.width} x ${map.height}`);

  // Create Player.
  const spawnMargin = 20;
  const randomX = Phaser.Math.Between(spawnMargin, this.mapWidth - spawnMargin);
  const randomY = Phaser.Math.Between(spawnMargin, this.mapHeight - spawnMargin);
  player = createPlayer(this, randomX, randomY);
  this.cameras.main.startFollow(player.container, true);

  // Setup Input.
  cursors = this.input.keyboard.createCursorKeys();
  keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
  keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
  keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
  keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);

  // Group for Snowballs.
  snowballs = this.physics.add.group();

  // Connect to the Server.
  socket = new WebSocket('ws://localhost:12345');
  socket.onopen = () => {
    console.log('Connected to server');
    player.id = Date.now().toString();
    socket.send(JSON.stringify({
      type: 'join',
      id: player.id,
      x: player.container.x,
      y: player.container.y
    }));
  };
  socket.onmessage = handleServerMessage.bind(this);

  // Input Events for Charging and Firing Snowballs.
  this.input.on('pointerdown', startCharging, this);
  this.input.on('pointerup', fireSnowball, this);

  // Adjust camera zoom on startup.
  adjustCameraZoom.call(this);
}

// ------------------------------
// Update Loop (Refactored)
// ------------------------------
function update() {
  if (!isAlive) return;
  const { velocityX, velocityY } = updateMovement(this);
  sendPositionUpdate(this, velocityX, velocityY);
  updateChargingIndicator(this);
  updateSnowballDrift();
}

// ------------------------------
// Helper Functions
// ------------------------------
function anyKeyIsDown(keys) {
  return keys.some(key => key.isDown);
}

function createPlayer(scene, x, y) {
  const circle = scene.add.circle(0, 0, PLAYER_RADIUS, 0x00ff00);
  const container = scene.add.container(x, y, [circle]);
  scene.physics.add.existing(container);
  container.body.setSize(PLAYER_SIZE, PLAYER_SIZE);
  container.body.setOffset(-PLAYER_RADIUS, -PLAYER_RADIUS);
  container.body.setCollideWorldBounds(true);

  const healthBarBg = scene.add.rectangle(0, -30, PLAYER_SIZE, 5, 0x555555);
  healthBarBg.setOrigin(0.5, 0.5);
  container.add(healthBarBg);

  const healthBar = scene.add.rectangle(-PLAYER_RADIUS, -30, PLAYER_SIZE, 5, 0x00ff00);
  healthBar.setOrigin(0, 0.5);
  container.add(healthBar);

  const playerObj = {
    container,
    circle,
    healthBar,
    healthBarBg,
    health: 100,
    updateHealth(newHealth) {
      this.health = newHealth;
      const healthPercentage = Math.max(newHealth / 100, 0);
      this.healthBar.width = PLAYER_SIZE * healthPercentage;
      this.healthBar.fillColor = (healthPercentage > 0.5)
        ? 0x00ff00
        : (healthPercentage > 0.25)
          ? 0xffff00
          : 0xff0000;
    }
  };
  playerObj.updateHealth(100);
  return playerObj;
}

function createSnowball(scene, x, y, radius = 10) {
  const circle = scene.add.circle(x, y, radius, 0x000000);
  scene.physics.add.existing(circle);
  circle.body.setCircle(radius);
  snowballs.add(circle);
  return circle;
}

function updateMovement(scene) {
  player.container.body.setVelocity(0);
  const leftKeys = [cursors.left, keyA];
  const rightKeys = [cursors.right, keyD];
  const upKeys = [cursors.up, keyW];
  const downKeys = [cursors.down, keyS];

  let velocityX = 0;
  let velocityY = 0;
  if (anyKeyIsDown(leftKeys)) {
    velocityX = -PLAYER_SPEED;
  } else if (anyKeyIsDown(rightKeys)) {
    velocityX = PLAYER_SPEED;
  }
  if (anyKeyIsDown(upKeys)) {
    velocityY = -PLAYER_SPEED;
  } else if (anyKeyIsDown(downKeys)) {
    velocityY = PLAYER_SPEED;
  }
  if (velocityX !== 0 && velocityY !== 0) {
    const magnitude = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
    velocityX = (velocityX / magnitude) * PLAYER_SPEED;
    velocityY = (velocityY / magnitude) * PLAYER_SPEED;
  }
  player.container.body.setVelocity(velocityX, velocityY);
  return { velocityX, velocityY };
}

function sendPositionUpdate(scene, velocityX, velocityY) {
  if (!scene.lastSentPosition) {
    scene.lastSentPosition = { x: player.container.x, y: player.container.y };
  }
  const posChanged =
    Math.abs(player.container.x - scene.lastSentPosition.x) > 0.5 ||
    Math.abs(player.container.y - scene.lastSentPosition.y) > 0.5;
  if (posChanged && socket.readyState === WebSocket.OPEN) {
    const updateMsg = {
      type: 'move',
      id: player.id,
      x: player.container.x,
      y: player.container.y,
      vx: velocityX,
      vy: velocityY,
      t: Date.now()
    };
    socket.send(JSON.stringify(updateMsg));
    scene.lastSentPosition = { x: player.container.x, y: player.container.y };
  }
}

function updateChargingIndicator(scene) {
  if (isCharging && player.chargingSnowball) {
    const pointer = scene.input.activePointer;
    const worldPoint = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const direction = new Phaser.Math.Vector2(
      worldPoint.x - player.container.x,
      worldPoint.y - player.container.y
    ).normalize();
    player.chargingDirection = direction;
    // Compute offset and set charging ball position in world coordinates.
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

function updateSnowballDrift() {
  snowballs.getChildren().forEach(snowball => {
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

function startCharging() {
  if (!isAlive || isCharging) return;
  isCharging = true;
  chargeStartTime = this.time.now;
  const pointer = this.input.activePointer;
  const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
  const direction = new Phaser.Math.Vector2(
    worldPoint.x - player.container.x,
    worldPoint.y - player.container.y
  ).normalize();
  player.chargingDirection = direction;
  // Create the charging ball as a world object (not added to the container)
  player.chargingSnowball = this.add.circle(
    player.container.x + direction.x * CHARGE_OFFSET_DISTANCE,
    player.container.y + direction.y * CHARGE_OFFSET_DISTANCE,
    INITIAL_SNOWBALL_RADIUS,
    0x000000
  ).setAlpha(0.8);
}

function fireSnowball() {
  if (!isCharging || !player.chargingSnowball) return;
  const chargeTime = this.time.now - chargeStartTime;
  const finalRadius = Phaser.Math.Linear(
    INITIAL_SNOWBALL_RADIUS,
    MAX_SNOWBALL_RADIUS,
    Math.min(chargeTime / CHARGE_MAX_TIME, 1)
  );
  const direction = player.chargingDirection || new Phaser.Math.Vector2(1, 0);
  const fireX = player.container.x + player.chargingSnowball.x - player.container.x;
  const fireY = player.container.y + player.chargingSnowball.y - player.container.y;
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'fire',
      id: player.id,
      x: fireX,
      y: fireY,
      direction: { x: direction.x, y: direction.y },
      radius: finalRadius
    }));
  }
  const localSnowball = createSnowball(this, fireX, fireY, finalRadius);
  localSnowball.id = 'local_' + Date.now();
  localSnowball.body.setVelocity(direction.x * SNOWBALL_SPEED, direction.y * SNOWBALL_SPEED);
  player.chargingSnowball.destroy();
  player.chargingSnowball = null;
  isCharging = false;
}

function updateSnowballFromServer(snowball, updateData) {
  snowball.setPosition(updateData.x, updateData.y);
  if (snowball.body) {
    snowball.body.setVelocity(updateData.vx, updateData.vy);
  }
  snowball.lastUpdate = updateData.t || Date.now();
  snowball.lastKnownPosition = { x: updateData.x, y: updateData.y };
}

function handleServerMessage(event) {
  const data = JSON.parse(event.data);
  switch (data.type) {
    case 'update':
      updateGameState.call(this, data.state);
      break;
    case 'snowball_update': {
      // Wrap the lexical declaration in its own block.
      let snowball = snowballs.getChildren().find(s => s.id === data.snowballId);
      if (!snowball) {
        snowball = createSnowball(this, data.x, data.y, 10);
        snowball.id = data.snowballId;
      }
      updateSnowballFromServer(snowball, data);
      break;
    }
    case 'hit':
      handleHit.call(this, data);
      break;
    case 'death':
      handleDeath.call(this, data);
      break;
    case 'respawn':
      handleRespawn.call(this, data);
      break;
    default:
      console.log('Unknown message type:', data.type);
  }
}

function updateGameState(state) {
  Object.keys(state.players).forEach(id => {
    if (id !== player.id) {
      if (!players[id]) {
        players[id] = createPlayer(this, state.players[id].x, state.players[id].y);
        players[id].id = id;
      }
      players[id].container.setPosition(state.players[id].x, state.players[id].y);
    }
  });
  Object.keys(players).forEach(id => {
    if (!state.players[id]) {
      players[id].container.destroy();
      delete players[id];
    }
  });
  const sortedScores = Object.entries(state.scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const scoreList = sortedScores
    .map(([id, score], index) => `${index + 1}. ${id} ${score}`)
    .join('\n');
  const scoreElem = document.getElementById('scoreboard-scores');
  if (scoreElem) {
    scoreElem.innerText = scoreList;
  }
}

function handleHit(data) {
  if (data.targetId === player.id) {
    player.updateHealth(data.newHealth);
    this.cameras.main.shake(100, 0.01);
  }
}

function handleDeath(data) {
  if (data.playerId === player.id) {
    isAlive = false;
    player.container.setAlpha(0.5);
    this.time.delayedCall(3000, () => {
      socket.send(JSON.stringify({
        type: 'respawn',
        id: player.id
      }));
    });
  }
}

function handleRespawn(data) {
  if (data.playerId === player.id) {
    isAlive = true;
    currentHealth = 100;
    player.container.setAlpha(1);
    player.container.setPosition(data.x, data.y);
    player.updateHealth(100);
  }
}

function adjustCameraZoom() {
  const zoomX = window.innerWidth / FIXED_VIEW_WIDTH;
  const zoomY = window.innerHeight / FIXED_VIEW_HEIGHT;
  let newZoom = Math.min(zoomX, zoomY);
  newZoom = Math.round(newZoom * 100) / 100; // Round to two decimals.
  this.cameras.main.setZoom(newZoom);
}

window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
  const scene = game.scene.scenes[0];
  if (scene) {
    adjustCameraZoom.call(scene);
  }
});
