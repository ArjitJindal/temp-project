import { Environment } from 'aws-cdk-lib';
import { PriceClass } from 'aws-cdk-lib/aws-cloudfront';
import { config as devUserConfig } from './config-dev-user';
import { config as devConfig } from './config-dev';
import { config as sandboxConfig } from './config-sandbox';
import { config as prodConfig } from './config-prod';

export type Stage = 'dev:user' | 'dev' | 'sandbox' | 'prod';
export type Config = {
  stage: Stage;
  env: Environment;
  SITE_DOMAIN: string;
  // The certificate for SITE_DOMAIN created in us-east-1 region
  SITE_CERTIFICATE_ARN: string;
  CLOUDFRONT_PRICE_CLASS: PriceClass;
};
export const CONFIG_MAP: Record<Stage, Config> = {
  'dev:user': devUserConfig,
  dev: devConfig,
  sandbox: sandboxConfig,
  prod: prodConfig,
};
