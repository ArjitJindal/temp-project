export const tenantAuth0Domain = () => {
  const host = window.location.host;
  let auth0Domain = 'dev-flagright.eu.auth0.com';
  switch (host) {
    case 'console.flagright.dev':
      auth0Domain = 'dev-flagright.eu.auth0.com';
      break;
    case 'sandbox.console.flagright.com':
      auth0Domain = 'sandbox-flagright.eu.auth0.com';
      break;
    case 'console.flagright.com':
      auth0Domain = 'flagright.eu.auth0.com';
      break;
    case 'qc-staging.console.regtank.com':
      auth0Domain = 'sandbox-regtank-flagright.eu.auth0.com';
      break;
    case 'transaction.console.regtank.com':
      auth0Domain = 'regtank-flagright.eu.auth0.com';
      break;
    default:
      break;
  }
  // handles for qa automatically
  return auth0Domain;
};
