/**
 * Europe (Frankfurt)
 * (Full list of regions: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html)
 */

import { PriceClass } from 'aws-cdk-lib/aws-cloudfront';
import { Config } from './config';

export const config: Config = {
  stage: 'prod',
  env: { account: '870721492449', region: 'eu-central-1' },
  SITE_DOMAIN: 'console.flagright.com',
  SITE_CERTIFICATE_ARN:
    'arn:aws:acm:us-east-1:870721492449:certificate/cc8f49e3-2fa0-44bb-bee9-38f393b5b014',
  CLOUDFRONT_PRICE_CLASS: PriceClass.PRICE_CLASS_ALL,
};
