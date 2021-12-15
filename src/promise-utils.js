const singlePromiseMap = {};

export const singlePromise = (cb, key) => {
    let promise = singlePromiseMap[key];
    if (!promise) {
        promise = cb().finally(() => {
            delete singlePromiseMap[key];
            promise = null;
        });
        singlePromiseMap[key] = promise;
    }
    return promise;
};

export const retryPromise = async (cb, maxNumberOfRetries = 3) => {
    for (let i = 0; i < maxNumberOfRetries; i++) {
        // eslint-disable-next-line no-await-in-loop
        if (await cb()) {
            return true;
        }
    }

    return false;
};
