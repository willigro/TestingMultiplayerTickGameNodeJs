class PlayerMovementResponse {
    constructor(angle, strength, x, y, newPosition, velocity) {
        this.angle = angle;
        this.strength = strength;
        this.x = x;
        this.y = y;
        this.newPosition = newPosition;
        this.velocity = velocity;
    }
}

module.exports = {
    PlayerMovementResponse,
};