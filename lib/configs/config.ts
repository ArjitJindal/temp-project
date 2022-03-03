import { Environment } from 'aws-cdk-lib';

export type Config = {
  stage: 'dev' | 'sandbox' | 'prod';
  env: Environment;
  SITE_DOMAIN: string;
};
