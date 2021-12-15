import {CACHE_KEY_PREFIX} from './shared';

export class CacheKeyManifest {
    constructor(cache, clientId) {
        this.cache = cache;
        this.clientId = clientId;

        this.manifestKey = this.createManifestKeyFrom(this.clientId);
    }

    async add(key) {
        const keys = new Set(
            (await this.cache.get(this.manifestKey))?.keys || []
        );

        keys.add(key);

        await this.cache.set(this.manifestKey, {
            keys: [...keys]
        });
    }

    async remove(key) {
        const entry = await this.cache.get(this.manifestKey);

        if (entry) {
            const keys = new Set(entry.keys);
            keys.delete(key);

            if (keys.size > 0) {
                // eslint-disable-next-line sonarjs/prefer-immediate-return
                const result = await this.cache.set(this.manifestKey, {
                    keys: [...keys]
                });
                return result;
            }

            // eslint-disable-next-line sonarjs/prefer-immediate-return
            const result = await this.cache.remove(this.manifestKey);
            return result;
        }

        return null;
    }

    get() {
        return this.cache.get(this.manifestKey);
    }

    clear() {
        return this.cache.remove(this.manifestKey);
    }

    createManifestKeyFrom(clientId) {
        return `${CACHE_KEY_PREFIX}::${clientId}`;
    }
}
