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
  createDynamoDBAlarm,
  createKinesisAlarm,
  createLambdaConsumerIteratorAgeAlarm,
  createLambdaDurationAlarm,
  createLambdaInitDurationAlarm,
  createLambdaErrorPercentageAlarm,
  createLambdaMemoryUtilizationAlarm,
  createLambdaThrottlingAlarm,
  createSQSOldestMessageAgeAlarm,
  createTarponOverallLambdaAlarm,
  dynamoTableOperationMetrics,
  dynamoTableOperations,
  createCanarySuccessPercentageAlarm,
  createRuleHitRateAlarm,
} from '../cdk-utils/cdk-cw-alarms-utils'

const allLambdas = Object.keys(LAMBDAS)

const KINESIS_CONSUMER_LAMBDAS = [
  StackConstants.TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME,
  StackConstants.HAMMERHEAD_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME,
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

const dynamoTables = [
  StackConstants.TARPON_DYNAMODB_TABLE_NAME,
  StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME,
  StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
  StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME,
]

const KINESIS_STREAM_NAMES = [
  {
    streamId: StackConstants.TARPON_STREAM_ID,
    streamName: StackConstants.TARPON_STREAM_NAME,
  },
  {
    streamId: StackConstants.HAMMERHEAD_STREAM_ID,
    streamName: StackConstants.HAMMERHEAD_STREAM_NAME,
  },
]

interface AlarmProps extends cdk.NestedStackProps {
  config: Config
  betterUptimeCloudWatchTopic: Topic
}

export class CdkTarponAlarmsStack extends cdk.NestedStack {
  betterUptimeCloudWatchTopic: Topic
  config: Config

  constructor(scope: Construct, id: string, props: AlarmProps) {
    super(scope, id, props)
    this.config = props.config
    this.betterUptimeCloudWatchTopic = props.betterUptimeCloudWatchTopic

    createTarponOverallLambdaAlarm(this, this.betterUptimeCloudWatchTopic)

    for (const lambdaName of allLambdas) {
      createLambdaDurationAlarm(
        this,
        this.betterUptimeCloudWatchTopic,
        lambdaName,
        Duration.seconds(LAMBDAS[lambdaName].expectedMaxSeconds)
      )
      createLambdaInitDurationAlarm(
        this,
        this.betterUptimeCloudWatchTopic,
        lambdaName,
        Duration.seconds(5)
      )
      // Disable error alarm for now as there's no way to differentiate system error or client side error
      // (we should still get alerted in Sentry for system error)
      if (lambdaName !== StackConstants.WEBHOOK_DELIVERER_FUNCTION_NAME) {
        createLambdaErrorPercentageAlarm(
          this,
          this.betterUptimeCloudWatchTopic,
          lambdaName
        )
      }
      createLambdaThrottlingAlarm(
        this,
        this.betterUptimeCloudWatchTopic,
        lambdaName
      )
      createLambdaMemoryUtilizationAlarm(
        this,
        this.betterUptimeCloudWatchTopic,
        lambdaName
      )
    }

    for (const lambdaName of KINESIS_CONSUMER_LAMBDAS) {
      createLambdaConsumerIteratorAgeAlarm(
        this,
        this.betterUptimeCloudWatchTopic,
        lambdaName
      )
    }

    for (let i = 0; i < API_GATEWAY_ALARM_NAMES.length; i++) {
      createAPIGatewayAlarm(
        this,
        this.betterUptimeCloudWatchTopic,
        API_GATEWAY_ALARM_NAMES[i],
        API_GATEWAY_NAMES[i]
      )
    }

    for (const streamDetails of KINESIS_STREAM_NAMES) {
      createKinesisAlarm(
        this,
        this.betterUptimeCloudWatchTopic,
        `${streamDetails.streamId}PutRecordErrorRate`,
        streamDetails.streamName
      )
    }
    for (const tableName of dynamoTables) {
      dynamoTableOperationMetrics.map((metric) => {
        dynamoTableOperations.map((operation) => {
          createDynamoDBAlarm(
            this,
            this.betterUptimeCloudWatchTopic,
            `Dynamo${tableName}${operation}${metric}`,
            tableName,
            metric,
            {
              threshold: 1,
              period: Duration.minutes(5),
              dimensions: { Operation: operation },
            }
          )
        })
      })

      if (this.config.stage === 'prod' || this.config.stage === 'dev') {
        // We only monitor consumed read/write capacity for production as we use on-demand
        // mode only in production & dev right now

        const prodReadConfig = {
          threshold: 600,
          statistic: 'Maximum',
          period: Duration.minutes(1),
        }
        const devReadConfig = {
          threshold: 25,
          statistic: 'Average',
          period: Duration.minutes(5),
        }
        createDynamoDBAlarm(
          this,
          this.betterUptimeCloudWatchTopic,
          `Dynamo${tableName}ConsumedReadCapacityUnits`,
          tableName,
          'ConsumedReadCapacityUnits',
          this.config.stage === 'prod' ? prodReadConfig : devReadConfig
        )
        createDynamoDBAlarm(
          this,
          this.betterUptimeCloudWatchTopic,
          `Dynamo${tableName}ConsumedWriteCapacityUnits`,
          tableName,
          'ConsumedWriteCapacityUnits',
          {
            threshold: this.config.stage === 'prod' ? 300 : 40,
            statistic: 'Maximum',
            period: Duration.minutes(1),
          }
        )
      }
    }

    for (const sqsQueue of Object.values(SQSQueues)) {
      createSQSOldestMessageAgeAlarm(
        this,
        this.betterUptimeCloudWatchTopic,
        sqsQueue.name,
        Duration.minutes(sqsQueue.oldestMsgAgeAlarmThresholdMinutes ?? 30)
      )
      createSQSOldestMessageAgeAlarm(
        this,
        this.betterUptimeCloudWatchTopic,
        getDeadLetterQueueName(sqsQueue.name),
        Duration.minutes(5)
      )
      createSQSOldestMessageAgeAlarm(
        this,
        this.betterUptimeCloudWatchTopic,
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

    createRuleHitRateAlarm(this, this.betterUptimeCloudWatchTopic, 25)

    /* Canaries */

    if (['dev', 'sandbox'].includes(this.config.stage)) {
      for (const canaryName of Object.keys(CANARIES)) {
        createCanarySuccessPercentageAlarm(
          this,
          this.betterUptimeCloudWatchTopic,
          canaryName,
          90
        )
      }
    }
  }
}
