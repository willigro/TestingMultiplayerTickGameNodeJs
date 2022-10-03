const { PlayerShootingRequest } = require('../entity/player_shooting_request.js');
const { PlayerShootingResponse } = require('../entity/player_shooting_response.js');
const { Position } = require('../entity/position.js');

class PlayerShootingController {

    playerShooting(payload) {
        const data = JSON.parse(payload);

        const playerShootingRequest = new PlayerShootingRequest(
            data.id,
            data.angle,
            data.bullet_position,
            data.velocity,
        );

        /*
        Think about continue to calculate it (doens't seem the best approach), or this value at this way
        the problem is that if there is a delay the bullet will be show too wrong
        */
        const position = this.calculatePosition(playerShootingRequest);

        console.log(JSON.stringify(position));

        console.log(JSON.stringify(playerShootingRequest));

        const playerShootingRespose = new PlayerShootingResponse(
            playerShootingRequest.id,
            playerShootingRequest.angle,
            position,
            playerShootingRequest.velocity,
        );

        return playerShootingRespose;
    }

    calculatePosition(playerShootingRequest) {
        var normX = Math.cos(playerShootingRequest.angle * Math.PI / 180.0);
        var normY = -Math.sin(playerShootingRequest.angle * Math.PI / 180.0);

        const leng = Math.sqrt((normX * normX) + (normY * normY));

        if (leng == 0.0) {
            normX = 0.0;
            normY = 0.0;
        } else {
            normX = normX / leng;
            normY = normY / leng;
        }

        // console.log("normalized x=" + normX + " y=" + normY + " angle=" + playerShootingRequest.angle, " velocity=" + playerShootingRequest.velocity + " leng=" + leng);

        var velX = normX * playerShootingRequest.velocity;
        var velY = normY * playerShootingRequest.velocity;

        const x = playerShootingRequest.position.x + velX;
        const y = playerShootingRequest.position.y + velY;

        return new Position(x, y);
    }
}


module.exports = {
    PlayerShootingController,
};

function intersectRect(r1, r2) {
    return !(r2.left > r1.right ||
        r2.right < r1.left ||
        r2.top > r1.bottom ||
        r2.bottom < r1.top);
}