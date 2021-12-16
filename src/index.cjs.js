import createAuthClient, {
    AuthClient,
    AuthenticationError,
    GenericError,
    MfaRequiredError,
    TimeoutError
} from './index';

/**
 * @ignore
 */
const wrapper = createAuthClient;

wrapper.AuthClient = AuthClient;
wrapper.createAuthClient = createAuthClient;
wrapper.GenericError = GenericError;
wrapper.AuthenticationError = AuthenticationError;
wrapper.TimeoutError = TimeoutError;
wrapper.MfaRequiredError = MfaRequiredError;

export default wrapper;
