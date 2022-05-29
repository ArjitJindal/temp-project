/**
 * Europe (Frankfurt)
 * (Full list of regions: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html)
 */

import { Config } from './config';

export const config: Config = {
  stage: 'prod',
  env: { account: '870721492449', region: 'eu-central-1' },
  SITE_DOMAIN: 'console.flagright.com',
  SITE_CERTIFICATE_ARN:
    'arn:aws:acm:us-east-1:870721492449:certificate/0c876a57-83af-4c80-965a-c3c6575659ed',
};
