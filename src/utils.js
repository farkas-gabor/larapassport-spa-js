import {
    CLEANUP_IFRAME_TIMEOUT_IN_SECONDS,
    DEFAULT_AUTHORIZE_TIMEOUT_IN_SECONDS
} from './constants';
import {GenericError, TimeoutError} from './errors';

export const runIframe = (
    authorizeUrl,
    eventOrigin,
    timeoutInSeconds = DEFAULT_AUTHORIZE_TIMEOUT_IN_SECONDS
) => {
    return new Promise((res, rej) => {
        const iframe = window.document.createElement('iframe');

        iframe.setAttribute('width', '0');
        iframe.setAttribute('height', '0');
        iframe.style.display = 'none';

        const removeIframe = () => {
            if (window.document.body.contains(iframe)) {
                window.document.body.removeChild(iframe);
                // window.removeEventListener(
                //     'message',
                //     iframeEventHandler,
                //     false
                // );
            }
        };

        // let iframeEventHandler;

        const timeoutSetTimeoutId = setTimeout(() => {
            rej(new TimeoutError());
            removeIframe();
        }, timeoutInSeconds * 1000);

        // // eslint-disable-next-line consistent-return
        // const iframeEventHandler = function (e) {
        //     if (e.origin !== eventOrigin) return false;

        //     if (!e.data || e.data.type !== 'authorization_response') return;

        //     const eventSource = e.source;

        //     if (eventSource) {
        //         eventSource.close();
        //     }

        //     e.data.response.error
        //         ? rej(GenericError.fromPayload(e.data.response))
        //         : res(e.data.response);

        //     clearTimeout(timeoutSetTimeoutId);
        //     window.removeEventListener('message', iframeEventHandler, false);

        //     // Delay the removal of the iframe to prevent hanging loading status
        //     // in Chrome: https://github.com/auth0/auth0-spa-js/issues/240
        //     setTimeout(removeIframe, CLEANUP_IFRAME_TIMEOUT_IN_SECONDS * 1000);
        // };

        // eslint-disable-next-line no-unused-vars
        const iframeLoadedHandler = () => {
            if (window.document.body.contains(iframe)) {
                let search = '';

                try {
                    search = iframe.contentWindow
                        ? iframe.contentWindow.location.search
                        : '';
                } catch {
                    // iframe cannot be accessed
                }

                if (search === '') {
                    rej(new GenericError('login_required'));
                }

                res(search.substr(1));

                // remove iframe and resolve
                clearTimeout(timeoutSetTimeoutId);

                // Delay the removal of the iframe to prevent hanging loading status
                // in Chrome: https://github.com/auth0/auth0-spa-js/issues/240
                setTimeout(
                    removeIframe,
                    CLEANUP_IFRAME_TIMEOUT_IN_SECONDS * 1000
                );
            }
        };

        // window.addEventListener('message', iframeEventHandler, false);
        window.document.body.appendChild(iframe);
        iframe.contentWindow.addEventListener(
            'DOMContentLoaded',
            iframeLoadedHandler
        );
        iframe.addEventListener('load', iframeLoadedHandler);
        iframe.setAttribute('src', authorizeUrl);
    });
};

export const encode = value => btoa(value);

export const getCrypto = () => {
    // ie 11.x uses msCrypto
    return window.crypto || window.msCrypto;
};

export const getCryptoSubtle = () => {
    const crypto = getCrypto();
    // safari 10.x uses webkitSubtle
    return crypto.subtle || crypto.webkitSubtle;
};

export const createRandomString = () => {
    const charset =
        '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_~.';
    let random = '';
    const randomValues = Array.from(
        getCrypto().getRandomValues(new Uint8Array(43))
    );
    // eslint-disable-next-line no-return-assign
    randomValues.forEach(v => (random += charset[v % charset.length]));
    return random;
};

export const sha256 = async s => {
    const digestOp = getCryptoSubtle().digest(
        {name: 'SHA-256'},
        new TextEncoder().encode(s)
    );

    // msCrypto (IE11) uses the old spec, which is not Promise based
    // https://msdn.microsoft.com/en-us/expression/dn904640(v=vs.71)
    // Instead of returning a promise, it returns a CryptoOperation
    // with a result property in it.
    // As a result, the various events need to be handled in the event that we're
    // working in IE11 (hence the msCrypto check). These events just call resolve
    // or reject depending on their intention.
    if (window.msCrypto) {
        return new Promise((res, rej) => {
            digestOp.oncomplete = e => {
                res(e.target.result);
            };

            digestOp.onerror = e => {
                rej(e.error);
            };

            digestOp.onabort = () => {
                // eslint-disable-next-line prefer-promise-reject-errors
                rej('The digest operation was aborted');
            };
        });
    }

    // eslint-disable-next-line sonarjs/prefer-immediate-return
    const result = await digestOp;
    return result;
};

// https://stackoverflow.com/questions/30106476/
const decodeB64 = input =>
    decodeURIComponent(
        atob(input)
            .split('')
            .map(c => {
                // eslint-disable-next-line sonarjs/no-nested-template-literals
                return `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`;
            })
            .join('')
    );

export const urlDecodeB64 = input =>
    decodeB64(input.replace(/_/g, '/').replace(/-/g, '+'));

const urlEncodeB64 = input => {
    const b64Chars = {'+': '-', '/': '_', '=': ''};
    return input.replace(/[+/=]/g, m => b64Chars[m]);
};

export const bufferToBase64UrlEncoded = input => {
    const ie11SafeInput = new Uint8Array(input);
    return urlEncodeB64(
        window.btoa(String.fromCharCode(...Array.from(ie11SafeInput)))
    );
};

export const createQueryParams = params => {
    return Object.keys(params)
        .filter(k => typeof params[k] !== 'undefined')
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
        .join('&');
};

export const validateCrypto = () => {
    if (!getCrypto()) {
        throw new Error(
            'For security reasons, `window.crypto` is required to run `auth0-spa-js`.'
        );
    }
    if (typeof getCryptoSubtle() === 'undefined') {
        throw new Error(`
      auth0-spa-js must run on a secure origin. See https://github.com/auth0/auth0-spa-js/blob/master/FAQ.md#why-do-i-get-auth0-spa-js-must-run-on-a-secure-origin for more information.
    `);
    }
};

export const parseQueryResult = queryString => {
    let _queryString = queryString;
    if (queryString.indexOf('#') > -1) {
        _queryString = queryString.substr(0, queryString.indexOf('#'));
    }

    const queryParams = _queryString.split('&');
    const parsedQuery = {};

    queryParams.forEach(qp => {
        const [key, val] = qp.split('=');
        parsedQuery[key] = decodeURIComponent(val);
    });

    if (parsedQuery.expires_in) {
        parsedQuery.expires_in = parseInt(parsedQuery.expires_in, 10);
    }

    return parsedQuery;
};
