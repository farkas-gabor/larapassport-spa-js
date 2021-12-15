/* eslint-disable no-param-reassign */
/* eslint-disable sonarjs/no-duplicate-string */
import Lock from 'browser-tabs-lock';

import {oauthToken} from './api';
import {
    CacheKey,
    CacheManager,
    InMemoryCache,
    LocalStorageCache
} from './cache';
import {CacheKeyManifest} from './cache/key-manifest';
import {
    CACHE_LOCATION_MEMORY,
    DEFAULT_NOW_PROVIDER,
    DEFAULT_SCOPE,
    DEFAULT_SESSION_CHECK_EXPIRY_DAYS,
    GET_TOKEN_SILENTLY_LOCK_KEY,
    INVALID_REFRESH_TOKEN_ERROR_MESSAGE,
    MISSING_REFRESH_TOKEN_ERROR_MESSAGE,
    RECOVERABLE_ERRORS
} from './constants';
import {AuthenticationError, GenericError, TimeoutError} from './errors';
import {verify as verifyIdToken} from './jwt';
import {retryPromise, singlePromise} from './promise-utils';
import {getUniqueScopes} from './scope';
import {CookieStorage, SessionStorage} from './storage';
import TransactionManager from './transaction-manager';
import {
    bufferToBase64UrlEncoded,
    createQueryParams,
    createRandomString,
    encode,
    parseQueryResult,
    runIframe,
    sha256,
    validateCrypto
} from './utils';

const lock = new Lock();

const buildIsAuthenticatedCookieName = clientId =>
    `laravelPassport.${clientId}.is.authenticated`;

const cacheLocationBuilders = {
    memory: () => new InMemoryCache(),
    localstorage: () => new LocalStorageCache()
};

const cacheFactory = location => {
    return cacheLocationBuilders[location];
};

const getTokenIssuer = (issuer, domainUrl) => {
    if (issuer) {
        return issuer.startsWith('https://') ? issuer : `https://${issuer}/`;
    }

    return `${domainUrl}/`;
};

const getDomain = domainUrl => {
    if (!/^https?:\/\//.test(domainUrl)) {
        return `https://${domainUrl}`;
    }

    return domainUrl;
};

const getCustomInitialOptions = options => {
    const {
        advancedOptions,
        auth0Client,
        authorizeTimeoutInSeconds,
        cacheLocation,
        client_id,
        domain,
        issuer,
        leeway,
        max_age,
        redirect_uri,
        scope,
        useRefreshTokens,
        useCookiesForTransactions,
        useFormData,
        ...customParams
    } = options;
    return customParams;
};

export default class AuthClient {
    constructor(options) {
        if (typeof window !== 'undefined') {
            validateCrypto();
        }

        this.options = options;

        if (options.cache && options.cacheLocation) {
            console.warn(
                'Both `cache` and `cacheLocation` options have been specified in the LaravelPassportClient configuration; ignoring `cacheLocation` and using `cache`.'
            );
        }

        let cache;

        if (options.cache) {
            cache = options.cache;
        } else {
            this.cacheLocation = options.cacheLocation || CACHE_LOCATION_MEMORY;

            if (!cacheFactory(this.cacheLocation)) {
                throw new Error(
                    `Invalid cache location "${this.cacheLocation}"`
                );
            }

            cache = cacheFactory(this.cacheLocation)();
        }

        this.cookieStorage = CookieStorage;

        this.isAuthenticatedCookieName = buildIsAuthenticatedCookieName(
            this.options.client_id
        );

        this.sessionCheckExpiryDays =
            options.sessionCheckExpiryDays || DEFAULT_SESSION_CHECK_EXPIRY_DAYS;

        const transactionStorage = options.useCookiesForTransactions
            ? this.cookieStorage
            : SessionStorage;

        this.scope = this.options.scope;

        this.transactionManager = new TransactionManager(
            transactionStorage,
            this.options.client_id
        );

        this.nowProvider = this.options.nowProvider || DEFAULT_NOW_PROVIDER;

        this.cacheManager = new CacheManager(
            cache,
            !cache.allKeys
                ? new CacheKeyManifest(cache, this.options.client_id)
                : null,
            this.nowProvider
        );

        this.domainUrl = getDomain(this.options.domain);
        this.tokenIssuer = getTokenIssuer(this.options.issuer, this.domainUrl);

        this.defaultScope = getUniqueScopes(
            '',
            this.options?.advancedOptions?.defaultScope !== undefined
                ? this.options.advancedOptions.defaultScope
                : DEFAULT_SCOPE
        );

        this.customOptions = getCustomInitialOptions(options);
    }

    _url(path) {
        return `${this.domainUrl}${path}`;
    }

