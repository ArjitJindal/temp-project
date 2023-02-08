import { PriceClass } from 'aws-cdk-lib/aws-cloudfront';
import { Config } from './config';

let githubUser = process.env.GITHUB_USER || '';
const serialNumber = process.env.S_NO || '1';
githubUser = githubUser.toLocaleLowerCase();

const siteArns: { [key: string]: string } = {
  amandugar: 'arn:aws:acm:us-east-1:911899431626:certificate/9a22b44d-cde8-4910-b72e-7a73693c679a',
  chialunwu: 'arn:aws:acm:us-east-1:911899431626:certificate/638527d1-45c8-4c37-80cf-f8f99aa38f19',
  koluch: 'arn:aws:acm:us-east-1:911899431626:certificate/eb82e34c-a29c-47f1-95ef-9637f9a641e1',
  nadig: 'arn:aws:acm:us-east-1:911899431626:certificate/a80581ad-6e27-47f2-b804-aa0329ea1003',
  timrcoulson: 'arn:aws:acm:us-east-1:911899431626:certificate/4311800d-8038-4ee1-b01f-072c6ad8dd23',
};

export const config: Config = {
  stage: 'dev',
  env: { account: '911899431626', region: 'eu-central-1' },
  SITE_DOMAIN: `dev.${githubUser}-${serialNumber}.console.flagright.com`,
  SITE_CERTIFICATE_ARN: siteArns[githubUser],
  CLOUDFRONT_PRICE_CLASS: PriceClass.PRICE_CLASS_100,
};
