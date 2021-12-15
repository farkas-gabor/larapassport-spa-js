import {DEFAULT_NOW_PROVIDER} from '../constants';
import {CACHE_KEY_PREFIX, CacheKey} from './shared';

const DEFAULT_EXPIRY_ADJUSTMENT_SECONDS = 0;

export class CacheManager {
    constructor(cache, keyManifest, nowProvider) {
        this.cache = cache;
        this.keyManifest = keyManifest;
        this.nowProvider = nowProvider || DEFAULT_NOW_PROVIDER;
    }

    async get(
        cacheKey,
        expiryAdjustmentSeconds = DEFAULT_EXPIRY_ADJUSTMENT_SECONDS
    ) {
        let wrappedEntry = await this.cache.get(cacheKey.toKey());

        if (!wrappedEntry) {
            const keys = await this.getCacheKeys();

            if (!keys) return null;

            const matchedKey = this.matchExistingCacheKey(cacheKey, keys);
            wrappedEntry = await this.cache.get(matchedKey);
        }

        // If we still don't have an entry, exit.
        if (!wrappedEntry) {
            return null;
        }

        const now = await this.nowProvider();
        const nowSeconds = Math.floor(now / 1000);

        if (wrappedEntry.expiresAt - expiryAdjustmentSeconds < nowSeconds) {
            if (wrappedEntry.body.refresh_token) {
                wrappedEntry.body = {
                    refresh_token: wrappedEntry.body.refresh_token
                };

                await this.cache.set(cacheKey.toKey(), wrappedEntry);
                return wrappedEntry.body;
            }

            await this.cache.remove(cacheKey.toKey());
            await this.keyManifest?.remove(cacheKey.toKey());

            return null;
        }

        return wrappedEntry.body;
    }

    async set(entry) {
        const cacheKey = new CacheKey({
            client_id: entry.client_id,
            scope: entry.scope
        });

        const wrappedEntry = await this.wrapCacheEntry(entry);

        await this.cache.set(cacheKey.toKey(), wrappedEntry);
        await this.keyManifest?.add(cacheKey.toKey());
    }

    async clear(clientId) {
        const keys = await this.getCacheKeys();

        /* istanbul ignore next */
        if (!keys) return;

        await keys
            .filter(key => (clientId ? key.includes(clientId) : true))
            .reduce(async (memo, key) => {
                await memo;
                await this.cache.remove(key);
            }, Promise.resolve());

        await this.keyManifest?.clear();
    }

    /**
     * Note: only call this if you're sure one of our internal (synchronous) caches are being used.
     */
    clearSync(clientId) {
        const keys = this.cache.allKeys();

        /* istanbul ignore next */
        if (!keys) return;

        keys.filter(key => (clientId ? key.includes(clientId) : true)).forEach(
            key => {
                this.cache.remove(key);
            }
        );
    }

    async wrapCacheEntry(entry) {
        const now = await this.nowProvider();
        const expiresInTime = Math.floor(now / 1000) + entry.expires_in;

        const expirySeconds = Math.min(
            expiresInTime,
            entry.decodedToken.claims.exp
        );

        return {
            body: entry,
            expiresAt: expirySeconds
        };
    }

    async getCacheKeys() {
        // eslint-disable-next-line sonarjs/prefer-immediate-return
        const result = this.keyManifest
            ? (await this.keyManifest.get())?.keys
            : await this.cache.allKeys();

        return result;
    }

    /**
     * Finds the corresponding key in the cache based on the provided cache key.
     * The keys inside the cache are in the format {prefix}::{client_id}::{audience}::{scope}.
     * The first key in the cache that satisfies the following conditions is returned
     *  - `prefix` is strict equal to Auth0's internally configured `keyPrefix`
     *  - `client_id` is strict equal to the `cacheKey.client_id`
     *  - `audience` is strict equal to the `cacheKey.audience`
     *  - `scope` contains at least all the `cacheKey.scope` values
     *  *
     * @param keyToMatch The provided cache key
     * @param allKeys A list of existing cache keys
     */
    matchExistingCacheKey(keyToMatch, allKeys) {
        return allKeys.filter(key => {
            const cacheKey = CacheKey.fromKey(key);
            const scopeSet = new Set(
                cacheKey.scope && cacheKey.scope.split(' ')
            );
            const scopesToMatch = keyToMatch.scope.split(' ');

            const hasAllScopes =
                cacheKey.scope &&
                scopesToMatch.reduce(
                    (acc, current) => acc && scopeSet.has(current),
                    true
                );

            return (
                cacheKey.prefix === CACHE_KEY_PREFIX &&
                cacheKey.client_id === keyToMatch.client_id &&
                hasAllScopes
            );
        })[0];
    }
}
