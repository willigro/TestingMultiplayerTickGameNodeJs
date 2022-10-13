class HashMapList {
    constructor(maxSize) {
        this.map = new Map();
        this.keys = [];
        this.maxSize = maxSize;
    }

    get(key) {
        return this.map.get(key);
    }

    put(key, value) {
        if (this.maxSize && this.keys.length >= this.maxSize) {
            const firstKey = this.keys[0];
            this.delete(firstKey);
        }
        var a = this.map.get(key);
        if (a) {
            a.push(value);
        } else {
            this.map.set(key, [value]);
            this.keys.push(key);
        }

        // this.print();
    }

    print() {
        for (let key in this.keys) {
            console.log("key=" + this.keys[key] + " value=" + JSON.stringify(this.map.get(this.keys[key])));
        }
    }

    isNotEmpty() {
        return this.map.size > 0;
    }

    delete(key) {
        this.map.delete(key);

        const index = this.keys.findIndex(keys => keys == key);

        console.log("Delete key=" + key + " at index=" + index + " current keys=" + this.keys);

        if (index > -1) {
            this.keys.splice(index, 1);
        }
        console.log("After delete, keys=" + this.keys);
    }

    clear() {
        this.keys = [];
        this.map.clear();
    }

    mapToResponse() {
        // const json = {}
        // for (let key in this.keys) {
        //     var arr = json[this.keys[key]];
        //     const values = this.map.get(this.keys[key]);
        //     if (!arr) {
        //         arr = []
        //     }
        //     for (let i in values) {
        //         arr.push(values[i]);
        //     }
        //     json[this.keys[key]] = arr;
        // }
        // console.log(json);
        return Object.fromEntries(this.map);
    }
}

module.exports = {
    HashMapList,
};