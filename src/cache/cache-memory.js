export class InMemoryCache {
    constructor() {
        this.cache = {};
    }

    set(key, entry) {
        this.cache[key] = entry;
    }

    get(key) {
        const cacheEntry = this.cache[key];

        if (!cacheEntry) {
            return null;
        }

        return cacheEntry;
    }

    remove(key) {
        delete this.cache[key];
    }

    allKeys() {
        return Object.keys(this.cache);
    }
}
