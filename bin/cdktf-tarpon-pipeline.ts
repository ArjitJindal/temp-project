#!/usr/bin/env node
import { config as devConfig } from '@cdk/configs/config-dev'
import { config as sandboxConfig } from '@cdk/configs/config-sandbox'
import { config as prodConfigEu1 } from '@cdk/configs/config-prod-eu-1'
import { CdktfTarponStack } from '@cdk/cdktf-tarpon-stack'
import { App } from 'cdktf'

const app = new App()

if (process.env.ENV === 'dev') {
  new CdktfTarponStack(app, `${devConfig.stage}-tarpon`, devConfig)
}

if (process.env.ENV === 'sandbox') {
  new CdktfTarponStack(app, `${sandboxConfig.stage}-tarpon`, sandboxConfig)
}

if (process.env.ENV?.startsWith('prod')) {
  new CdktfTarponStack(app, `${prodConfigEu1.stage}-tarpon`, prodConfigEu1)
}

app.synth()
