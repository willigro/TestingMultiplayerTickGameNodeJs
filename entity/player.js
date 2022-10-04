class Player {
    constructor(id, playerMovement, playerAim, color) {
        this.id = id;
        this.playerMovement = playerMovement;
        this.playerAim = playerAim;
        this.color = color;
    }

    setPosition(position) {
        this.playerMovement.position = position;
    }

    isMoving() {
        return this.playerMovement.strength > 0;
    }
}

module.exports = {
    Player,
};