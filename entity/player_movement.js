class PlayerMovement {
    constructor(position, angle, strength, velocity) {
        this.position = position;
        this.angle = angle;
        this.strength = strength;
        this.velocity = velocity;
    }
}

module.exports = {
    PlayerMovement,
};