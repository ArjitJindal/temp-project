#!/usr/bin/env node
import { App } from 'cdktf'
import { config as devConfig } from '@lib/configs/config-dev'
import { config as sandboxConfig } from '@lib/configs/config-sandbox'
import { config as prodConfigEu1 } from '@lib/configs/config-prod-eu-1'
import { CdktfTarponStack } from '../cdktf-tarpon-stack'

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
