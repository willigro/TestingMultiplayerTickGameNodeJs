class Player {
    constructor(id, playerMovement, playerAim, playerGunPointer, color, lastShootTick) {
        this.id = id;
        this.playerMovement = playerMovement;
        this.playerAim = playerAim;
        this.playerGunPointer = playerGunPointer;
        this.color = color;
        this.lastShootTick = (lastShootTick) ? lastShootTick : 0
    }

    setPosition(position) {
        this.playerMovement.position = position;
    }

    isMoving() {
        return this.playerMovement.strength > 0;
    }

    canShoot(currentTick) {
        if (this.playerAim.strength < 80.0) return false;

        const canShoot = (currentTick - this.lastShootTick) > 15
        if (canShoot) {
            // console.log("current tick=" + currentTick + " lastShootTick=" + this.lastShootTick);
            this.lastShootTick = currentTick;
        }
        return canShoot;
    }
}

module.exports = {
    Player,
};