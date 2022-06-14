import { PriceClass } from 'aws-cdk-lib/aws-cloudfront';
import { Config } from './config';

export const config: Config = {
  stage: 'sandbox',
  env: { account: '293986822825', region: 'eu-central-1' },
  SITE_DOMAIN: 'sandbox.console.flagright.com',
  SITE_CERTIFICATE_ARN:
    'arn:aws:acm:us-east-1:293986822825:certificate/ee2d2072-675e-40f0-8df1-c681b40759b2',
  CLOUDFRONT_PRICE_CLASS: PriceClass.PRICE_CLASS_100,
};