    _getParams(authorizeOptions, state, nonce, code_challenge, redirect_uri) {
        // These options should be excluded from the authorize URL,
        // as they're options for the client and not for the IdP.
        // ** IMPORTANT ** If adding a new client option, include it in this destructure list.
        const {
            useRefreshTokens,
            useCookiesForTransactions,
            useFormData,
            auth0Client,
            cacheLocation,
            advancedOptions,
            nowProvider,
            authorizeTimeoutInSeconds,
            sessionCheckExpiryDays,
            domain,
            leeway,
            ...loginOptions
        } = this.options;

        return {
            ...loginOptions,
            ...authorizeOptions,
            scope: getUniqueScopes(
                this.defaultScope,
                this.scope,
                authorizeOptions.scope
            ),
            response_type: 'code',
            response_mode: 'query',
            state,
            nonce,
            redirect_uri: redirect_uri || this.options.redirect_uri,
            code_challenge,
            code_challenge_method: 'S256'
        };
    }

    _authorizeUrl(authorizeOptions) {
        return this._url(
            `/oauth/authorize?${createQueryParams(authorizeOptions)}`
        );
    }

    _parseNumber(value) {
        if (typeof value !== 'string') {
            return value;
        }
        return parseInt(value, 10) || undefined;
    }

    async _verifyIdToken(id_token) {
        const now = await this.nowProvider();

        return verifyIdToken({
            iss: this.tokenIssuer,
            aud: this.options.client_id,
            id_token,
            leeway: this.options.leeway,
            max_age: this._parseNumber(this.options.max_age),
            now
        });
    }

    async buildAuthorizeUrl(options = {}) {
        const {redirect_uri, appState, ...authorizeOptions} = options;

        const stateIn = encode(createRandomString());
        const nonceIn = encode(createRandomString());
        const code_verifier = createRandomString();
        const code_challengeBuffer = await sha256(code_verifier);
        const code_challenge = bufferToBase64UrlEncoded(code_challengeBuffer);
        const fragment = options.fragment ? `#${options.fragment}` : '';

        const params = this._getParams(
            authorizeOptions,
            stateIn,
            nonceIn,
            code_challenge,
            redirect_uri
        );

        const url = this._authorizeUrl(params);

        this.transactionManager.create({
            nonce: nonceIn,
            code_verifier,
            appState,
            scope: params.scope,
            redirect_uri: params.redirect_uri,
            state: stateIn
        });

        return url + fragment;
    }

    async getUser(options = {}) {
        const scope = getUniqueScopes(
            this.defaultScope,
            this.scope,
            options.scope
        );

        const cache = await this.cacheManager.get(
            new CacheKey({
                client_id: this.options.client_id,
                scope
            })
        );

        return cache && cache.decodedToken && cache.decodedToken.user;
    }

    async loginWithRedirect(options = {}) {
        const {redirectMethod, ...urlOptions} = options;
        const url = await this.buildAuthorizeUrl(urlOptions);

        window.location[redirectMethod || 'assign'](url);
    }

    async handleRedirectCallback(url = window.location.href) {
        const queryStringFragments = url.split('?').slice(1);

        if (queryStringFragments.length === 0) {
            throw new Error('There are no query params available for parsing.');
        }

        const {state, code, error, error_description} = parseQueryResult(
            queryStringFragments.join('')
        );

        const transaction = this.transactionManager.get();

        if (!transaction) {
            throw new Error('Invalid state');
        }

        this.transactionManager.remove();

        if (error) {
            throw new AuthenticationError(
                error,
                error_description,
                state,
                transaction.appState
            );
        }

        // Transaction should have a `code_verifier` to do PKCE for CSRF protection
        if (
            !transaction.code_verifier ||
            (transaction.state && transaction.state !== state)
        ) {
            throw new Error('Invalid state');
        }

        const tokenOptions = {
            scope: transaction.scope,
            baseUrl: this.domainUrl,
            client_id: this.options.client_id,
            code_verifier: transaction.code_verifier,
            grant_type: 'authorization_code',
            code,
            useFormData: this.options.useFormData
        };
        // some old versions of the SDK might not have added redirect_uri to the
        // transaction, we dont want the key to be set to undefined.
        if (undefined !== transaction.redirect_uri) {
            tokenOptions.redirect_uri = transaction.redirect_uri;
        }

        const authResult = await oauthToken(tokenOptions);
        const decodedToken = await this._verifyIdToken(authResult.access_token);

        await this.cacheManager.set({
            ...authResult,
            decodedToken,
            scope: transaction.scope,
            ...(authResult.scope ? {oauthTokenScope: authResult.scope} : null),
            client_id: this.options.client_id
        });

        this.cookieStorage.save(this.isAuthenticatedCookieName, true, {
            daysUntilExpire: this.sessionCheckExpiryDays
        });

        return {
            appState: transaction.appState
        };
    }

