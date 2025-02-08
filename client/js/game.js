const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    physics: {
        default: 'arcade',
        arcade: {
            debug: false,
            gravity: { y: 0 }
        },
    },
    scene: {
        preload: preload,
        create: create,
        update: update,
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

let player, players = {}, cursors, socket, snowballs, experienceBar, experienceFill;
let isCharging = false;
let chargeStartTime = 0;
let currentHealth = 100;
let isAlive = true;

function preload() {
    this.load.image('tiles', 'assets/tiny-ski.png');
    this.load.tilemapTiledJSON('map', 'assets/tiny-ski.tmj');
    // We no longer load a snowball sprite; we use a black circle instead.
}

function create() {
    const map = this.make.tilemap({ key: 'map' });
    const tileset = map.addTilesetImage('tiny-ski', 'tiles');
    map.createLayer('Ground', tileset);
    const treeLayer = map.createLayer('Trees', tileset);
    treeLayer.setCollisionByProperty({ collides: true });

    // Set world and camera bounds
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    // Generate a random spawn position within the map bounds
    const randomX = Phaser.Math.Between(0, map.widthInPixels);
    const randomY = Phaser.Math.Between(0, map.heightInPixels);

    // Create the player at the random position
    player = createPlayer(this, randomX, randomY);

    // Make the camera follow the player
    this.cameras.main.startFollow(player.container, true);

    cursors = this.input.keyboard.createCursorKeys();
    snowballs = this.physics.add.group();

    // Connect to the server via WebSocket
    socket = new WebSocket('ws://localhost:12345');
    
    socket.onopen = () => {
        console.log('Connected to server');
        // Give the player a unique ID (using timestamp for simplicity)
        player.id = Date.now().toString();
        socket.send(JSON.stringify({
            type: 'join',
            id: player.id,
            x: player.container.x,
            y: player.container.y
        }));
    };

    // Handle messages from the server
    socket.onmessage = handleServerMessage.bind(this);

    // Create a container for the scoreboard
    this.scoreboard = this.add.container(window.innerWidth - 200, 20);

    // Add a background rectangle for the scoreboard
    const bg = this.add.rectangle(0, 0, 180, 300, 0x000000, 0.7);
    bg.setOrigin(0, 0);

    // Add the score board title text
    this.scoreBoardTitle = this.add.text(10, 10, 'Score Board', {
        fontSize: '20px',
        color: '#ffffff',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        padding: { x: 5, y: 5 }
    });

    // Add the user scores text
    this.userScoresText = this.add.text(10, 50, '', {
        fontSize: '16px',
        color: '#ffffff',
        fontFamily: 'Courier New',
        padding: { x: 5, y: 5 }
    });

    // Improve text resolution for better clarity
    this.scoreBoardTitle.setResolution(5);
    this.userScoresText.setResolution(5);

    // Add both elements to the scoreboard container
    this.scoreboard.add([bg, this.scoreBoardTitle, this.userScoresText]);

    // Make sure the scoreboard stays fixed on the screen
    this.scoreboard.setScrollFactor(0);

    // Input events for charging and firing snowballs
    this.input.on('pointerdown', startCharging, this);
    this.input.on('pointerup', fireSnowball, this);
}

function anyKeyIsDown(keys) {
    return keys.some(key => key.isDown);
}

function createPlayer(scene, x, y) {
    // Create the main player body (a green circle)
    const circle = scene.add.circle(0, 0, 20, 0x00ff00);

    // Create a container to group the circle and the health bar
    const container = scene.add.container(x, y, [circle]);
    scene.physics.add.existing(container);
    container.body.setSize(40, 40);
    container.body.setCollideWorldBounds(true);

    // Create the health bar background (gray)
    const healthBarBg = scene.add.rectangle(0, -30, 40, 5, 0x555555);
    healthBarBg.setOrigin(0.5, 0.5);
    container.add(healthBarBg);

    // Create the health bar (red initially)
    const healthBar = scene.add.rectangle(-20, -30, 40, 5, 0xff0000);
    healthBar.setOrigin(0, 0.5);
    container.add(healthBar);

    return {
        container,   // Grouped container for the player
        circle,      // Visual representation (circle)
        healthBar,   // Foreground health bar
        healthBarBg, // Health bar background
        health: 100,

        // Update the health bar based on new health
        updateHealth(newHealth) {
            this.health = newHealth;
            const healthPercentage = Math.max(newHealth / 100, 0);
            this.healthBar.width = 40 * healthPercentage;
            if (healthPercentage > 0.5) {
                this.healthBar.fillColor = 0x00ff00; // Green
            } else if (healthPercentage > 0.25) {
                this.healthBar.fillColor = 0xffff00; // Yellow
            } else {
                this.healthBar.fillColor = 0xff0000; // Red
            }
        }
    };
}

// Helper function to create a snowball as a black circle
function createSnowball(scene, x, y, radius = 10) {
    // Create a black circle to represent the snowball
    const circle = scene.add.circle(x, y, radius, 0x000000);
    // Enable physics on the circle
    scene.physics.add.existing(circle);
    // Set a circular physics body for accurate collisions
    circle.body.setCircle(radius);
    // Add the snowball to the group
    snowballs.add(circle);
    return circle;
}

function update() {
    if (!isAlive) return;

    const speed = 200;
    // Reset the player's velocity
    player.container.body.setVelocity(0);

    // Define movement keys (WASD and arrow keys)
    const leftKeys = [cursors.left, this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A)];
    const rightKeys = [cursors.right, this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)];
    const upKeys = [cursors.up, this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W)];
    const downKeys = [cursors.down, this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S)];

    let velocityX = 0;
    let velocityY = 0;

    // Determine horizontal movement
    if (anyKeyIsDown(leftKeys)) {
        velocityX = -speed;
    } else if (anyKeyIsDown(rightKeys)) {
        velocityX = speed;
    }

    // Determine vertical movement
    if (anyKeyIsDown(upKeys)) {
        velocityY = -speed;
    } else if (anyKeyIsDown(downKeys)) {
        velocityY = speed;
    }

    // Normalize diagonal movement to maintain constant speed
    if (velocityX !== 0 && velocityY !== 0) {
        const magnitude = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
        velocityX = (velocityX / magnitude) * speed;
        velocityY = (velocityY / magnitude) * speed;
    }

    // Apply velocity to the player's physics body
    player.container.body.setVelocity(velocityX, velocityY);

    // Send a position update to the server if the position has changed significantly
    if (!this.lastSentPosition) {
        this.lastSentPosition = { x: player.container.x, y: player.container.y };
    }
    const posChanged = (Math.abs(player.container.x - this.lastSentPosition.x) > 0.5 ||
                        Math.abs(player.container.y - this.lastSentPosition.y) > 0.5);
    if (posChanged && socket.readyState === WebSocket.OPEN) {
        const updateMsg = {
            type: 'move',
            id: player.id,
            x: player.container.x,
            y: player.container.y,
            vx: velocityX,
            vy: velocityY,
            t: Date.now()  // Timestamp (ms) for lag compensation
        };
        socket.send(JSON.stringify(updateMsg));
        this.lastSentPosition = { x: player.container.x, y: player.container.y };
    }

    // --- Update Charging Indicator ---
    // If the player is charging a snowball, update its position and size based on pointer direction and charge time.
    if (isCharging && player.chargingSnowball) {
        const pointer = this.input.activePointer;
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const direction = new Phaser.Math.Vector2(worldPoint.x - player.container.x, worldPoint.y - player.container.y).normalize();
        player.chargingDirection = direction;
        const offsetDistance = 30;
        // Position the charging indicator in front of the player along the current direction.
        player.chargingSnowball.setPosition(
            player.container.x + direction.x * offsetDistance,
            player.container.y + direction.y * offsetDistance
        );
        // Increase the size (scale) of the indicator over time.
        const chargeTime = this.time.now - chargeStartTime;
        const maxCharge = 2000; // Maximum charge time in ms.
        const initialRadius = 5;
        const maxRadius = 20;   // Maximum radius for the charging ball.
        const newRadius = Phaser.Math.Linear(initialRadius, maxRadius, Math.min(chargeTime / maxCharge, 1));
        // Since our circle was originally created with a radius of 5, adjust its scale accordingly.
        player.chargingSnowball.setScale(newRadius / initialRadius);
    }

    // --- Snowball Updates ---
    // Phaser's Arcade Physics automatically updates each snowball's position based on its velocity.
    // Optionally, gently interpolate any drift toward the last known server position.
    snowballs.getChildren().forEach(snowball => {
        if (snowball.lastKnownPosition) {
            const dx = snowball.lastKnownPosition.x - snowball.x;
            const dy = snowball.lastKnownPosition.y - snowball.y;
            if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                snowball.x = Phaser.Math.Linear(snowball.x, snowball.lastKnownPosition.x, 0.1);
                snowball.y = Phaser.Math.Linear(snowball.y, snowball.lastKnownPosition.y, 0.1);
            }
        }
    });
}

