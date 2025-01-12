const config = {
    type: Phaser.AUTO,
    width: window.innerWidth, // Use window's width
    height: window.innerHeight, // Use window's height
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
        mode: Phaser.Scale.RESIZE, // Automatically resize the game canvas
        autoCenter: Phaser.Scale.CENTER_BOTH, // Center the game in the window
    },
};

const game = new Phaser.Game(config);

let circle, cursors, socket;

function preload() {
    this.load.image('tiles', 'assets/tiny-ski.png'); // Load your tileset image
    this.load.tilemapTiledJSON('map', 'assets/tiny-ski.tmj'); // Load your tilemap JSON
}

function create() {
    const map = this.make.tilemap({ key: 'map' }); // Create the tilemap from the loaded JSON
    const tileset = map.addTilesetImage('tiny-ski', 'tiles'); // Add the tileset image to the map

    // Create static layers for ground and trees
    const groundLayer = map.createLayer('Ground', tileset); // Create a static layer for ground
    const treeLayer = map.createLayer('Trees', tileset); // Create a static layer for trees

    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels); // Set camera bounds to match the map size
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels); // Set physics world bounds

    circle = this.add.circle(400, 300, 20, 0x00ff00);
    this.physics.add.existing(circle);
    circle.body.setCollideWorldBounds(true);

    this.cameras.main.startFollow(circle);

    cursors = this.input.keyboard.createCursorKeys();

    // Connect to the server
    socket = new WebSocket('ws://localhost:12345');

    socket.onopen = () => {
        console.log('Connected to server');
    };

    socket.onmessage = (message) => {
        const data = JSON.parse(message.data);
        console.log('Server message:', data);
    };

    // Adjust camera zoom if needed
    this.cameras.main.setZoom(Math.min(window.innerWidth / 800, window.innerHeight / 600));
}

function update() {
    const speed = 200;

    circle.body.setVelocity(0);

    if (cursors.left.isDown) {
        circle.body.setVelocityX(-speed);
    } else if (cursors.right.isDown) {
        circle.body.setVelocityX(speed);
    }

    if (cursors.up.isDown) {
        circle.body.setVelocityY(-speed);
    } else if (cursors.down.isDown) {
        circle.body.setVelocityY(speed);
    }

    // Send position to server
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ x: circle.x, y: circle.y }));
    }
}

// Handle window resize event to keep game canvas updated
window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
});
