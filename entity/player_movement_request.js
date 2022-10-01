class PlayerMovementRequest {
    constructor(angle, strength, x, y, velocity) {
        this.angle = angle;
        this.strength = strength;
        this.x = x;
        this.y = y;
        this.velocity = velocity;
    }
}

module.exports = {
    PlayerMovementRequest,
};