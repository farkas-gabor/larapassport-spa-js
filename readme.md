# larapassport-spa-js

Laravel Passport SDK for Single Page Applications using [Authorization Code Grant Flow with PKCE](https://auth0.com/docs/api-auth/tutorials/authorization-code-grant-pkce).

> **This package has been inspired by [@auth0/auth0-spa-js](https://github.com/auth0/auth0-spa-js) and [laravel-passport-spa-js](https://github.com/Moutah/laravel-passport-spa-js).**

## Installation

Using [npm](https://npmjs.org):

```sh
npm install larapassport-spa-js
```

## Getting Started

### Laravel Passport Configuration
You need a working authentication server which is up and running (e.g.: http://localhost:8000).

Follow the [official documention's steps](https://laravel.com/docs/8.x/passport#code-grant-pkce "official documention's steps") to create a client.

Make sure that you have a _public_ Passport client with the correct callback URL. The callback URL should reflect the origins that your SPA application is running on. The URL may also include a path, depending on where you're handling the callback (e.g.: http://localhost:3000/callback).

Also, make sure the CORS are set properly.

Take note of the **Client ID** value. You'll need this values in the next step.

### Creating the client

Create an `AuthClient` instance before rendering or initializing your application. You should only have one instance of the client.

```js
import createAuthClient from 'larapassport-spa-js';

//with async/await
const authClient = await createAuthClient({
  domain: '<LARAVEL_PASSPORT_DOMAIN>',
  client_id: '<LARAVEL_PASSPORT_CLIENT_ID>',
  redirect_uri: '<MY_CALLBACK_URL>'
});

//with promises
createAuthClient({
  domain: '<LARAVEL_PASSPORT_DOMAIN>',
  client_id: '<LARAVEL_PASSPORT_CLIENT_ID>',
  redirect_uri: '<MY_CALLBACK_URL>'
}).then(authClient => {
  //...
});
```
Using `createAuthClient` does a couple of things automatically:
- It creates an instance of `AuthClient`.
- It calls `getTokenSilently` to refresh the user session.
- It suppresses all errors from `getTokenSilently`, except `login_required`.

```js
//or, you can just instantiate the client on it's own
import { AuthClient } from 'larapassport-spa-js';

const authClient = new AuthClient({
  domain: '<LARAVEL_PASSPORT_DOMAIN>',
  client_id: '<LARAVEL_PASSPORT_CLIENT_ID>',
  redirect_uri: '<MY_CALLBACK_URL>'
});
```

You can also create the client directly using the `AuthClient` constructor. This can be useful if:
- You wish to bypass the call to `getTokenSilently` on initialization.
- You wish to do custom error handling.
- You wish to initialize the SDK in a synchronous way

### 1 - Login

Make sure that your authentication server should have a login and logout web page. For that, you can use its [Breeze package](https://laravel.com/docs/8.x/starter-kits#laravel-breeze "Breeze package").

```html
<button id="login">Click to Login</button>
```

```js
//with async/await

//redirect to the Login page
document.getElementById('login').addEventListener('click', async () => {
  await authClient.loginWithRedirect({
    redirect_uri: '<MY_CALLBACK_URL>'
    appState: '<a relative SPA path where you want to return to after login>'
  });
});
```

The `appState` is an optional parameter.

When the browser is redirected from Authentication server back to your SPA, `handleRedirectCallback` must be called in order to complete the login flow.

```js
//in your callback route (<MY_CALLBACK_URL>)
window.addEventListener('load', async () => {
  const redirectResult = await authClient.handleRedirectCallback();
  //logged in. you can get the user profile like this:
  const user = await authClient.getUser();
  console.log(user);
});

//with promises

//redirect to the Login page
document.getElementById('login').addEventListener('click', () => {
  authClient.loginWithRedirect().catch(() => {
    //error while redirecting the user
  });
});

//in your callback route (<MY_CALLBACK_URL>)
window.addEventListener('load', () => {
  authClient.handleRedirectCallback().then(redirectResult => {
    //logged in. you can get the user profile like this:
    authClient.getUser().then(user => {
      console.log(user);
    });
  });
});
```

### 2 - Calling an API

```html
<button id="call-api">Call an API</button>
```

```js
//with async/await
document.getElementById('call-api').addEventListener('click', async () => {
  const tokenResult = await authClient.getTokenSilently();
  const result = await fetch('https://your.api.authentication.server.example.com', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${tokenResult.access_token}`
    }
  });
  const data = await result.json();
  console.log(data);
});

//with promises
document.getElementById('call-api').addEventListener('click', () => {
  authClient
    .getTokenSilently()
    .then(tokenResult =>
      fetch('https://your.api.authentication.server.example.com', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${tokenResult.access_token}`
        }
      })
    )
    .then(result => result.json())
    .then(data => {
      console.log(data);
    });
});
```

### 3 - Logout

Make sure that you have a logout route in your authentication server which accepts GET method calls.

```html
<button id="logout">Logout</button>
```

```js
import createAuthClient from 'larapassport-spa-js';

document.getElementById('logout').addEventListener('click', () => {
  authClient.logout();
});
```

You can redirect users back to your app after logging out. This logic must be implemented in your authentication server's logout method that handles a `returnTo` parameter.

```js
authClient.logout({
  returnTo: 'https://your.spa.url.example.com/'
});
```

You can revoke all access tokens and refresh tokens which belong to the Client ID. For that, you need to pass an `allDevices` paramater:

```js
authClient.logout({
  allDevices: true
});
```

### Data caching options

The SDK can be configured to cache ID tokens and access tokens either in memory or in local storage. The default is in memory. This setting can be controlled using the `cacheLocation` option when creating the AuthClient.

To use the in-memory mode, no additional options need are required as this is the default setting. To configure the SDK to cache data using local storage, set `cacheLocation` as follows:

```js
await createAuthClient({
  domain: '<LARAVEL_PASSPORT_DOMAIN>',
  client_id: '<LARAVEL_PASSPORT_CLIENT_ID>',
  redirect_uri: '<MY_CALLBACK_URL>',
  cacheLocation: 'localstorage' // valid values are: 'memory' or 'localstorage'
});
```

**Important:** This feature will allow the caching of data **such as access tokens and refresh tokens ** to be stored in local storage. Exercising this option changes the security characteristics of your application and **should not be used lightly**. Extra care should be taken to mitigate against XSS attacks and minimize the risk of tokens being stolen from local storage.

### Advanced options

Advanced options can be set by specifying the `advancedOptions` property when configuring `AuthClient`.

```js
createAuthClient({
  domain: '<LARAVEL_PASSPORT_DOMAIN>',
  client_id: '<LARAVEL_PASSPORT_CLIENT_ID>',
  advancedOptions: {
    defaultScope: 'foo' // change the scopes that are applied to every authz request.
  }
});
```

## Documentation

### Client options

When you create the `AuthClient` instance, you can pass several options. Some are required, others are optional and come with default value if not specified.

```js
const laravelClientOptions = {
  /**
   * REQUIRED
   * Your Laravel Passport authentication domain url such as `'your.api.authentication.server.com'`.
   */
  domain: string;

  /**
   * REQUIRED
   * The Client ID from the Laravel Passport server.
   */
  client_id: string;

  /**
   * REQUIRED
   * The default URL where Laravel Passport will redirect your browser to with the
   * authentication result.
   */
  redirect_uri: string;

  /**
   * The default scope to be used on authentication requests.
   * Defaults to '' (empty string).
   */
  scope: string;

  /**
   * Number of days until the cookie laravelPassport.is.authenticated will expire.
   * Defaults to 1.
   */
  sessionCheckExpiryDays: number;

  /**
   * If true, the SDK will use a cookie when storing information about the auth
   * transaction while the user is going through the authentication flow on the
   * authorization server. The default is `false`, in which case the SDK will use
   * session storage.
   * Defaults to `false`.
   */
  useCookiesForTransactions: boolean;
};

const authClient = await createAuthClient(authClientOptions);
```

### Available methods

#### Get Access Token with no interaction

```js
$('#getToken').click(async () => {
  const token = await authClient.getTokenSilently();
});
```

#### Get user

```js
$('#getUser').click(async () => {
  const user = await authClient.getUser();
});
```

## Support and Feedback

For support or to provide feedback, please [raise an issue](https://github.com/farkas-gabor/larapassport-spa-js/issues) on the GitHub page.

## License

This project is licensed under the MIT license. See the [LICENSE](https://github.com/farkas-gabor/larapassport-spa-js/blob/main/LICENSE) file for more info.
