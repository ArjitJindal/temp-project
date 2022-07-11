#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { config as deployConfig } from '../lib/configs/config-deployment';
import { config as devConfig } from '../lib/configs/config-dev';
import { config as sandboxConfig } from '../lib/configs/config-sandbox';
import { config as prodConfig } from '../lib/configs/config-prod';
import { CdkPhytoplanktonStack } from '../lib/cdk-phytoplankton-stack';
import { CdkPhytoplanktonPipelineStack } from '../lib/cdk-phytoplankton-pipeline-stack';

const app = new cdk.App();

if (process.env.ENV === 'dev') {
  new CdkPhytoplanktonStack(app, `${devConfig.stage}-phytoplankton`, devConfig);
}

if (process.env.ENV === 'sandbox') {
  new CdkPhytoplanktonStack(app, `${sandboxConfig.stage}-phytoplankton`, sandboxConfig);
}

if (process.env.ENV === 'prod') {
  new CdkPhytoplanktonStack(app, `${prodConfig.stage}-phytoplankton`, prodConfig);
}

if (!process.env.ENV) {
  new CdkPhytoplanktonPipelineStack(app, 'phytoplankton-pipeline', {
    env: deployConfig.env,
  });
}
