/* eslint-disable max-classes-per-file */
/**
 * Thrown when network requests to the Auth server fail.
 */
export class GenericError extends Error {
    /* istanbul ignore next */
    constructor(error, error_description) {
        super(error_description);
        this.error = error;
        this.error_description = error_description;

        Object.setPrototypeOf(this, GenericError.prototype);
    }

    static fromPayload({error, error_description}) {
        return new GenericError(error, error_description);
    }
}

/**
 * Thrown when silent auth times out (usually due to a configuration issue) or
 * when network requests to the Auth server timeout.
 */
export class TimeoutError extends GenericError {
    /* istanbul ignore next */
    constructor() {
        super('timeout', 'Timeout');
        // https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
        Object.setPrototypeOf(this, TimeoutError.prototype);
    }
}

export class AuthenticationError extends GenericError {
    // eslint-disable-next-line no-unused-vars
    constructor(error, error_description, state, appState = null) {
        super(error, error_description);
        // https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
        Object.setPrototypeOf(this, AuthenticationError.prototype);
    }
}

export class MfaRequiredError extends GenericError {
    // eslint-disable-next-line no-unused-vars
    constructor(error, error_description, mfa_token) {
        super(error, error_description);
        // https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
        Object.setPrototypeOf(this, MfaRequiredError.prototype);
    }
}
