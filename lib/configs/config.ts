import { Environment } from 'aws-cdk-lib';

export type Config = {
  stage: 'dev' | 'sandbox' | 'prod';
  env: Environment;
  SITE_DOMAIN: string;
  // The certificate for SITE_DOMAIN created in us-east-1 region
  SITE_CERTIFICATE_ARN: string;
};
