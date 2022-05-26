// https://umijs.org/config/
import { defineConfig } from 'umi';

export default defineConfig({
  define: {
    API_BASE_PATH: 'https://eu-1.api.flagright.com/console',
    AUTH0_AUDIENCE: 'https://eu-1.api.flagright.com/',
    AUTH0_DOMAIN: 'flagright.eu.auth0.com',
    AUTH0_CLIENT_ID: 'rfyoZTdxlqbFZ42DZ3lMVCnj3j9Onlki',
  },
});
