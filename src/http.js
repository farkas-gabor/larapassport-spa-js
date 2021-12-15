import fetch from 'unfetch';

import {DEFAULT_SILENT_TOKEN_RETRY_COUNT} from './constants';
import {GenericError, MfaRequiredError} from './errors';

export const createAbortController = () => new AbortController();

const dofetch = async (fetchUrl, fetchOptions) => {
    const response = await fetch(fetchUrl, fetchOptions);
    return {
        ok: response.ok,
        json: await response.json()
    };
};

// eslint-disable-next-line no-unused-vars
const fetchWithoutWorker = async (fetchUrl, fetchOptions, timeout) => {
    const controller = createAbortController();

    let timeoutId;

    // The promise will resolve with one of these two promises (the fetch or the timeout), whichever completes first.
    return Promise.race([
        dofetch(fetchUrl, {...fetchOptions, signal: controller.signal}),
        new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                controller.abort();
                reject(new Error("Timeout when executing 'fetch'"));
            }, 5000);
        })
    ]).finally(() => {
        clearTimeout(timeoutId);
    });
};

// eslint-disable-next-line no-unused-vars
export async function getJSON(url, timeout, scope, options, useFormData) {
    let fetchError = null;
    let response;

    for (let i = 0; i < DEFAULT_SILENT_TOKEN_RETRY_COUNT; i++) {
        try {
            // eslint-disable-next-line no-await-in-loop
            response = await fetchWithoutWorker(url, options, timeout);

            fetchError = null;
            break;
        } catch (e) {
            // Fetch only fails in the case of a network issue, so should be
            // retried here. Failure status (4xx, 5xx, etc) return a resolved Promise
            // with the failure in the body.
            // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
            fetchError = e;
        }
    }

    if (fetchError) {
        // unfetch uses XMLHttpRequest under the hood which throws
        // ProgressEvents on error, which don't have message properties
        fetchError.message = fetchError.message || 'Failed to fetch';
        throw fetchError;
    }

    const {
        json: {error, error_description, ...data},
        ok
    } = response;

    if (!ok) {
        const errorMessage =
            error_description || `HTTP error. Unable to fetch ${url}`;

        if (error === 'mfa_required') {
            throw new MfaRequiredError(error, errorMessage, data.mfa_token);
        }

        throw new GenericError(error || 'request_error', errorMessage);
    }

    return data;
}
