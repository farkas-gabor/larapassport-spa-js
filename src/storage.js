import * as Cookies from 'es-cookie';

/**
 * A storage protocol for marshalling data to/from cookies
 */
export const CookieStorage = {
    get(key) {
        const value = Cookies.get(key);

        if (typeof value === 'undefined') {
            return null;
        }

        return JSON.parse(value);
    },

    save(key, value, options) {
        let cookieAttributes = {};

        if (window.location.protocol === 'https:') {
            cookieAttributes = {
                secure: true,
                sameSite: 'none'
            };
        }

        if (options?.daysUntilExpire) {
            cookieAttributes.expires = options.daysUntilExpire;
        }

        Cookies.set(key, JSON.stringify(value), cookieAttributes);
    },

    remove(key) {
        Cookies.remove(key);
    }
};

/**
 * A storage protocol for marshalling data to/from session storage
 */
export const SessionStorage = {
    get(key) {
        /* istanbul ignore next */
        if (typeof sessionStorage === 'undefined') {
            return null;
        }

        const value = sessionStorage.getItem(key);

        if (typeof value === 'undefined') {
            return null;
        }

        return JSON.parse(value);
    },

    save(key, value) {
        sessionStorage.setItem(key, JSON.stringify(value));
    },

    remove(key) {
        sessionStorage.removeItem(key);
    }
};
