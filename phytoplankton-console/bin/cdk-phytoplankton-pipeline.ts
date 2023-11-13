#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { config as devConfig } from '../lib/configs/config-dev';
import { config as devUserConfig } from '../lib/configs/config-dev-user';
import { config as sandboxConfig } from '../lib/configs/config-sandbox';
import { config as prodConfig } from '../lib/configs/config-prod';
import { CdkPhytoplanktonStack } from '../lib/cdk-phytoplankton-stack';

const app = new cdk.App();

if (process.env.ENV === 'dev') {
  new CdkPhytoplanktonStack(app, `${devConfig.stage}-phytoplankton`, devConfig);
}

if (process.env.ENV === 'dev:user') {
  const qaSubdomain = process.env.QA_SUBDOMAIN || '';
  if (qaSubdomain) {
    new CdkPhytoplanktonStack(
      app,
      `${devUserConfig.stage}-phytoplankton-${qaSubdomain}`,
      devUserConfig,
    );
  } else {
    throw new Error('QA_SUBDOMAIN not set correctly');
  }
}

if (process.env.ENV === 'sandbox') {
  new CdkPhytoplanktonStack(app, `${sandboxConfig.stage}-phytoplankton`, sandboxConfig);
}

if (process.env.ENV === 'prod') {
  new CdkPhytoplanktonStack(app, `${prodConfig.stage}-phytoplankton`, prodConfig);
}
