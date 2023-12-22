#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { config as devConfig } from '@flagright/lib/config/config-dev'
import { isQaEnv } from '@lib/qa'
import { getTarponConfig } from "@flagright/lib/constants/config"
import { stageAndRegion } from "@flagright/lib/utils/env";
import { CdkTarponStack } from '../cdk-tarpon-stack'
import { CdkTarponTestCanaryStack } from '../cdk-deploy-test-canary-stack'

const app = new cdk.App()

if (process.env.ENV === 'dev' && process.env.TYPE === 'canary') {
  console.log('Deploying canary')
  new CdkTarponTestCanaryStack(
    app,
    `${devConfig.stage}-tarpon-test-canary`,
    devConfig
  )
} else {
  const [stage, region] = stageAndRegion()
  const suffix = isQaEnv() ? `-${process.env.QA_SUBDOMAIN}` : ''
  new CdkTarponStack(app, `${stage}-tarpon${suffix}`, getTarponConfig(stage, region))
}
