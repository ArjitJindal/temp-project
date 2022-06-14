import { PriceClass } from 'aws-cdk-lib/aws-cloudfront';
import { Config } from './config';

export const config: Config = {
  stage: 'dev',
  env: { account: '911899431626', region: 'eu-central-1' },
  SITE_DOMAIN: 'dev.console.flagright.com',
  SITE_CERTIFICATE_ARN:
    'arn:aws:acm:us-east-1:911899431626:certificate/320e4afd-38f8-488f-8c03-c582b4369a8f',
  CLOUDFRONT_PRICE_CLASS: PriceClass.PRICE_CLASS_100,
};
