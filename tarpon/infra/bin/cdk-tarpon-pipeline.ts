#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { config as localConfig } from '@lib/configs/config-local'
import { config as devConfig } from '@lib/configs/config-dev'
import { config as sandboxConfig } from '@lib/configs/config-sandbox'
import { config as prodConfigAsia2 } from '@lib/configs/config-prod-asia-2'
import { config as prodConfigAsia1 } from '@lib/configs/config-prod-asia-1'
import { config as prodConfigUS1 } from '@lib/configs/config-prod-us-1'
import { config as prodConfigAu1 } from '@lib/configs/config-prod-au-1'
import { config as prodConfigEu1 } from '@lib/configs/config-prod-eu-1'
import { config as prodConfigEu2 } from '@lib/configs/config-prod-eu-2'
import { isQaEnv } from '@lib/qa'
import { CdkTarponStack } from '../cdk-tarpon-stack'

const app = new cdk.App()

if (process.env.ENV === 'local') {
  new CdkTarponStack(app, `${localConfig.stage}-tarpon`, localConfig)
}

if (process.env.ENV === 'dev') {
  new CdkTarponStack(app, `${devConfig.stage}-tarpon`, devConfig)
}

if (isQaEnv()) {
  const qaSubdomain = process.env.QA_SUBDOMAIN || ''
  if (qaSubdomain) {
    new CdkTarponStack(
      app,
      `${devConfig.stage}-tarpon-${qaSubdomain}`,
      devConfig
    )
  } else {
    throw new Error('QA_SUBDOMAIN not set correctly')
  }
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

if (process.env.ENV === 'prod:eu-2') {
  new CdkTarponStack(app, `${prodConfigEu2.stage}-tarpon`, prodConfigEu2)
}

if (process.env.ENV === 'prod:au-1') {
  new CdkTarponStack(app, `${prodConfigAu1.stage}-tarpon`, prodConfigAu1)
}

if (process.env.ENV === 'prod:us-1') {
  new CdkTarponStack(app, `${prodConfigUS1.stage}-tarpon`, prodConfigUS1)
}
