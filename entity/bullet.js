const { Position } = require('./position.js');

class Bullet {
    constructor(id, owner, position, angle, velocity, maxDistance) {
        this.id = id;
        this.owner = owner;
        this.position = position;
        this.initialPosition = new Position(position.x, position.y);
        this.angle = angle;
        this.velocity = velocity;
        this.maxDistance = maxDistance;
    }

    isMoving() {
        return this.position.distance(this.initialPosition) <= this.maxDistance;
    }
}

module.exports = {
    Bullet,
};