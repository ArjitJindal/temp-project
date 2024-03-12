import path from 'path'
import {
  Canary,
  Schedule,
  Test,
  Code,
  Runtime,
} from 'aws-cdk-lib/aws-synthetics'
import { Construct } from 'constructs'
import { Duration } from 'aws-cdk-lib'
import { CANARIES } from '@lib/canaries'
import { Config } from '@flagright/lib/config/config'

export const createCanary = (
  scope: Construct & { config: Config },
  name: string,
  minutes: number,
  test: boolean = false
) => {
  const code = Code.fromAsset(
    path.join(`dist`, `canaries`, `${CANARIES[name].path}`)
  )
  const canary = new Canary(scope, name, {
    schedule: Schedule.rate(Duration.minutes(minutes)),
    canaryName: `${test ? 'test-canary' : name}`,
    startAfterCreation: true,
    successRetentionPeriod: Duration.days(7),
    failureRetentionPeriod: Duration.days(14),
    environmentVariables: {
      ENV: scope.config.stage,
      REGION: scope.config.region as string,
      RELEASE_VERSION: process.env.RELEASE_VERSION as string,
      ...{
        ...Object.entries(scope.config.application).reduce(
          (acc: Record<string, string>, [key, value]) => ({
            ...acc,
            [key]: `${value}`,
          }),
          {}
        ),
      },
    },
    runtime: Runtime.SYNTHETICS_NODEJS_PUPPETEER_6_2,
    test: Test.custom({
      code,
      handler: `index.handler`,
    }),
  })

  return canary
}
