const { Position } = require('../entity/position.js');

class PlayerMovementController {

    calculateNewPosition(deltaTime, angle, strength, x, y, velocity) {
        var cos = Math.cos(angle * Math.PI / 180.0) * strength
        var sin = -Math.sin(angle * Math.PI / 180.0) * strength

        const position = new Position(
            cos, sin
        )

        position.normalize()

        const newX = x + (position.x * velocity) * deltaTime;
        const newY = y + (position.y * velocity) * deltaTime;

        console.log(
            "Normalized " + JSON.stringify(position) +
            " Delta " + deltaTime +
            " Cos " + cos +
            " Sin " + sin +
            " Angle " + angle +
            " Strength " + strength +
            " Velocity " + velocity +
            " New X " + newX
        );

        return new Position(newX, newY);
    }
}

module.exports = {
    PlayerMovementController,
};