export function getBaseUrl() {
  const client_id = getClientId();
  const env = client_id === Cypress.env('local_auth0_client_id') ? 'local' : 'dev';
  return env === 'local' ? 'http://localhost:3002/' : 'https://api.flagright.dev/console/';
}

export function getAuthTokenKey() {
  const authTokenKeyRegex = /@@auth0spajs@@::(.+)::(.+)::(.+)/;
  const localStorage = { ...window.localStorage };
  return Object.keys(localStorage).find((key) => authTokenKeyRegex.test(key));
}

export function getClientId() {
  const authTokenKey = getAuthTokenKey();
  return authTokenKey ? authTokenKey.split('::')[1] : null;
}

export function getAccessToken(authTokenKey) {
  const localStorage = { ...window.localStorage };
  const accessToken = authTokenKey
    ? JSON.parse(localStorage[authTokenKey]).body.access_token
    : null;
  return accessToken;
}
