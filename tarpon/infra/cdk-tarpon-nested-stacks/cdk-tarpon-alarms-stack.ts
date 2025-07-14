import * as cdk from 'aws-cdk-lib'
import * as inspector from 'aws-cdk-lib/aws-inspector'
import * as guardduty from 'aws-cdk-lib/aws-guardduty'
import { Duration } from 'aws-cdk-lib'
import { Topic } from 'aws-cdk-lib/aws-sns'
import { Construct } from 'constructs'
import { Alarm, ComparisonOperator, Metric } from 'aws-cdk-lib/aws-cloudwatch'
import {
  DYNAMODB_TABLE_NAMES,
  getDeadLetterQueueName,
  SQSQueues,
  StackConstants,
} from '@lib/constants'
import { LAMBDAS } from '@lib/lambdas'
import { Config } from '@flagright/lib/config/config'

import { CANARIES } from '@lib/canaries'
import { siloDataTenants } from '@flagright/lib/constants'
import {
  createAPIGatewayAlarm,
  createDynamoDBAlarm,
  createKinesisAlarm,
  createLambdaConsumerIteratorAgeAlarm,
  createLambdaDurationAlarm,
  createLambdaErrorPercentageAlarm,
  createLambdaMemoryUtilizationAlarm,
  createLambdaThrottlingAlarm,
  createSQSOldestMessageAgeAlarm,
  createTarponOverallLambdaAlarm,
  dynamoTableOperationMetrics,
  dynamoTableOperations,
  createCanarySuccessPercentageAlarm,
  createRuleHitRateAlarm,
  createStateMachineAlarm,
  createLambdaCPUUtilizationAlarm,
} from '../cdk-utils/cdk-cw-alarms-utils'

const mapLambdaNameToResourceName = (lambdaName: string) => {
  switch (lambdaName) {
    case StackConstants.PUBLIC_API_TRANSACTION_FUNCTION_NAME:
    case StackConstants.PUBLIC_API_TRANSACTION_EVENT_FUNCTION_NAME:
      return 'TRANSACTION_LAMBDA'
    case StackConstants.TARPON_QUEUE_CONSUMER_FUNCTION_NAME:
    case StackConstants.TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME:
      return 'TARPON_CHANGE_CAPTURE_LAMBDA'
    case StackConstants.PUBLIC_API_USER_FUNCTION_NAME:
    case StackConstants.PUBLIC_API_USER_EVENT_FUNCTION_NAME:
      return 'USER_LAMBDA'
    case StackConstants.CONSOLE_API_TRANSACTIONS_VIEW_FUNCTION_NAME:
      return 'TRANSACTIONS_VIEW_LAMBDA'
    case StackConstants.CONSOLE_API_BUSINESS_USERS_VIEW_FUNCTION_NAME:
      return 'USERS_VIEW_LAMBDA'
    case StackConstants.CONSOLE_API_CONSUMER_USERS_VIEW_FUNCTION_NAME:
      return 'USERS_VIEW_LAMBDA'
    case StackConstants.CONSOLE_API_ALL_USERS_VIEW_FUNCTION_NAME:
      return 'USERS_VIEW_LAMBDA'
    case StackConstants.CONSOLE_API_CASE_FUNCTION_NAME:
      return 'CASE_LAMBDA'
    case StackConstants.BATCH_JOB_RUNNER_FUNCTION_NAME:
      return 'BATCH_JOB_LAMBDA'
    case StackConstants.CRON_JOB_DAILY:
      return 'CRON_JOB_LAMBDA'
    case StackConstants.CONSOLE_API_INCOMING_WEBHOOKS_FUNCTION_NAME:
      return 'INCOMING_WEBHOOK_LAMBDA'
    case StackConstants.CONSOLE_API_SANCTIONS_FUNCTION_NAME:
      return 'SANCTIONS_LAMBDA'
    case StackConstants.ASYNC_RULE_RUNNER_FUNCTION_NAME:
      return 'ASYNC_RULES_LAMBDA'
    case StackConstants.CONSOLE_API_API_KEY_GENERATOR_FUNCTION_NAME:
      return 'API_KEY_GENERATOR_LAMBDA'
    case StackConstants.TRANSACTION_AGGREGATION_FUNCTION_NAME:
      return 'TRANSACTION_AGGREGATION_LAMBDA'
    case StackConstants.REQUEST_LOGGER_FUNCTION_NAME:
      return 'REQUEST_LOGGER_LAMBDA'
    case StackConstants.CONSOLE_API_TENANT_FUNCTION_NAME:
      return 'TENANT_LAMBDA'
    case StackConstants.CONSOLE_API_DASHBOARD_STATS_FUNCTION_NAME:
      return 'DASHBOARD_LAMBDA'
    case StackConstants.CONSOLE_API_COPILOT_FUNCTION_NAME:
      return 'COPILOT_LAMBDA'
    case StackConstants.MONGO_DB_TRIGGER_QUEUE_CONSUMER_FUNCTION_NAME:
      return 'MONGO_DB_TRIGGER_LAMBDA'
    case StackConstants.DYNAMO_DB_TRIGGER_QUEUE_CONSUMER_FUNCTION_NAME:
      return 'DYNAMO_DB_TRIGGER_LAMBDA'
    default:
      return 'LAMBDA_DEFAULT'
  }
}

