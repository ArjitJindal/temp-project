import * as cdk from 'aws-cdk-lib'
import { Duration } from 'aws-cdk-lib'
import { Topic } from 'aws-cdk-lib/aws-sns'
import { Construct } from 'constructs'
import { StackConstants } from '@lib/constants'
import { LAMBDAS } from '@lib/lambdas'
import {
  createLambdaDurationAlarm,
  createLambdaErrorPercentageAlarm,
  createLambdaMemoryUtilizationAlarm,
  createLambdaThrottlingAlarm,
} from '../cdk-utils/cdk-cw-alarms-utils'

const allLambdas = Object.keys(LAMBDAS)
const allOtherLambdas = allLambdas.filter(
  (lambda) => !lambda.startsWith('Public')
)

interface LambdaAlarmsProps extends cdk.NestedStackProps {
  zendutyCloudWatchTopic: Topic
}

export class CdkTarponLambdaAlarmsStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: LambdaAlarmsProps) {
    super(scope, id, props)

    for (const lambdaName of allOtherLambdas) {
      createLambdaDurationAlarm(
        this,
        props.zendutyCloudWatchTopic,
        lambdaName,
        Duration.seconds(LAMBDAS[lambdaName].expectedMaxSeconds),
        true
      )

      if (lambdaName !== StackConstants.WEBHOOK_DELIVERER_FUNCTION_NAME) {
        createLambdaErrorPercentageAlarm(
          this,
          props.zendutyCloudWatchTopic,
          lambdaName,
          true
        )
      }
      createLambdaThrottlingAlarm(
        this,
        props.zendutyCloudWatchTopic,
        lambdaName,
        true
      )
      createLambdaMemoryUtilizationAlarm(
        this,
        props.zendutyCloudWatchTopic,
        lambdaName,
        true
      )
    }
  }
}
