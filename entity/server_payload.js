class ServerPayload {
    constructor(tick, payload) {
        this.tick = tick;
        this.payload = payload;
    }
}

module.exports = {
    ServerPayload,
};