class Queue {
    constructor() {
        this.elements = {};
        this.head = 0;
        this.tail = 0;
    }
    first() {
        return this.elements[this.head];
    }
    enqueue(element) {
        this.elements[this.tail] = element;
        this.tail++;
    }
    dequeue() {
        const item = this.elements[this.head];
        delete this.elements[this.head];
        this.head++;
        return item;
    }
    clear() {
        this.elements = {};
        this.head = 0;
        this.tail = 0;
    }
    peek() {
        return this.elements[this.head];
    }
    toList() {
        const arr = []
        for (var i = this.head; i < this.tail; i++) {
            arr.push(this.elements[i]);
        }
        return arr
    }
    get length() {
        return this.tail - this.head;
    }
    get isEmpty() {
        return this.length === 0;
    }
}

module.exports = {
    Queue,
};