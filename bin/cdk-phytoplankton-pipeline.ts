#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { config as deployConfig } from '../lib/configs/config-deployment';
import { config as devConfig } from '../lib/configs/config-dev';
import { config as sandboxConfig } from '../lib/configs/config-sandbox';
import { config as prodConfigAsia1 } from '../lib/configs/config-prod-asia-1';
import { config as prodConfigAsia2 } from '../lib/configs/config-prod-asia-2';
import { config as prodConfigEu1 } from '../lib/configs/config-prod-eu-1';
import { CdkPhytoplanktonStack } from '../lib/cdk-phytoplankton-stack';
import { CdkPhytoplanktonPipelineStack } from '../lib/cdk-phytoplankton-pipeline-stack';

const app = new cdk.App();

let devStack: CdkPhytoplanktonStack | null = null;
let sandboxStack: CdkPhytoplanktonStack | null = null;
let prodStackSIN: CdkPhytoplanktonStack | null = null;
let prodStackBOM: CdkPhytoplanktonStack | null = null;
let prodStackFRA: CdkPhytoplanktonStack | null = null;

if (!process.env.ENV || process.env.ENV === 'dev') {
  devStack = new CdkPhytoplanktonStack(app, `${devConfig.stage}-phytoplankton`, devConfig);
}

if (!process.env.ENV || process.env.ENV === 'sandbox') {
  sandboxStack = new CdkPhytoplanktonStack(
    app,
    `${sandboxConfig.stage}-phytoplankton`,
    sandboxConfig,
  );
}

if (!process.env.ENV || process.env.ENV === 'asia-1') {
  prodStackSIN = new CdkPhytoplanktonStack(
    app,
    `${prodConfigAsia1.stage}-phytoplankton`,
    prodConfigAsia1,
  );
}
if (!process.env.ENV || process.env.ENV === 'asia-2') {
  prodStackBOM = new CdkPhytoplanktonStack(
    app,
    `${prodConfigAsia2.stage}-phytoplankton`,
    prodConfigAsia2,
  );
}
if (!process.env.ENV || process.env.ENV === 'eu-1') {
  prodStackFRA = new CdkPhytoplanktonStack(
    app,
    `${prodConfigEu1.stage}-phytoplankton`,
    prodConfigEu1,
  );
}

if (!process.env.ENV) {
  new CdkPhytoplanktonPipelineStack(app, 'phytoplankton-pipeline', {
    env: deployConfig.env,
    devStack,
    sandboxStack,
    prodStackSIN,
    prodStackBOM,
    prodStackFRA,
  });
}
