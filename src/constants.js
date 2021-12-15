export const DEFAULT_AUTHORIZE_TIMEOUT_IN_SECONDS = 20;

/**
 * Duration in seconds to substract from JWT expiration date to avoid expiration occuring too
 * close from the request.
 */
export const DEFAULT_LEEWAY = 10;

/**
 * The scope to use if none provided.
 */
export const DEFAULT_SCOPE = '';

/**
 * The prefix to use for the entires in client's storage.
 */
export const STORAGE_PREFIX = 'lpjs.';

export const GET_TOKEN_SILENTLY_LOCK_KEY =
    'laravelPassport.lock.getTokenSilently';

export const CACHE_LOCATION_MEMORY = 'memory';
export const CACHE_LOCATION_LOCAL_STORAGE = 'localstorage';

export const DEFAULT_NOW_PROVIDER = () => Date.now();

export const DEFAULT_SILENT_TOKEN_RETRY_COUNT = 3;

export const RECOVERABLE_ERRORS = [
    'login_required',
    'consent_required',
    'interaction_required',
    'account_selection_required',
    // Strictly speaking the user can't recover from `access_denied` - but they
    // can get more information about their access being denied by logging in
    // interactively.
    'access_denied'
];

export const MISSING_REFRESH_TOKEN_ERROR_MESSAGE =
    'The web worker is missing the refresh token';

export const INVALID_REFRESH_TOKEN_ERROR_MESSAGE = 'invalid refresh token';

export const DEFAULT_SESSION_CHECK_EXPIRY_DAYS = 1;

export const CLEANUP_IFRAME_TIMEOUT_IN_SECONDS = 2;

export const TRANSACTION_STORAGE_KEY_PREFIX = 'lp.spajs.txs';
