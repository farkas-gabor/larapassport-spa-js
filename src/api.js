import {getJSON} from './http';
import {createQueryParams} from './utils';

export async function oauthToken({
    baseUrl,
    timeout,
    scope,
    useFormData = true,
    ...options
}) {
    const body = useFormData
        ? createQueryParams(options)
        : JSON.stringify(options);

    // const body = createQueryParams(options);

    // eslint-disable-next-line sonarjs/prefer-immediate-return
    const result = await getJSON(`${baseUrl}/oauth/token`, timeout, scope, {
        method: 'POST',
        body,
        headers: {
            'Content-Type': useFormData
                ? 'application/x-www-form-urlencoded'
                : 'application/json'
        },
        useFormData
    });

    return result;
}