    async checkSession(options) {
        try {
            await this.getTokenSilently(options);
        } catch (error) {
            if (!RECOVERABLE_ERRORS.includes(error.error)) {
                throw error;
            }
        }
    }

    async getTokenSilently(options = {}) {
        const {ignoreCache, ...getTokenOptions} = {
            ignoreCache: false,
            ...options,
            scope: getUniqueScopes(
                this.defaultScope,
                this.scope,
                options?.scope
            )
        };

        return singlePromise(
            () =>
                this._getTokenSilently({
                    ignoreCache,
                    ...getTokenOptions
                }),
            `${this.options.client_id}::${getTokenOptions.scope}`
        );
    }

    async _getTokenSilently(options = {}) {
        const {ignoreCache, ...getTokenOptions} = options;

        // Check the cache before acquiring the lock to avoid the latency of
        // `lock.acquireLock` when the cache is populated.
        if (!ignoreCache) {
            const entry = await this._getEntryFromCache({
                scope: getTokenOptions.scope,
                client_id: this.options.client_id
            });

            if (entry) {
                return entry;
            }
        }

        if (
            await retryPromise(
                () => lock.acquireLock(GET_TOKEN_SILENTLY_LOCK_KEY, 5000),
                10
            )
        ) {
            try {
                // Check the cache a second time, because it may have been populated
                // by a previous call while this call was waiting to acquire the lock.
                if (!ignoreCache) {
                    const entry = await this._getEntryFromCache({
                        scope: getTokenOptions.scope,
                        client_id: this.options.client_id
                    });

                    if (entry) {
                        return entry;
                    }
                }

                const authResult = this.options.useRefreshTokens
                    ? await this._getTokenUsingRefreshToken(getTokenOptions)
                    : await this._getTokenFromIFrame(getTokenOptions);

                await this.cacheManager.set({
                    client_id: this.options.client_id,
                    ...authResult
                });

                this.cookieStorage.save(this.isAuthenticatedCookieName, true, {
                    daysUntilExpire: this.sessionCheckExpiryDays
                });

                const {
                    id_token,
                    refresh_token,
                    access_token,
                    scope,
                    expires_in
                } = authResult;

                return {
                    access_token,
                    refresh_token,
                    expires_in,
                    id_token,
                    ...(scope ? {scope} : null)
                };
            } finally {
                await lock.releaseLock(GET_TOKEN_SILENTLY_LOCK_KEY);
            }
        } else {
            throw new TimeoutError();
        }
    }

    async isAuthenticated() {
        const user = await this.getUser();
        return !!user;
    }

