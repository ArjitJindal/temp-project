/**
 * Asia Pacific (Singapore)
 * (Full list of regions: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html)
 */

import { Config } from './config';

export const config: Config = {
  stage: 'prod',
  env: { account: '870721492449', region: 'ap-southeast-1' },
  SITE_DOMAIN: 'asia-1.console.flagright.com',
  SITE_CERTIFICATE_ARN:
    'arn:aws:acm:us-east-1:870721492449:certificate/282129d9-e55c-4804-957b-a71bd90eb652',
};
