class PlayerShootingController {

    constructor(logger) {
        this.logger = logger;
    }

    calculateNewBulletPosition(bullet, deltaTime, tick, from) {
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

        var velX = normX * bullet.velocity * deltaTime;
        var velY = normY * bullet.velocity * deltaTime;

        const preX = bullet.position.x;
        const preY = bullet.position.y;

        bullet.position.x = bullet.position.x + velX;
        bullet.position.y = bullet.position.y + velY;

        this.logger(
            "\nTick " + tick +
            " From=" + from +
            " Bullet=" + bullet.id +
            // " Angle=" + bullet.angle +
            // " Velocity=" + bullet.velocity +
            " Pre X=" + preX +
            " Pre Y=" + preY +
            " New X=" + bullet.position.x +
            " New Y=" + bullet.position.y
        );
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