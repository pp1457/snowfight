import { PLAYER_SPEED, CHARGE_MAX_TIME, INITIAL_SNOWBALL_RADIUS, MAX_SNOWBALL_RADIUS, CHARGE_OFFSET_DISTANCE, SNOWBALL_SPEED, FIXED_VIEW_WIDTH, FIXED_VIEW_HEIGHT } from "./constants.js";
import { createPlayer } from "./player.js";
import { createSnowball } from "./snowball.js";
import { updateMovement, updateChargingIndicator } from "./input.js";
import { sendPositionUpdate, handleServerMessage } from "./network.js";

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameScene" });
  }

  preload() {
    this.load.image("tiles", "assets/tiny-ski.png");
    this.load.tilemapTiledJSON("map", "assets/tiny-ski.tmj");
  }

  create() {
    this.registry.set("PLAYER_SPEED", PLAYER_SPEED);

    // Create the map.
    const map = this.make.tilemap({ key: "map" });
    const tileset = map.addTilesetImage("tiny-ski", "tiles");
    map.createLayer("Ground", tileset);
    const treeLayer = map.createLayer("Trees", tileset);
    treeLayer.setCollisionByProperty({ collides: true });

    this.mapWidth = map.widthInPixels;
    this.mapHeight = map.heightInPixels;
    this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight);
    this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight);
    this.cameras.main.roundPixels = true;

    // Create the player.
    const spawnMargin = 20;
    const randomX = Phaser.Math.Between(spawnMargin, this.mapWidth - spawnMargin);
    const randomY = Phaser.Math.Between(spawnMargin, this.mapHeight - spawnMargin);
    const player = createPlayer(this, randomX, randomY);
    player.id = Date.now().toString();
    this.cameras.main.startFollow(player.container, true);

    // Save references.
    this.player = player;
    this.players = {};
    this.isAlive = true;
    this.currentHealth = 100;

    // Setup keyboard input.
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);

    // Create the physics group for snowballs.
    this.snowballs = this.physics.add.group();

    // Connect to the server.
    this.socket = new WebSocket("ws://localhost:12345");
    this.socket.onopen = () => {
      console.log("Connected to server");
      // Send initial join message.
      this.socket.send(JSON.stringify({
        type: "join",
        id: this.player.id,
        position: { x: this.player.container.x, y: this.player.container.y }
      }));
    };
    this.socket.onmessage = handleServerMessage.bind(this);

    // Input for charging/firing.
    this.input.on("pointerdown", this.startCharging, this);
    this.input.on("pointerup", this.fireSnowball, this);

    this.adjustCameraZoom();
  }

  update() {
    if (!this.isAlive) return;

    const { velocityX, velocityY } = updateMovement(
      this,
      this.cursors,
      this.keyA,
      this.keyD,
      this.keyW,
      this.keyS,
      this.player
    );
    sendPositionUpdate(this, this.socket, this.player, velocityX, velocityY);

    updateChargingIndicator(this, this.player, this.chargeStartTime, this.isCharging);
  }

  startCharging() {
    if (!this.isAlive || this.isCharging) return;
    this.isCharging = true;
    this.chargeStartTime = this.time.now;
    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const direction = new Phaser.Math.Vector2(
      worldPoint.x - this.player.container.x,
      worldPoint.y - this.player.container.y
    ).normalize();
    this.player.chargingDirection = direction;
    this.player.chargingSnowball = this.add
      .circle(
        this.player.container.x + direction.x * CHARGE_OFFSET_DISTANCE,
        this.player.container.y + direction.y * CHARGE_OFFSET_DISTANCE,
        INITIAL_SNOWBALL_RADIUS,
        0x000000
      )
      .setAlpha(0.8);
  }

  fireSnowball() {
    if (!this.isCharging || !this.player.chargingSnowball) return;
    const chargeTime = this.time.now - this.chargeStartTime;
    const finalRadius = Phaser.Math.Linear(
      INITIAL_SNOWBALL_RADIUS,
      MAX_SNOWBALL_RADIUS,
      Math.min(chargeTime / CHARGE_MAX_TIME, 1)
    );
    const direction = this.player.chargingDirection || new Phaser.Math.Vector2(1, 0);
    const fireX = this.player.container.x + (this.player.chargingSnowball.x - this.player.container.x);
    const fireY = this.player.container.y + (this.player.chargingSnowball.y - this.player.container.y);

    // Send a unified movement update for the fired snowball.
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: "movement",
        objectType: "snowball",
        id: "local_" + Date.now(),
        position: { x: fireX, y: fireY },
        velocity: { x: direction.x * SNOWBALL_SPEED, y: direction.y * SNOWBALL_SPEED },
        size: finalRadius,
      }));
    }
    const localSnowball = createSnowball(this, fireX, fireY, finalRadius);
    localSnowball.id = "local_" + Date.now();
    localSnowball.body.setVelocity(direction.x * SNOWBALL_SPEED, direction.y * SNOWBALL_SPEED);
    this.player.chargingSnowball.destroy();
    this.player.chargingSnowball = null;
    this.isCharging = false;
  }

  adjustCameraZoom() {
    const zoomX = window.innerWidth / FIXED_VIEW_WIDTH;
    const zoomY = window.innerHeight / FIXED_VIEW_HEIGHT;
    let newZoom = Math.min(zoomX, zoomY);
    newZoom = Math.round(newZoom * 100) / 100;
    this.cameras.main.setZoom(newZoom);
  }
}
