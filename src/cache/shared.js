export const CACHE_KEY_PREFIX = '@@laravelpassportspajs@@';

export class CacheKey {
    constructor(data, prefix = CACHE_KEY_PREFIX) {
        this.client_id = data.client_id;
        this.scope = data.scope;
        this.audience = data.audience;

        this.prefix = prefix;
    }

    /**
     * Converts this `CacheKey` instance into a string for use in a cache
     * @returns A string representation of the key
     */
    toKey() {
        return `${this.prefix}::${this.client_id}::${this.scope}`;
    }

    /**
     * Converts a cache key string into a `CacheKey` instance.
     * @param key The key to convert
     * @returns An instance of `CacheKey`
     */
    static fromKey(key) {
        const [prefix, client_id, scope] = key.split('::');

        return new CacheKey({client_id, scope}, prefix);
    }

    /**
     * Utility function to build a `CacheKey` instance from a cache entry
     * @param entry The entry
     * @returns An instance of `CacheKey`
     */
    static fromCacheEntry(entry) {
        const {scope, client_id} = entry;

        return new CacheKey({
            scope,
            client_id
        });
    }
}
