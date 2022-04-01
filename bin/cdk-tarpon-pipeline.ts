#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { CdkTarponPipelineStack } from '@cdk/cdk-tarpon-pipeline-stack'
import { CdkTarponStack } from '@cdk/cdk-tarpon-stack'
import { config as deployConfig } from '@cdk/configs/config-deployment'
import { config as localConfig } from '@cdk/configs/config-local'
import { config as devConfig } from '@cdk/configs/config-dev'
import { config as sandboxConfig } from '@cdk/configs/config-sandbox'
import { config as prodConfig } from '@cdk/configs/config-prod'

const app = new cdk.App()

new CdkTarponStack(app, `${localConfig.stage}-tarpon`, localConfig)
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
const prodTarponStack = new CdkTarponStack(
  app,
  `${prodConfig.stage}-tarpon`,
  prodConfig
)

new CdkTarponPipelineStack(app, 'tarpon-pipeline', {
  env: deployConfig.env,
  devTarponStack,
  sandboxTarponStack,
  prodTarponStack,
})
