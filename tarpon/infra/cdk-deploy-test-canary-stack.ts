import { Config } from '@flagright/lib/config/config'
import { Stack } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { StackConstants, getResourceNameForTarpon } from '@lib/constants'
import { Effect, Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam'
import { createCanary } from './cdk-utils/cdk-synthetics-utils'

export class CdkTarponTestCanaryStack extends Stack {
  config: Config
  constructor(scope: Construct, id: string, config: Config) {
    super(scope, id, {
      env: config.env,
    })

    this.config = config

    const canary = createCanary(
      this,
      StackConstants.PUBLIC_API_CANARY_TESTS_NAME,
      30,
      true
    )

    canary.role?.attachInlinePolicy(
      new Policy(this, getResourceNameForTarpon('TestCanaryPolicy'), {
        policyName: getResourceNameForTarpon('TestCanaryPolicy'),
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['apigateway:*'],
            resources: ['*'],
          }),
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['secretsmanager:*'],
            resources: ['*'],
          }),
        ],
      })
    )
  }
}
