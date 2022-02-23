import type { ConfigurationParameters } from './apis';
import { Configuration, DefaultApi as FlagrightApi } from './apis';

const configParams: ConfigurationParameters = {
  basePath: 'https://dev.api.flagright.com/console',
  middleware: [],
};
const apiConfig = new Configuration(configParams);
export const api = new FlagrightApi(apiConfig);
