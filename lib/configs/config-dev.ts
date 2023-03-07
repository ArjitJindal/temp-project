import { PriceClass } from 'aws-cdk-lib/aws-cloudfront';
import { Config } from './config';

export const config: Config = {
  stage: 'dev',
  env: { account: '911899431626', region: 'eu-central-1' },
  SITE_DOMAIN: 'console.flagright.dev',
  SITE_CERTIFICATE_ARN:
    'arn:aws:acm:us-east-1:911899431626:certificate/867611f5-85c7-4ec1-afe4-4b2dfdedbbdb',
  CLOUDFRONT_PRICE_CLASS: PriceClass.PRICE_CLASS_100,
};
