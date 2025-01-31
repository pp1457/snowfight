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

    // Create a container for the scoreboard
    this.scoreboard = this.add.container(window.innerWidth - 200, 20);

    // Add a background rectangle
    const bg = this.add.rectangle(0, 0, 180, 300, 0x000000, 0.7);  // Increase the height for more space
    bg.setOrigin(0, 0);

    // Add the score board title text with a custom font
    this.scoreBoardTitle = this.add.text(10, 10, 'Score Board', {
        fontSize: '20px',
        color: '#ffffff',
        fontFamily: 'Arial',  // Use Arial for the title
        fontStyle: 'bold',
        padding: { x: 5, y: 5 }
    });

    // Add the user scores text with a different font
    this.userScoresText = this.add.text(10, 50, '', {
        fontSize: '16px',
        color: '#ffffff',
        fontFamily: 'Courier New',  // Use Courier New for the scores
        padding: { x: 5, y: 5 }
    });

    // Ensure both texts are clear with better anti-aliasing
    this.scoreBoardTitle.setResolution(5);
    this.userScoresText.setResolution(5);

    // Add both elements to the container
    this.scoreboard.add([bg, this.scoreBoardTitle, this.userScoresText]);

    // Make sure the scoreboard stays fixed on the screen
    this.scoreboard.setScrollFactor(0);

    this.input.on('pointerdown', startCharging, this);
    this.input.on('pointerup', fireSnowball, this);

    // const mockState = {
    //     players: {
    //         'player1': { x: 100, y: 150 },
    //         'player2': { x: 200, y: 250 },
    //         'player3': { x: 300, y: 350 }
    //     },
    //     scores: {
    //         'player1': 10,
    //         'player2': 20,
    //         'player3': 30
    //     }
    // };

    // updateGameState.call(this, mockState);
}

function anyKeyIsDown(keys) {
    return keys.some(key => key.isDown);
}

function createPlayer(scene, x, y) {
    // Create the main player body (physics-enabled)
    const circle = scene.add.circle(0, 0, 20, 0x00ff00);

    // Create the health bar (no physics, just a visual element)
    const healthBar = scene.add.rectangle(0, -30, 40, 5, 0xff0000);

    // Create a container to group them visually (container does not have physics)
    const container = scene.add.container(x, y, [circle, healthBar]);
    scene.physics.add.existing(container);
    container.body.setSize(40, 40);
    container.body.setCollideWorldBounds(true);  // Enable world bounds collision for the circle
    
    return { 
        container, // Visual grouping of circle and health bar
        circle,    // Physics-enabled circle
        healthBar, // Health bar UI element
        health: 100
    };
}

function update() {
    if (!isAlive) return;

    const speed = 200;
    player.container.body.setVelocity(0); // Reset velocity

    // Define movement keys
    const leftKeys = [cursors.left, this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A)];
    const rightKeys = [cursors.right, this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)];
    const upKeys = [cursors.up, this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W)];
    const downKeys = [cursors.down, this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S)];

    let velocityX = 0;
    let velocityY = 0;

    // Apply movement based on key input
    if (anyKeyIsDown(leftKeys)) {
        velocityX = -speed;
    } else if (anyKeyIsDown(rightKeys)) {
        velocityX = speed;
    }

    if (anyKeyIsDown(upKeys)) {
        velocityY = -speed;
    } else if (anyKeyIsDown(downKeys)) {
        velocityY = speed;
    }

    // Normalize the velocity to avoid diagonal speed boost
    if (velocityX !== 0 && velocityY !== 0) {
        const magnitude = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
        velocityX /= magnitude;
        velocityY /= magnitude;
        velocityX *= speed;
        velocityY *= speed;
    }

    // Apply the velocity to the container
    player.container.body.setVelocity(velocityX, velocityY);

    // Send position update to server
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'move',
            id: player.id,
            x: player.container.x, // Use the container's correct position
            y: player.container.y
        }));
    }
}

function startCharging() {
    if (!isAlive || isCharging) return;
    
    isCharging = true;
    chargeStartTime = this.time.now;
    player.chargingSnowball = this.add.circle(
        player.container.x,
        player.container.y,
        5,
        0xffffff
    ).setAlpha(0.7);
}

function fireSnowball(pointer) {
    if (!isCharging || !player.chargingSnowball) return;

    const chargeTime = this.time.now - chargeStartTime;
    const maxCharge = 2000;
    const radius = 5 + (Math.min(chargeTime, maxCharge) / maxCharge) * 15;
    
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const direction = new Phaser.Math.Vector2(
        worldPoint.x - player.container.x,
        worldPoint.y - player.container.y
    ).normalize();

    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'fire',
            id: player.id,
            x: player.container.x,
            y: player.container.y,
            direction: { x: direction.x, y: direction.y },
            radius: radius
        }));
    }

    player.chargingSnowball.destroy();
    isCharging = false;
}

function handleServerMessage(event) {
    const data = JSON.parse(event.data);
    
    switch(data.type) {
        case 'update':
            updateGameState.call(this, data.state);
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
        .sort((a, b) => b[1] - a[1])  // Sort scores in descending order
        .slice(0, 10);  // Take only the top 10 players

    // Create the score list as a string
    const scoreList = sortedScores.map(([id, score], index) => {
        return `${index + 1}. ${id} ${score}`;  // Format as "1. player_id: score"
    }).join('\n');  // Join the list into a multiline string

    // Update the user scores text to show the top 10 scores
    this.userScoresText.setText(scoreList);  // Set the text of the userScoresText object
}

function handleHit(data) {
    if (data.targetId === player.id) {
        currentHealth = data.newHealth;
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
    game.scene.scenes[0].scoreText.setPosition(window.innerWidth - 80, 30);
});
