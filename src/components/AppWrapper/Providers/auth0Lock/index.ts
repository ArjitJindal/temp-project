import Auth0Lock from 'auth0-lock';
import './lock-12.0.0.min';
import './auth0-lock.less';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const _Auth0Lock: typeof Auth0Lock = window.Auth0Lock;

export default _Auth0Lock;
