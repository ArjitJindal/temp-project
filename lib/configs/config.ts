import { Environment } from 'aws-cdk-lib';

export type Config = {
  stage: 'dev' | 'sandbox' | 'prod';
  env: Environment;
  resource: {
    SITE_DOMAIN: string;
  };
  application: {
    API_BASE_PATH: string;
    AUTH0_AUDIENCE: string;
    AUTH0_DOMAIN: string;
    AUTH0_CLIENT_ID: string;
  };
};
