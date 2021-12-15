import 'core-js/es/string/starts-with';
import 'core-js/es/symbol';
import 'core-js/es/array/from';
import 'core-js/es/typed-array/slice';
import 'core-js/es/array/includes';
import 'core-js/es/string/includes';
import 'core-js/es/set';
import 'promise-polyfill/src/polyfill';
import 'fast-text-encoding';
import 'abortcontroller-polyfill/dist/abortcontroller-polyfill-only';

import AuthClient from './authclient';

export default async function createAuthClient(options) {
    const authClient = new AuthClient(options);
    await authClient.checkSession();
    return authClient;
}

export {AuthClient};

export {
    GenericError,
    AuthenticationError,
    TimeoutError,
    MfaRequiredError
} from './errors';

export {LocalStorageCache, InMemoryCache} from './cache';
