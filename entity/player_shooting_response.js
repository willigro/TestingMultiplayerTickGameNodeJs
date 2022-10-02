class PlayerShootingResponse {
    constructor(playerId, angle, position, velocity) {
        this.id = playerId;
        this.angle = angle;
        this.position = position;
        this.velocity = velocity;
    }
}

module.exports = {
    PlayerShootingResponse,
};