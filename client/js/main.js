import { GameScene } from "./game.js";
import { FIXED_VIEW_WIDTH, FIXED_VIEW_HEIGHT } from "./constants.js";

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    pixelArt: true,
    render: { antialias: false },
    physics: {
        default: "arcade",
        arcade: { debug: false, gravity: { y: 0 } },
    },
    scene: [GameScene],
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    dom: { createContainer: true },
    parent: "game-container",
};

const game = new Phaser.Game(config);

// Utility function to handle all screen size changes
const handleScreenSizeChange = () => {
    // Resize game viewport
    game.scale.resize(
        Math.min(window.innerWidth, FIXED_VIEW_WIDTH),
        Math.min(window.innerHeight, FIXED_VIEW_HEIGHT)
    );

    // Adjust camera if game scene is active
    const scene = game.scene.getScene("GameScene");
    if (scene) {
        scene.adjustCameraZoom();
    }
};

// Screen resize events
window.addEventListener("resize", handleScreenSizeChange);

// Fullscreen change events (including vendor prefixes)
const fullscreenEvents = [
    "fullscreenchange",
    "webkitfullscreenchange",
    "mozfullscreenchange",
    "MSFullscreenChange"
];

fullscreenEvents.forEach(eventName => {
    document.addEventListener(eventName, handleScreenSizeChange);
});

// Optional: Handle orientation change for mobile devices
window.addEventListener("orientationchange", handleScreenSizeChange);

// Optional: Handle visibility change (when tab becomes visible again)
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        handleScreenSizeChange();
    }
});

// Clean up function (call this when destroying the game)
const cleanupScreenHandlers = () => {
    window.removeEventListener("resize", handleScreenSizeChange);
    fullscreenEvents.forEach(eventName => {
        document.removeEventListener(eventName, handleScreenSizeChange);
    });
    window.removeEventListener("orientationchange", handleScreenSizeChange);
    document.removeEventListener("visibilitychange", handleScreenSizeChange);
};
