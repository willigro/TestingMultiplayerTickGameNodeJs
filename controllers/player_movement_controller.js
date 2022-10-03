const { PlayerAimRequest } = require('../entity/player_aim_request.js');
const { PlayerAim } = require('../entity/player_aim.js');
const { PlayerMovementRequest } = require('../entity/player_movement_request.js');
const { PlayerMovement } = require('../entity/player_movement.js');
const { PlayerMovementAndAimResponse } = require('../entity/player_movement_and_aim_response.js');
const { Player } = require('../entity/player.js');
const { Position } = require('../entity/position.js');

class PlayerMovementController {

    onPlayerMoved(socket, payload) {
        const data = JSON.parse(payload);

        /*
        Data from the request
        */
        const playerMovementRequest = new PlayerMovementRequest(
            data.playerMovement.angle,
            data.playerMovement.strength,
            data.playerMovement.x,
            data.playerMovement.y,
            data.playerMovement.velocity,
        );

        const playerAimRequest = new PlayerAimRequest(
            data.playerAim.angle,
            data.playerAim.strength,
        );

        // New position
        const newPosition = this.calculateNewPosition(
            playerMovementRequest.angle,
            playerMovementRequest.strength,
            playerMovementRequest.x,
            playerMovementRequest.y,
            playerMovementRequest.velocity,
        );

        this.updatePlayerMovementAndAimValues(
            socket.id,
            playerMovementRequest,
            playerAimRequest,
        );

        /*
        Response
        */
        const playerMovement = new PlayerMovement(
            playerMovementRequest.angle,
            playerMovementRequest.strength,
            playerMovementRequest.x,
            playerMovementRequest.y,
            newPosition,
            playerMovementRequest.velocity,
        );

        const playerAim = new PlayerAim(
            playerAimRequest.angle,
            playerAimRequest.strength,
        )

        const playerMovementAndAimResponse = new PlayerMovementAndAimResponse(
            socket.id,
            playerMovement,
            playerAim,
        )

        return playerMovementAndAimResponse
    }

    updatePlayerMovementAndAimValues(id, playerMovement, playerAim, players) {
        const player = players.find(data => data.id == id);
        if (player) {
            player.position.x = playerMovement.x
            player.position.y = playerMovement.y
        }
    }

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