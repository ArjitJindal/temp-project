import * as cdk from 'aws-cdk-lib'
import { Duration } from 'aws-cdk-lib'
import { Topic } from 'aws-cdk-lib/aws-sns'
import { Construct } from 'constructs'
import { Config } from './configs/config'

import {
  createAPIGatewayAlarm,
  createDynamoDBAlarm,
  createKinesisAlarm,
  createLambdaConsumerIteratorAgeAlarm,
  createLambdaDurationAlarm,
  createLambdaErrorPercentageAlarm,
  createLambdaMemoryUtilizationAlarm,
  createLambdaThrottlingAlarm,
  createTarponOverallLambdaAlarm,
  dynamoTableOperationMetrics,
  dynamoTableOperations,
} from './cdk-cw-alarms'
import { StackConstants } from './constants'
import { LAMBDAS } from './lambdas'

const allLambdas = Object.keys(LAMBDAS)

const TIME_SENSITIVE_LAMBDAS = [
  StackConstants.PUBLIC_API_TRANSACTION_FUNCTION_NAME,
  StackConstants.PUBLIC_API_TRANSACTION_EVENT_FUNCTION_NAME,
]

const KINESIS_CONSUMER_LAMBDAS = [
  StackConstants.TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME,
  StackConstants.WEBHOOK_TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME,
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
  {
    streamId: StackConstants.TARPON_MONGODB_RETRY_STREAM_ID,
    streamName: StackConstants.TARPON_MONGODB_RETRY_STREAM_ID,
  },
  {
    streamId: StackConstants.TARPON_WEBHOOK_RETRY_STREAM_ID,
    streamName: StackConstants.TARPON_WEBHOOK_RETRY_STREAM_ID,
  },
]

export class CdkTarponAlarmsStack extends cdk.Stack {
  betterUptimeCloudWatchTopic: Topic
  config: Config

  constructor(
    scope: Construct,
    id: string,
    config: Config,
    betterUptimeCloudWatchTopic: Topic
  ) {
    super(scope, id, {
      env: config.env,
    })
    this.config = config

    this.betterUptimeCloudWatchTopic = betterUptimeCloudWatchTopic

    createTarponOverallLambdaAlarm(this, this.betterUptimeCloudWatchTopic)

    for (const lambdaName of TIME_SENSITIVE_LAMBDAS) {
      createLambdaDurationAlarm(
        this,
        this.betterUptimeCloudWatchTopic,
        lambdaName
      )
    }

    for (const lambdaName of allLambdas) {
      createLambdaErrorPercentageAlarm(
        this,
        this.betterUptimeCloudWatchTopic,
        lambdaName
      )
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

      if (this.config.stage === 'prod') {
        // We only monitor consumed read/write capacity for production as we use on-demand
        // mode only in production

        createDynamoDBAlarm(
          this,
          this.betterUptimeCloudWatchTopic,
          `Dynamo${tableName}ConsumedReadCapacityUnits`,
          tableName,
          'ConsumedReadCapacityUnits',
          {
            threshold: 600,
            statistic: 'Maximum',
            period: Duration.minutes(1),
          }
        )
        createDynamoDBAlarm(
          this,
          this.betterUptimeCloudWatchTopic,
          `Dynamo${tableName}ConsumedWriteCapacityUnits`,
          tableName,
          'ConsumedWriteCapacityUnits',
          {
            threshold: 300,
            statistic: 'Maximum',
            period: Duration.minutes(1),
          }
        )
      }
    }
  }
}
