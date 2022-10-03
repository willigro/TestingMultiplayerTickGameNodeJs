class PlayerShootingController {

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