function startCharging() {
    if (!isAlive || isCharging) return;
    
    isCharging = true;
    chargeStartTime = this.time.now;
    // Get the initial pointer position and compute the direction from the player.
    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const direction = new Phaser.Math.Vector2(worldPoint.x - player.container.x, worldPoint.y - player.container.y).normalize();
    player.chargingDirection = direction;
    const offsetDistance = 30;
    // Create a black circle as the charging indicator in front of the player.
    player.chargingSnowball = this.add.circle(
        player.container.x + direction.x * offsetDistance,
        player.container.y + direction.y * offsetDistance,
        5, // initial radius
        0x000000
    ).setAlpha(0.8);
}

function fireSnowball(pointer) {
    if (!isCharging || !player.chargingSnowball) return;

    const chargeTime = this.time.now - chargeStartTime;
    const maxCharge = 2000;
    const initialRadius = 5;
    const maxRadius = 20;
    // Determine the final radius of the snowball based on charge time.
    const finalRadius = Phaser.Math.Linear(initialRadius, maxRadius, Math.min(chargeTime / maxCharge, 1));
    
    // Use the stored charging direction.
    const direction = player.chargingDirection || new Phaser.Math.Vector2(1, 0);
    
    // Fire from the position of the charging indicator (not from the player's center).
    const fireX = player.chargingSnowball.x;
    const fireY = player.chargingSnowball.y;
    
    // Send the fire message to the server.
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
    
    // Create a local snowball at the charging indicator's position.
    const snowballSpeed = 500;
    const localSnowball = createSnowball(this, fireX, fireY, finalRadius);
    localSnowball.id = 'local_' + Date.now(); // Temporary ID; ideally, the server provides one.
    localSnowball.body.setVelocity(direction.x * snowballSpeed, direction.y * snowballSpeed);
    
    // Remove the charging indicator and reset the charging state.
    player.chargingSnowball.destroy();
    player.chargingSnowball = null;
    isCharging = false;
}