const allLambdas = Object.keys(LAMBDAS)

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

const dynamoTables = (config: Config) => {
  const tables = [...Object.values(DYNAMODB_TABLE_NAMES)]
  const siloTables =
    siloDataTenants?.[config.stage]?.[config.region ?? 'eu-1'] ?? []

  if (siloTables?.length) {
    tables.push(
      ...siloTables.flatMap((id) => [
        StackConstants.TARPON_DYNAMODB_TABLE_NAME(id),
        StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(id),
      ])
    )
  }
  return tables
}

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

    for (const lambdaName of allLambdas) {
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
      createLambdaCPUUtilizationAlarm(
        this,
        this.zendutyCloudWatchTopic,
        lambdaName,
        this.config.resource[mapLambdaNameToResourceName(lambdaName)]
          ?.MEMORY_SIZE ?? this.config.resource.LAMBDA_DEFAULT.MEMORY_SIZE
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
    }

    for (const streamDetails of KINESIS_STREAM_NAMES) {
      createKinesisAlarm(
        this,
        this.zendutyCloudWatchTopic,
        `${streamDetails.streamId}PutRecordErrorRate`,
        streamDetails.streamName
      )
    }
    for (const tableName of dynamoTables(this.config)) {
      dynamoTableOperationMetrics.map((metric) => {
        dynamoTableOperations.map((operation) => {
          createDynamoDBAlarm(
            this,
            this.zendutyCloudWatchTopic,
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

        createDynamoDBAlarm(
          this,
          this.zendutyCloudWatchTopic,
          `Dynamo${tableName}ConsumedReadCapacityUnits`,
          tableName,
          'ConsumedReadCapacityUnits',
          this.config.stage === 'prod'
            ? {
                threshold: 600,
                statistic: 'Maximum',
                period: Duration.minutes(1),
              }
            : {
                threshold: 30,
                statistic: 'Average',
                period: Duration.minutes(5),
              }
        )
        createDynamoDBAlarm(
          this,
          this.zendutyCloudWatchTopic,
          `Dynamo${tableName}ConsumedWriteCapacityUnits`,
          tableName,
          'ConsumedWriteCapacityUnits',
          this.config.stage === 'prod'
            ? {
                threshold:
                  props.config.resource.DYNAMO_WRITE_CAPACITY_THRESHOLD ?? 300,
                statistic: 'Maximum',
                period: Duration.minutes(1),
              }
            : {
                threshold:
                  props.config.resource.DYNAMO_WRITE_CAPACITY_THRESHOLD ?? 100,
                statistic: 'Average',
                period: Duration.minutes(15),
              }
        )
      }
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
