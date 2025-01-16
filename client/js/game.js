const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    physics: {
        default: 'arcade',
        arcade: {
            debug: false,
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
        createContainer: true, // Required for DOM elements
    },
    parent: 'game-container',
};

const game = new Phaser.Game(config);

let player, players = {}, cursors, socket, snowballs, experienceBar, experienceFill;

function preload() {
    this.load.image('tiles', 'assets/tiny-ski.png');
    this.load.tilemapTiledJSON('map', 'assets/tiny-ski.tmj');
}

function create() {
    // Tilemap setup
    const map = this.make.tilemap({ key: 'map' });
    const tileset = map.addTilesetImage('tiny-ski', 'tiles');
    map.createLayer('Ground', tileset);
    const treeLayer = map.createLayer('Trees', tileset);
    treeLayer.setCollisionByProperty({ collides: true });

    // Physics and camera bounds
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    // Create the player
    player = createPlayer(this, 400, 300);

    // Make the camera follow the player
    this.cameras.main.startFollow(player.container, true);

    cursors = this.input.keyboard.createCursorKeys();

    // Snowballs
    snowballs = this.physics.add.group();

    // WebSocket setup
    socket = new WebSocket('ws://localhost:12345');
    socket.onopen = () => console.log('Connected to server');
    socket.onmessage = handleServerMessage.bind(this);

    // Create the scoreText DOM element relative to the window
    this.scoreText = this.add.dom(window.innerWidth - 80, 30, 'div', 
        'font-size: 16px; color: #fff; text-align: left; padding: 10px; background-color: rgba(0, 0, 0, 0.7); border-radius: 5px; border: 1px solid #000;', 
        'Scores'
    );

    // Ensure it's fixed in the viewport
    this.scoreText.setScrollFactor(0);

    // Experience bar setup relative to window size
    const barWidth = 300;
    this.experienceBar = this.add.rectangle(
        window.innerWidth / 2,  // Centered horizontally in window
        window.innerHeight - 40,  // Positioned near the bottom of the window
        barWidth, 
        20, 
        0x000000
    ).setScrollFactor(0);

    this.experienceFill = this.add.rectangle(
        window.innerWidth / 2,  // Centered horizontally in window
        window.innerHeight - 40,  // Positioned near the bottom of the window
        0,  // Start with zero width
        20, 
        0x00ff00
    ).setScrollFactor(0);

    // Update the scoreboard with mock data
    updateScoreBoard.call(this, {
        player: 120,
        other1: 80,
        other2: 150,
    });

    this.experienceFill.width = (60 / 100) * this.experienceBar.width; // Mock experience update

}

// Update loop
function update() {
    const speed = 200;

    player.container.body.setVelocity(0);

    if (cursors.left.isDown) player.container.body.setVelocityX(-speed);
    else if (cursors.right.isDown) player.container.body.setVelocityX(speed);

    if (cursors.up.isDown) player.container.body.setVelocityY(-speed);
    else if (cursors.down.isDown) player.container.body.setVelocityY(speed);

    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'move',
            x: player.container.x,
            y: player.container.y,
        }));
    }

    if (Phaser.Input.Keyboard.JustDown(cursors.space)) {
        socket.send(JSON.stringify({
            type: 'fire',
            x: player.container.x,
            y: player.container.y,
        }));
    }
}

// Create a player or NPC
function createPlayer(scene, x, y) {
    const circle = scene.add.circle(0, 0, 20, 0x00ff00);
    scene.physics.add.existing(circle);
    circle.body.setCollideWorldBounds(true);

    const healthBar = scene.add.rectangle(0, -30, 40, 5, 0xff0000);
    const container = scene.add.container(x, y, [circle, healthBar]);
    scene.physics.add.existing(container);
    container.body.setSize(40, 40);

    return { container };
}

// Handle server messages
function handleServerMessage(message) {
    const data = JSON.parse(message.data);

    if (data.type === 'state') {
        Object.keys(data.players).forEach((id) => {
            if (id !== player.id) {
                if (!players[id]) {
                    players[id] = createPlayer(this, data.players[id].x, data.players[id].y);
                } else {
                    players[id].container.setPosition(data.players[id].x, data.players[id].y);
                }
            }
        });

        Object.keys(players).forEach((id) => {
            if (!data.players[id]) {
                players[id].container.destroy();
                delete players[id];
            }
        });

        snowballs.clear(true,true);
        
        data.snowballs.forEach((snowball) => {
            const sb = this.add.circle(snowball.x,snowball.y ,5 ,0xffffff);
            snowballs.add(sb);
        });

        updateScoreBoard(data.scores);
        
        experienceFill.width = (data.players[player.id].experience / 100) * experienceBar.width;
   }
}

// Update scoreboard
function updateScoreBoard(scores) {
    const sortedScores = Object.entries(scores).sort((a,b) => b[1] - a[1]);
    this.scoreText.node.innerHTML = sortedScores.map(([id , score]) => `${id}: ${score}`).join('<br>');
}

// Resize event listener to update positions on window resize
window.addEventListener('resize', () => {
    console.log("RESIZE!!!");
    // Resize the game to fit the new window size
    game.scale.resize(window.innerWidth, window.innerHeight);

    // Update the position of scoreText
    game.scene.scenes[0].scoreText.setPosition(window.innerWidth - 80, 30);

    // Update the position of experience bar
    game.scene.scenes[0].experienceBar.setPosition(window.innerWidth / 2, window.innerHeight - 40);
    game.scene.scenes[0].experienceFill.setPosition(window.innerWidth / 2, window.innerHeight - 40);
});
