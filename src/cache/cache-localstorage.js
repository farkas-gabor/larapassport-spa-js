import {CACHE_KEY_PREFIX} from './shared';

export class LocalStorageCache {
    set(key, entry) {
        localStorage.setItem(key, JSON.stringify(entry));
    }

    get(key) {
        const json = window.localStorage.getItem(key);

        if (!json) return null;

        try {
            return JSON.parse(json);
        } catch (e) {
            /* istanbul ignore next */
        }

        return null;
    }

    remove(key) {
        localStorage.removeItem(key);
    }

    allKeys() {
        return Object.keys(window.localStorage).filter(key =>
            key.startsWith(CACHE_KEY_PREFIX)
        );
    }
}
