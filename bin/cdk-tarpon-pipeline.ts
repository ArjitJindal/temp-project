#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { CdkTarponPipelineStack } from '@cdk/cdk-tarpon-pipeline-stack'
import { CdkTarponStack } from '@cdk/cdk-tarpon-stack'
import { CdkTarponAlarmsStack } from '@cdk/cdk-alarms-stack'
import { config as deployConfig } from '@cdk/configs/config-deployment'
import { config as localConfig } from '@cdk/configs/config-local'
import { config as devConfig } from '@cdk/configs/config-dev'
import { config as sandboxConfig } from '@cdk/configs/config-sandbox'
import { config as prodConfigAsia2 } from '@cdk/configs/config-prod-asia-2'
import { config as prodConfigAsia1 } from '@cdk/configs/config-prod-asia-1'
import { config as prodConfigUS1 } from '@cdk/configs/config-prod-us-1'
import { config as prodConfigEu1 } from '@cdk/configs/config-prod-eu-1'
import { config as prodConfigEu2 } from '@cdk/configs/config-prod-eu-2'

const GITHUB_USERS = [
  'amandugar',
  'agupta999',
  'chialunwu',
  'crooked',
  'koluch',
  'madhugnadig',
]

const app = new cdk.App()

if (process.env.ENV === 'local') {
  const tarponStack = new CdkTarponStack(
    app,
    `${localConfig.stage}-tarpon`,
    localConfig
  )
  new CdkTarponAlarmsStack(
    app,
    `${localConfig.stage}-tarpon-alarms`,
    localConfig,
    tarponStack.betterUptimeCloudWatchTopic
  )
}

if (process.env.ENV === 'dev') {
  const tarponStack = new CdkTarponStack(
    app,
    `${devConfig.stage}-tarpon`,
    devConfig
  )
  new CdkTarponAlarmsStack(
    app,
    `${devConfig.stage}-tarpon-alarms`,
    devConfig,
    tarponStack.betterUptimeCloudWatchTopic
  )
}

if (process.env.ENV === 'dev:user') {
  const githubUser = process.env.GITHUB_USER || ''
  const serialNumber = process.env.S_NO || '1'
  const usernameRegex = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i
  const serialNumberRegex = /^[1-3]$/
  if (
    GITHUB_USERS.includes(githubUser) &&
    usernameRegex.test(githubUser) &&
    serialNumberRegex.test(serialNumber)
  ) {
    new CdkTarponStack(
      app,
      `${devConfig.stage}-tarpon-${githubUser}${serialNumber}`,
      devConfig
    )
  } else {
    throw new Error('GITHUB_USER or S_NO not set correctly')
  }
}

if (process.env.ENV === 'sandbox') {
  const tarponStack = new CdkTarponStack(
    app,
    `${sandboxConfig.stage}-tarpon`,
    sandboxConfig
  )
  new CdkTarponAlarmsStack(
    app,
    `${sandboxConfig.stage}-tarpon-alarms`,
    sandboxConfig,
    tarponStack.betterUptimeCloudWatchTopic
  )
}

if (process.env.ENV === 'prod:asia-1') {
  const tarponStack = new CdkTarponStack(
    app,
    `${prodConfigAsia1.stage}-tarpon`,
    prodConfigAsia1
  )
  new CdkTarponAlarmsStack(
    app,
    `${prodConfigAsia1.stage}-tarpon-alarms`,
    prodConfigAsia1,
    tarponStack.betterUptimeCloudWatchTopic
  )
}

if (process.env.ENV === 'prod:asia-2') {
  const tarponStack = new CdkTarponStack(
    app,
    `${prodConfigAsia2.stage}-tarpon`,
    prodConfigAsia2
  )
  new CdkTarponAlarmsStack(
    app,
    `${prodConfigAsia2.stage}-tarpon-alarms`,
    prodConfigAsia2,
    tarponStack.betterUptimeCloudWatchTopic
  )
}

if (process.env.ENV === 'prod:eu-1') {
  const tarponStack = new CdkTarponStack(
    app,
    `${prodConfigEu1.stage}-tarpon`,
    prodConfigEu1
  )
  new CdkTarponAlarmsStack(
    app,
    `${prodConfigEu1.stage}-tarpon-alarms`,
    prodConfigEu1,
    tarponStack.betterUptimeCloudWatchTopic
  )
}

if (process.env.ENV === 'prod:eu-2') {
  const tarponStack = new CdkTarponStack(
    app,
    `${prodConfigEu2.stage}-tarpon`,
    prodConfigEu2
  )
  new CdkTarponAlarmsStack(
    app,
    `${prodConfigEu2.stage}-tarpon-alarms`,
    prodConfigEu2,
    tarponStack.betterUptimeCloudWatchTopic
  )
}

if (process.env.ENV === 'prod:us-1') {
  const tarponStack = new CdkTarponStack(
    app,
    `${prodConfigUS1.stage}-tarpon`,
    prodConfigUS1
  )
  new CdkTarponAlarmsStack(
    app,
    `${prodConfigUS1.stage}-tarpon-alarms`,
    prodConfigUS1,
    tarponStack.betterUptimeCloudWatchTopic
  )
}

if (!process.env.ENV) {
  new CdkTarponPipelineStack(app, 'tarpon-pipeline', {
    env: deployConfig.env,
  })
}
