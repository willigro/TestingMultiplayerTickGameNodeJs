class Position {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    normalize() {
        const len = this.length();

        if (len == 0.0) {
            this.x = 0.0;
            this.y = 0.0;
        } else {
            this.x = this.x / len;
            this.y = this.y / len;
        }
    }
}

module.exports = {
    Position,
};