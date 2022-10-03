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

    calculateNewBulletPosition(bullet) {
        var normX = Math.cos(bullet.angle * Math.PI / 180.0);
        var normY = -Math.sin(bullet.angle * Math.PI / 180.0);

        const leng = Math.sqrt((normX * normX) + (normY * normY));

        if (leng == 0.0) {
            normX = 0.0;
            normY = 0.0;
        } else {
            normX = normX / leng;
            normY = normY / leng;
        }

        var velX = normX * bullet.velocity;
        var velY = normY * bullet.velocity;

        bullet.position.x = bullet.position.x + velX;
        bullet.position.y = bullet.position.y + velY;
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