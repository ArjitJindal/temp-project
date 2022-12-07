#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { config as deployConfig } from '../lib/configs/config-deployment';
import { config as devConfig } from '../lib/configs/config-dev';
import { config as devUserConfig } from '../lib/configs/config-dev-user';
import { config as sandboxConfig } from '../lib/configs/config-sandbox';
import { config as prodConfig } from '../lib/configs/config-prod';
import { CdkPhytoplanktonStack } from '../lib/cdk-phytoplankton-stack';
import { CdkPhytoplanktonPipelineStack } from '../lib/cdk-phytoplankton-pipeline-stack';

const GITHUB_USERS = ['amandugar', 'agupta999', 'chialunwu', 'crooked', 'koluch', 'nadig'];

const app = new cdk.App();

if (process.env.ENV === 'dev') {
  new CdkPhytoplanktonStack(app, `${devConfig.stage}-phytoplankton`, devConfig);
}

if (process.env.ENV === 'dev:user') {
  const githubUser = process.env.GITHUB_USER || '';
  const S_NO = process.env.S_NO || '';
  const userRegex = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
  const numberRegex = /^[1-3]$/;
  if (GITHUB_USERS.includes(githubUser) && userRegex.test(githubUser) && numberRegex.test(S_NO)) {
    new CdkPhytoplanktonStack(
      app,
      `${devUserConfig.stage}-phytoplankton-${githubUser}-${S_NO}`,
      devUserConfig,
    );
  } else {
    throw new Error('GITHUB_USER or S_NO not set correctly');
  }
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
