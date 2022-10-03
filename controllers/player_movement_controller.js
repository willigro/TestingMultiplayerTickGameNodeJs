const { Position } = require('../entity/position.js');

class PlayerMovementController {

    calculateNewPosition(angle, strength, x, y, velocity) {
        var newX = Math.cos(angle * Math.PI / 180.0) * strength
        var newY = -Math.sin(angle * Math.PI / 180.0) * strength

        const position = new Position(
            newX, newY
        )

        position.normalize()

        newX = position.x * velocity + x;
        newY = position.y * velocity + y;

        return new Position(newX, newY);
    }
}

module.exports = {
    PlayerMovementController,
};