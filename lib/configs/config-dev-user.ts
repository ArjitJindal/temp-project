import { PriceClass } from 'aws-cdk-lib/aws-cloudfront';
import { Config } from './config';

let githubUser = process.env.GITHUB_USER || '';
const serialNumber = process.env.S_NO || '1';
githubUser = githubUser.toLocaleLowerCase();

const siteArns: { [key: string]: string } = {
  amandugar: 'arn:aws:acm:us-east-1:911899431626:certificate/9a22b44d-cde8-4910-b72e-7a73693c679a',
  agupta999: 'arn:aws:acm:us-east-1:911899431626:certificate/26d10828-264f-432f-b363-54af9dc3182f',
  chialunwu: 'arn:aws:acm:us-east-1:911899431626:certificate/638527d1-45c8-4c37-80cf-f8f99aa38f19',
  crooked: 'arn:aws:acm:us-east-1:911899431626:certificate/bfd70361-96ae-4a5b-a66c-7aa5099c5064',
  koluch: 'arn:aws:acm:us-east-1:911899431626:certificate/eb82e34c-a29c-47f1-95ef-9637f9a641e1',
  madhugnadig:
    'arn:aws:acm:us-east-1:911899431626:certificate/4b023134-fc89-45ea-9004-677daac9245b',
};

export const config: Config = {
  stage: 'dev',
  env: { account: '911899431626', region: 'eu-central-1' },
  SITE_DOMAIN: `dev.${githubUser}-${serialNumber}.console.flagright.com`,
  SITE_CERTIFICATE_ARN: siteArns[githubUser],
  CLOUDFRONT_PRICE_CLASS: PriceClass.PRICE_CLASS_100,
};
