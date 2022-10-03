class Player {
    constructor(id, playerMovement, color) {
        this.id = id;
        this.playerMovement = playerMovement;
        this.color = color;
    }

    setPosition(position) {
        this.playerMovement.position = position;
    }

    isMoving() {
        return this.strength > 0;
    }
}

module.exports = {
    Player,
};