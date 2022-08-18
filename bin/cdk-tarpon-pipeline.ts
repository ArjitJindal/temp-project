#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { CdkTarponPipelineStack } from '@cdk/cdk-tarpon-pipeline-stack'
import { CdkTarponStack } from '@cdk/cdk-tarpon-stack'
import { config as deployConfig } from '@cdk/configs/config-deployment'
import { config as localConfig } from '@cdk/configs/config-local'
import { config as devConfig } from '@cdk/configs/config-dev'
import { config as sandboxConfig } from '@cdk/configs/config-sandbox'
import { config as prodConfigAsia2 } from '@cdk/configs/config-prod-asia-2'
import { config as prodConfigAsia1 } from '@cdk/configs/config-prod-asia-1'
import { config as prodConfigUS1 } from '@cdk/configs/config-prod-us-1'
import { config as prodConfigEu1 } from '@cdk/configs/config-prod-eu-1'

const app = new cdk.App()

if (process.env.ENV === 'local') {
  new CdkTarponStack(app, `${localConfig.stage}-tarpon`, localConfig)
}

if (process.env.ENV === 'dev') {
  new CdkTarponStack(app, `${devConfig.stage}-tarpon`, devConfig)
}

if (process.env.ENV === 'sandbox') {
  new CdkTarponStack(app, `${sandboxConfig.stage}-tarpon`, sandboxConfig)
}

if (process.env.ENV === 'prod:asia-1') {
  new CdkTarponStack(app, `${prodConfigAsia1.stage}-tarpon`, prodConfigAsia1)
}

if (process.env.ENV === 'prod:asia-2') {
  new CdkTarponStack(app, `${prodConfigAsia2.stage}-tarpon`, prodConfigAsia2)
}

if (process.env.ENV === 'prod:eu-1') {
  new CdkTarponStack(app, `${prodConfigEu1.stage}-tarpon`, prodConfigEu1)
}

if (process.env.ENV === 'prod:us-1') {
  new CdkTarponStack(app, `${prodConfigUS1.stage}-tarpon`, prodConfigUS1)
}

if (!process.env.ENV) {
  new CdkTarponPipelineStack(app, 'tarpon-pipeline', {
    env: deployConfig.env,
  })
}
