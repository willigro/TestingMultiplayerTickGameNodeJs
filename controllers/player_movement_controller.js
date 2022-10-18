const { Position } = require('../entity/position.js');

class PlayerMovementController {

    constructor(logger) {
        this.logger = logger;
    }

    calculateNewPosition(player, from, tick, deltaTime, angle, strength, x, y, velocity) {
        const preX = x;
        const preY = y;
        var cos = Math.cos(angle * Math.PI / 180.0) * strength
        var sin = -Math.sin(angle * Math.PI / 180.0) * strength

        const position = new Position(
            cos, sin
        )

        position.normalize()

        const newX = x + (position.x * velocity) * deltaTime;
        const newY = y + (position.y * velocity) * deltaTime;

        this.logger(
            "\nTick " + tick +
            " From=" + from +
            " Player=" + player +
            " Normalized=" + JSON.stringify(position) +
            " Delta=" + deltaTime +
            " Cos=" + cos +
            " Sin=" + sin +
            " Angle=" + angle +
            " Strength=" + strength +
            " Velocity=" + velocity +
            " Pre X=" + preX +
            " Pre Y=" + preY +
            " New X=" + newX +
            " New Y=" + newY
        );

        return new Position(newX, newY);
    }
}

module.exports = {
    PlayerMovementController,
};