// --- Snowball Update Functions ---

// Update or create a snowball based on data received from the server.
function updateSnowballFromServer(snowball, updateData) {
    // Set the snowball's position directly.
    snowball.setPosition(updateData.x, updateData.y);
    
    // Set its velocity using Phaser's native physics function.
    if (snowball.body) {
        snowball.body.setVelocity(updateData.vx, updateData.vy);
    }
    
    // Optionally store the last update time and position for drift correction.
    snowball.lastUpdate = updateData.t || Date.now();
    snowball.lastKnownPosition = { x: updateData.x, y: updateData.y };
}

// Handle messages from the server.
function handleServerMessage(event) {
    const data = JSON.parse(event.data);
    
    switch(data.type) {
        case 'update':
            updateGameState.call(this, data.state);
            break;
        case 'snowball_update':
            // Data should include: snowballId, x, y, vx, vy, and t.
            let snowball = snowballs.getChildren().find(s => s.id === data.snowballId);
            if (!snowball) {
                // Create a new snowball as a black circle.
                snowball = createSnowball(this, data.x, data.y, 10);
                snowball.id = data.snowballId;
            }
            updateSnowballFromServer(snowball, data);
            break;
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
            players[id].container.setPosition(
                state.players[id].x,
                state.players[id].y
            );
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

    const scoreList = sortedScores.map(([id, score], index) => {
        return `${index + 1}. ${id} ${score}`;
    }).join('\n');

    this.userScoresText.setText(scoreList);
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
    }
}

window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
    // Adjust scoreboard position if needed:
    if (game.scene.scenes[0].scoreText) {
        game.scene.scenes[0].scoreText.setPosition(window.innerWidth - 80, 30);
    }
});
