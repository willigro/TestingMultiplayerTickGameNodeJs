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

    distance(positionTo) {
        return Math.sqrt(
            Math.pow(positionTo.x - this.x, 2) + Math.pow(positionTo.y - this.y, 2)
        )
    }

    multiple(value) {
        this.x *= value;
        this.y *= value;
    }
}

module.exports = {
    Position,
};