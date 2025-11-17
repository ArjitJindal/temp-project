import * as cdk from 'aws-cdk-lib'
import { Duration } from 'aws-cdk-lib'
import { Topic } from 'aws-cdk-lib/aws-sns'
import { Construct } from 'constructs'
import { DYNAMODB_TABLE_NAMES, StackConstants } from '@lib/constants'
import { Config } from '@flagright/lib/config/config'

import { siloDataTenants } from '@flagright/lib/constants/silo-data-tenants'
import {
  createDynamoDBAlarm,
  dynamoTableOperationMetrics,
  dynamoTableOperations,
} from '../cdk-utils/cdk-cw-alarms-utils'

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
  return tables.filter(
    (val) =>
      val !== DYNAMODB_TABLE_NAMES.AGGREGATION ||
      (config.region === 'eu-2' && config.stage === 'prod') // Currently only for eu-2
  )
}

interface DynamoDBAlarmsProps extends cdk.NestedStackProps {
  config: Config
  zendutyCloudWatchTopic: Topic
}

export class CdkTarponDynamoDBAlarmsStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: DynamoDBAlarmsProps) {
    super(scope, id, props)

    for (const tableName of dynamoTables(props.config)) {
      dynamoTableOperationMetrics.map((metric) => {
        dynamoTableOperations.map((operation) => {
          createDynamoDBAlarm(
            this,
            props.zendutyCloudWatchTopic,
            `Dynamo${tableName}${operation}${metric}-New`,
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

      if (props.config.stage === 'prod' || props.config.stage === 'dev') {
        // We only monitor consumed read/write capacity for production as we use on-demand
        // mode only in production & dev right now

        createDynamoDBAlarm(
          this,
          props.zendutyCloudWatchTopic,
          `Dynamo${tableName}ConsumedReadCapacityUnits-New`,
          tableName,
          'ConsumedReadCapacityUnits',
          props.config.stage === 'prod'
            ? {
                threshold: 600,
                statistic: 'Maximum',
                period: Duration.minutes(1),
              }
            : {
                threshold: 50,
                statistic: 'Average',
                period: Duration.minutes(5),
              }
        )
        createDynamoDBAlarm(
          this,
          props.zendutyCloudWatchTopic,
          `Dynamo${tableName}ConsumedWriteCapacityUnits-New`,
          tableName,
          'ConsumedWriteCapacityUnits',
          props.config.stage === 'prod'
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
  }
}
