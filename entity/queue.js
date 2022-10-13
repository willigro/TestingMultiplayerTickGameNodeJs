class Queue {
    constructor(maxSize) {
        this.elements = {};
        this.head = 0;
        this.tail = 0;
        this.maxSize = maxSize;
    }
    first() {
        return this.elements[this.head];
    }
    enqueue(element) {
        if (this.maxSize) {
            if (this.length >= this.maxSize) {
                // Remove the first item in order of create a new space for the new item
                this.dequeue();
            }
        }

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