import * as cdk from 'aws-cdk-lib'
import * as inspector from 'aws-cdk-lib/aws-inspector'
import * as guardduty from 'aws-cdk-lib/aws-guardduty'
import { Duration } from 'aws-cdk-lib'
import { Topic } from 'aws-cdk-lib/aws-sns'
import { Construct } from 'constructs'
import { Alarm, ComparisonOperator, Metric } from 'aws-cdk-lib/aws-cloudwatch'
import {
  getDeadLetterQueueName,
  SQSQueues,
  StackConstants,
} from '@lib/constants'
import { LAMBDAS } from '@lib/lambdas'
import { Config } from '@flagright/lib/config/config'

import { CANARIES } from '@lib/canaries'
import {
  createAPIGatewayAlarm,
  createKinesisAlarm,
  createLambdaConsumerIteratorAgeAlarm,
  createLambdaDurationAlarm,
  createLambdaErrorPercentageAlarm,
  createLambdaMemoryUtilizationAlarm,
  createLambdaThrottlingAlarm,
  createSQSOldestMessageAgeAlarm,
  createTarponOverallLambdaAlarm,
  createCanarySuccessPercentageAlarm,
  createRuleHitRateAlarm,
  createStateMachineAlarm,
  createKinesisThrottledRecordsPercentageAlarm,
  createLambdaFail5xxCountAlarm,
  createRuleErrorCountAlarm,
} from '../cdk-utils/cdk-cw-alarms-utils'

const allLambdas = Object.keys(LAMBDAS)
const allPublicAPILambdas = allLambdas.filter((lambda) =>
  lambda.includes('Public')
)

const KINESIS_CONSUMER_LAMBDAS = [
  StackConstants.TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME,
]

const API_GATEWAY_ALARM_NAMES = [
  StackConstants.TARPON_API_GATEWAY_ALARM_NAME,
  StackConstants.TARPON_MANAGEMENT_API_GATEWAY_ALARM_NAME,
  StackConstants.CONSOLE_API_GATEWAY_ALARM_NAME,
]

const API_GATEWAY_NAMES = [
  StackConstants.TARPON_API_NAME,
  StackConstants.TARPON_MANAGEMENT_API_NAME,
  StackConstants.CONSOLE_API_NAME,
]

const KINESIS_STREAM_NAMES = [
  {
    streamId: StackConstants.TARPON_STREAM_ID,
    streamName: StackConstants.TARPON_STREAM_NAME,
  },
]

interface AlarmProps extends cdk.NestedStackProps {
  config: Config
  zendutyCloudWatchTopic: Topic
  batchJobStateMachineArn: string
}

export class CdkTarponAlarmsStack extends cdk.NestedStack {
  zendutyCloudWatchTopic: Topic
  config: Config

  constructor(scope: Construct, id: string, props: AlarmProps) {
    super(scope, id, props)
    this.config = props.config
    this.zendutyCloudWatchTopic = props.zendutyCloudWatchTopic

    createTarponOverallLambdaAlarm(this, this.zendutyCloudWatchTopic)
    createRuleErrorCountAlarm(this, this.zendutyCloudWatchTopic)

    for (const lambdaName of allPublicAPILambdas) {
      createLambdaDurationAlarm(
        this,
        this.zendutyCloudWatchTopic,
        lambdaName,
        Duration.seconds(LAMBDAS[lambdaName].expectedMaxSeconds)
      )

      // Disable error alarm for now as there's no way to differentiate system error or client side error
      // (we should still get alerted in Sentry for system error)
      if (lambdaName !== StackConstants.WEBHOOK_DELIVERER_FUNCTION_NAME) {
        createLambdaErrorPercentageAlarm(
          this,
          this.zendutyCloudWatchTopic,
          lambdaName
        )
      }
      createLambdaThrottlingAlarm(this, this.zendutyCloudWatchTopic, lambdaName)
      createLambdaMemoryUtilizationAlarm(
        this,
        this.zendutyCloudWatchTopic,
        lambdaName
      )
    }

    for (const lambdaName of KINESIS_CONSUMER_LAMBDAS) {
      createLambdaConsumerIteratorAgeAlarm(
        this,
        this.zendutyCloudWatchTopic,
        lambdaName
      )
    }

    for (let i = 0; i < API_GATEWAY_ALARM_NAMES.length; i++) {
      createAPIGatewayAlarm(
        this,
        this.zendutyCloudWatchTopic,
        API_GATEWAY_ALARM_NAMES[i],
        API_GATEWAY_NAMES[i]
      )

      createLambdaFail5xxCountAlarm(
        this,
        this.zendutyCloudWatchTopic,
        API_GATEWAY_ALARM_NAMES[i],
        API_GATEWAY_NAMES[i],
        5
      )
    }

    for (const streamDetails of KINESIS_STREAM_NAMES) {
      createKinesisAlarm(
        this,
        this.zendutyCloudWatchTopic,
        `${streamDetails.streamId}PutRecordErrorRate`,
        streamDetails.streamName
      )
      createKinesisThrottledRecordsPercentageAlarm(
        this,
        this.zendutyCloudWatchTopic,
        `${streamDetails.streamId}ThrottledRecordsPercentage`,
        streamDetails.streamName,
        20
      )
    }

    for (const sqsQueue of Object.values(SQSQueues)) {
      createSQSOldestMessageAgeAlarm(
        this,
        this.zendutyCloudWatchTopic,
        sqsQueue.name,
        Duration.minutes(sqsQueue.oldestMsgAgeAlarmThresholdMinutes ?? 30)
      )
      createSQSOldestMessageAgeAlarm(
        this,
        this.zendutyCloudWatchTopic,
        getDeadLetterQueueName(sqsQueue.name),
        Duration.minutes(5)
      )
      createSQSOldestMessageAgeAlarm(
        this,
        this.zendutyCloudWatchTopic,
        `NintyMin${getDeadLetterQueueName(sqsQueue.name)}`,
        Duration.minutes(90)
      )
    }
    // Create a GuardDuty Detector
    const detector = new guardduty.CfnDetector(this, 'GuardDutyDetector', {
      enable: true, // Enable GuardDuty
    })
    new Alarm(this, 'CloudWatchAlarm', {
      alarmDescription: 'GuardDuty Finding Count Alarm',
      alarmName: 'GuardDutyFindingCountAlarm',
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 1,
      threshold: 1,
      metric: new Metric({
        metricName: 'FindingsCount',
        namespace: 'AWS/GuardDuty',
        statistic: 'Sum',
        period: Duration.minutes(45),
        dimensionsMap: {
          DetectorId: detector.ref,
        },
      }),
    })
    // Create an Amazon Inspector Assessment Target
    if (
      this.config.stage === 'prod' &&
      this.config.resource.INSPECTOR_ENABLED
    ) {
      new inspector.CfnAssessmentTarget(this, 'InspectorAssessmentTarget', {
        assessmentTargetName: 'InspectorAssessmentTarget',
      })
    }

    createRuleHitRateAlarm(this, this.zendutyCloudWatchTopic, 25)

    /* Canaries */

    if (['dev', 'sandbox'].includes(this.config.stage)) {
      for (const canaryName of Object.keys(CANARIES)) {
        createCanarySuccessPercentageAlarm(
          this,
          this.zendutyCloudWatchTopic,
          canaryName,
          90
        )
      }
    }

    createStateMachineAlarm(
      this,
      this.zendutyCloudWatchTopic,
      props.batchJobStateMachineArn
    )
  }
}
