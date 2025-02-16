import { PLAYER_RADIUS, PLAYER_SIZE } from "./constants.js";

export function createPlayer(scene, x, y) {
    const circle = scene.add.circle(0, 0, PLAYER_RADIUS, 0x00ff00);
    const container = scene.add.container(x, y, [circle]);
    scene.physics.add.existing(container);
    container.body.setSize(PLAYER_SIZE, PLAYER_SIZE);
    container.body.setOffset(-PLAYER_RADIUS, -PLAYER_RADIUS);
    container.body.setCollideWorldBounds(true);

    // Health bar background.
    const healthBarBg = scene.add.rectangle(0, -30, PLAYER_SIZE, 5, 0x555555);
    healthBarBg.setOrigin(0.5, 0.5);
    container.add(healthBarBg);

    // Health bar.
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
            this.healthBar.fillColor =
                healthPercentage > 0.5 ? 0x00ff00 :
                healthPercentage > 0.25 ? 0xffff00 : 0xff0000;
        },
    };

    playerObj.updateHealth(100);
    return playerObj;
}