    buildLogoutUrl(options = {}) {
        let params = {};

        if (options.allDevices) {
            params = {allDevices: true};
        }

        return this._url(`/api/logout?${createQueryParams(params)}`);
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    async logout(options = {}) {
        const {localOnly, ...logoutOptions} = options;

        if (localOnly && logoutOptions.allDevices) {
            throw new Error(
                'It is invalid to set both the `allDevices` and `localOnly` options to `true`'
            );
        }

        // eslint-disable-next-line consistent-return
        const postCacheClear = async accessToken => {
            this.cookieStorage.remove(this.isAuthenticatedCookieName);

            if (localOnly) {
                return true;
            }

            const url = this.buildLogoutUrl(logoutOptions);

            try {
                const result = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        Authorization: `Bearer ${accessToken}`
                    }
                });

                if (result.status === 200) {
                    const param = options.returnTo
                        ? `?${createQueryParams({returnTo: options.returnTo})}`
                        : null;
                    window.location.assign(`${this.domainUrl}/logout${param}`);
                }
            } catch (error) {
                // console.log(error);
            }
        };

        const cache = await this.cacheManager.get(
            new CacheKey({
                scope: options.scope || this.defaultScope,
                client_id: this.options.client_id
            })
        );

        if (this.options.cache) {
            return this.cacheManager
                .clear()
                .then(() => postCacheClear(cache.access_token));
        }

        this.cacheManager.clearSync();

        await postCacheClear(cache?.access_token);

        return true;
    }

    async _getTokenFromIFrame(options) {
        const stateIn = encode(createRandomString());
        const code_verifier = createRandomString();
        const code_challengeBuffer = await sha256(code_verifier);
        const code_challenge = bufferToBase64UrlEncoded(code_challengeBuffer);

        const params = {
            client_id: this.options.client_id,
            redirect_uri: this.options.redirect_uri,
            response_type: 'code',
            scope: this.options.scope,
            state: stateIn,
            code_challenge,
            code_challenge_method: 'S256'
        };

        const url = this._authorizeUrl(params);

        const timeout =
            options?.timeoutInSeconds || this.options.authorizeTimeoutInSeconds;

        let codeResult = null;
        let codeResultParsed = null;

        try {
            // When a browser is running in a Cross-Origin Isolated context, using iframes is not possible.
            // It doesn't throw an error but times out instead, so we should exit early and inform the user about the reason.
            // https://developer.mozilla.org/en-US/docs/Web/API/crossOriginIsolated
            if (window.crossOriginIsolated) {
                throw new GenericError(
                    'login_required',
                    'The application is running in a Cross-Origin Isolated context, silently retrieving a token without refresh token is not possible.'
                );
            }

            codeResult = await runIframe(url, this.domainUrl, timeout);

            codeResultParsed = JSON.parse(
                `{"${codeResult
                    .replace(/^\?/g, '')
                    .replace(/&/g, '","')
                    .replace(/=/g, '":"')}"}`,
                function (key, value) {
                    return key === '' ? value : decodeURIComponent(value);
                }
            );

            if (stateIn !== codeResultParsed.state) {
                throw new Error('Invalid state');
            }

            const {scope, redirect_uri, timeoutInSeconds, ...customOptions} =
                options;

            const tokenResult = await oauthToken({
                ...this.customOptions,
                ...customOptions,
                scope,
                baseUrl: this.domainUrl,
                client_id: this.options.client_id,
                code_verifier,
                code: codeResultParsed.code,
                grant_type: 'authorization_code',
                redirect_uri: params.redirect_uri,
                timeout
            });

            const decodedToken = await this._verifyIdToken(
                tokenResult.access_token
            );

            return {
                ...tokenResult,
                decodedToken,
                scope: params?.scope ? params.scope : this.defaultScope,
                oauthTokenScope: tokenResult.scope
            };
        } catch (e) {
            if (e.error === 'login_required') {
                this.logout({
                    localOnly: true
                });
            }
            throw e;
        }
    }

    async _getTokenUsingRefreshToken(options) {
        options.scope = getUniqueScopes(
            this.defaultScope,
            this.options.scope,
            options.scope
        );

        const cache = await this.cacheManager.get(
            new CacheKey({
                scope: options.scope,
                client_id: this.options.client_id
            })
        );

        // If you don't have a refresh token in memory
        // and you don't have a refresh token in web worker memory
        // fallback to an iframe.
        if ((!cache || !cache.refresh_token) && !this.worker) {
            // eslint-disable-next-line sonarjs/prefer-immediate-return
            const result = await this._getTokenFromIFrame(options);
            return result;
        }

        const redirect_uri =
            options.redirect_uri ||
            this.options.redirect_uri ||
            window.location.origin;

        let tokenResult;

        const {scope, ignoreCache, timeoutInSeconds, ...customOptions} =
            options;

        const timeout =
            typeof options.timeoutInSeconds === 'number'
                ? options.timeoutInSeconds * 1000
                : null;

        try {
            tokenResult = await oauthToken({
                ...this.customOptions,
                ...customOptions,
                scope,
                baseUrl: this.domainUrl,
                client_id: this.options.client_id,
                grant_type: 'refresh_token',
                refresh_token: cache && cache.refresh_token,
                redirect_uri,
                ...(timeout && {timeout}),
                useFormData: this.options.useFormData
            });
        } catch (e) {
            if (
                // The web worker didn't have a refresh token in memory so
                // fallback to an iframe.
                e.message === MISSING_REFRESH_TOKEN_ERROR_MESSAGE ||
                // A refresh token was found, but is it no longer valid.
                // Fallback to an iframe.
                (e.message &&
                    e.message.indexOf(INVALID_REFRESH_TOKEN_ERROR_MESSAGE) > -1)
            ) {
                // eslint-disable-next-line sonarjs/prefer-immediate-return
                const result = await this._getTokenFromIFrame(options);
                return result;
            }

            throw e;
        }

        const decodedToken = await this._verifyIdToken(
            tokenResult.access_token
        );

        return {
            ...tokenResult,
            decodedToken,
            scope: options.scope,
            oauthTokenScope: tokenResult.scope
        };
    }

    async _getEntryFromCache({scope, client_id}) {
        const entry = await this.cacheManager.get(
            new CacheKey({
                scope,
                client_id
            }),
            60 // get a new token if within 60 seconds of expiring
        );

        if (entry && entry.access_token) {
            const {
                id_token,
                refresh_token,
                access_token,
                scope: oauthTokenScope,
                expires_in
            } = entry;

            return {
                access_token,
                refresh_token,
                expires_in,
                id_token,
                ...(oauthTokenScope ? {scope: oauthTokenScope} : null)
            };
        }

        return null;
    }
}
