/**
 * Asia Pacific (Mumbai)
 * (Full list of regions: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html)
 */

import { Config } from './config';

export const config: Config = {
  stage: 'prod',
  env: { account: '870721492449', region: 'ap-south-1' },
  SITE_DOMAIN: 'asia-2.console.flagright.com',
  SITE_CERTIFICATE_ARN:
    'arn:aws:acm:us-east-1:870721492449:certificate/b0084115-1669-459e-9131-192e8601c51f',
};
