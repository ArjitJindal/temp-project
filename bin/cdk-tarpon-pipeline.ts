#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { CdkTarponPipelineStack } from '../lib/cdk-tarpon-pipeline-stack'
import { CdkTarponStack } from '../lib/cdk-tarpon-stack'
import { config as deployConfig } from '../lib/configs/config-deployment'
import { config as devConfig } from '../lib/configs/config-dev'
import { config as sandboxConfig } from '../lib/configs/config-sandbox'

const app = new cdk.App()

const devTarponStack = new CdkTarponStack(
  app,
  `${devConfig.stage}-tarpon`,
  devConfig
)
const sandboxTarponStack = new CdkTarponStack(
  app,
  `${sandboxConfig.stage}-tarpon`,
  sandboxConfig
)

new CdkTarponPipelineStack(app, 'tarpon-pipeline', {
  env: deployConfig.env,
  devTarponStack,
  sandboxTarponStack,
})
