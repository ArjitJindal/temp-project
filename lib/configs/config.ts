import { Environment } from 'aws-cdk-lib';

export type Config = {
  stage: 'dev' | 'sandbox' | 'prod';
  env: Environment;
  SITE_DOMAIN: string;
  SITE_CERTIFICATE_ARN: string;
};
