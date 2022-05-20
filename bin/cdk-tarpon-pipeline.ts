#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { CdkTarponPipelineStack } from '@cdk/cdk-tarpon-pipeline-stack'
import { CdkTarponStack } from '@cdk/cdk-tarpon-stack'
import { config as deployConfig } from '@cdk/configs/config-deployment'
import { config as localConfig } from '@cdk/configs/config-local'
import { config as devConfig } from '@cdk/configs/config-dev'
import { config as sandboxConfig } from '@cdk/configs/config-sandbox'
import { config as prodConfigBOM } from '@cdk/configs/config-prod-BOM'
import { config as prodConfigSIN } from '@cdk/configs/config-prod-SIN'
import { config as prodConfigFRA } from '@cdk/configs/config-prod-FRA'

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

const prodTarponStackSIN = new CdkTarponStack(
  app,
  `${prodConfigSIN.stage}-asia-1-tarpon`,
  prodConfigSIN
)

const prodTarponStackBOM = new CdkTarponStack(
  app,
  `${prodConfigBOM.stage}-asia-2-tarpon`,
  prodConfigBOM
)

const prodTarponStackFRA = new CdkTarponStack(
  app,
  `${prodConfigFRA.stage}-eu-1-tarpon`,
  prodConfigFRA
)

new CdkTarponPipelineStack(app, 'tarpon-pipeline', {
  env: deployConfig.env,
  devTarponStack,
  sandboxTarponStack,
  prodTarponStackSIN,
  prodTarponStackBOM,
  prodTarponStackFRA,
})
