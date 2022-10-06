class Player {
    constructor(id, playerMovement, playerAim, color) {
        this.id = id;
        this.playerMovement = playerMovement;
        this.playerAim = playerAim;
        this.color = color;

        this.lastShot = new Date().getTime();
    }

    setPosition(position) {
        this.playerMovement.position = position;
    }

    isMoving() {
        return this.playerMovement.strength > 0;
    }

    canShoot() {
        if (this.playerAim.strength < 80.0) return false;

        const now = new Date().getTime();
        const diff = (now - this.lastShot) / 1000 > 2;
        if (diff) {
            this.lastShot = now;
        }
        return diff;
    }
}

module.exports = {
    Player,
};