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

    isMoving(deltaTime) {
        // const distance = this.position.distance(this.initialPosition);
        // console.log(
        //     "distance=" + distance +
        //     ", initialPosition=" + JSON.stringify(this.initialPosition) +
        //     ", position=" + JSON.stringify(this.position) +
        //     ", angle=" + this.angle +
        //     ", deltaTime=" + deltaTime
        // );
        return this.position.distance(this.initialPosition) <= this.maxDistance;
    }
}

module.exports = {
    Bullet,
};