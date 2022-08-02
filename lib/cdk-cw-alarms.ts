import {
  Metric,
  Alarm,
  ComparisonOperator,
  MathExpression,
} from 'aws-cdk-lib/aws-cloudwatch'
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions'
import { Construct } from 'constructs'
import { Duration } from 'aws-cdk-lib'
import { Topic } from 'aws-cdk-lib/aws-sns'
import { FilterPattern, ILogGroup, MetricFilter } from 'aws-cdk-lib/aws-logs'

export const TARPON_CUSTOM_METRIC_NAMESPACE = 'TarponCustom'

export const createTarponOverallLambdaAlarm = (
  context: Construct,
  betterUptimeTopic: Topic
) => {
  return new Alarm(context, 'OverallLambdaErrorPercentage', {
    comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    threshold: 90,
    evaluationPeriods: 3,
    datapointsToAlarm: 3,
    alarmName: 'Lambda-OverallErrorPercentage',
    alarmDescription: `Covers all lambdas in the AWS account. 
    Alarm triggers when average error percentage is higher than 90% for 3 consecutive data points in 15 mins (Checked every 5 minutes). 
    Error percentage is calculated by dividing total errors by total invocations`,
    metric: new MathExpression({
      expression: '100*(m1/m2)',
      usingMetrics: {
        m1: new Metric({
          label: 'Overall lambda errors',
          namespace: 'AWS/Lambda',
          metricName: 'Errors',
        }).with({
          period: Duration.seconds(300),
          statistic: 'Average',
        }),
        m2: new Metric({
          label: 'Overall lambda invocations',
          namespace: 'AWS/Lambda',
          metricName: 'Invocations',
        }).with({
          period: Duration.seconds(300),
          statistic: 'Average',
        }),
      },
    }),
  }).addAlarmAction(new SnsAction(betterUptimeTopic))
}

export const createKinesisAlarm = (
  context: Construct,
  betterUptimeTopic: Topic,
  streamAlarmName: string,
  kinesisStreamName: string
) => {
  return new Alarm(context, streamAlarmName, {
    comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    threshold: 5,
    evaluationPeriods: 3,
    datapointsToAlarm: 3,
    alarmName: `Kinesis-${streamAlarmName}`,
    alarmDescription: `Covers error percentage in ${kinesisStreamName} in the AWS account. 
    Alarm triggers when average error percentage is higher than 5% for 3 consecutive data points in 15 mins (Checked every 5 minutes). 
    Error percentage is calculated by dividing total errors by total put metrics`,
    metric: new MathExpression({
      expression: '100*(m1/m2)',
      usingMetrics: {
        m1: new Metric({
          label: `${kinesisStreamName} PutRecord errors`,
          namespace: 'AWS/Kinesis',
          metricName: 'PutRecords.FailedRecords',
          dimensionsMap: {
            name: 'StreamName',
            value: kinesisStreamName,
          },
        }).with({
          period: Duration.seconds(300),
          statistic: 'Average',
        }),
        m2: new Metric({
          label: `Overall ${kinesisStreamName} PutRecords`,
          namespace: 'AWS/Kinesis',
          metricName: 'PutRecords.Records',
          dimensionsMap: {
            name: 'StreamName',
            value: kinesisStreamName,
          },
        }).with({
          period: Duration.seconds(300),
          statistic: 'Average',
        }),
      },
    }),
  }).addAlarmAction(new SnsAction(betterUptimeTopic))
}

export const createAPIGatewayAlarm = (
  context: Construct,
  betterUptimeTopic: Topic,
  restApiAlarmName: string,
  restApiName: string
) => {
  return new Alarm(context, restApiAlarmName, {
    comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    threshold: 5,
    evaluationPeriods: 3,
    datapointsToAlarm: 3,
    alarmName: `APIGateway-${restApiAlarmName}`,
    alarmDescription: `Covers error percentage in ${restApiName} in the AWS account. 
    Alarm triggers when average error percentage is higher than 5% for 3 consecutive data points in 15 mins (Checked every 5 minutes). 
    Error percentage is calculated by using '5XXError' with average statistic.`,
    metric: new MathExpression({
      expression: '100*m1',
      usingMetrics: {
        m1: new Metric({
          label: `APIGateway-${restApiAlarmName} error percentage`,
          namespace: 'AWS/ApiGateway',
          metricName: '5XXError',
          dimensionsMap: {
            name: 'ApiName',
            value: restApiName,
          },
        }).with({
          period: Duration.seconds(300),
          statistic: 'Average',
        }),
      },
    }),
  }).addAlarmAction(new SnsAction(betterUptimeTopic))
}

export const dynamoTableOperationMetrics = [
  'ThrottledRequests',
  'SystemErrors',
  'UserErrors',
]

export const dynamoTableOperations = [
  'BatchWriteItem',
  'BatchGetItem',
  'GetItem',
  'PutItem',
  'Query',
]

export const createDynamoDBAlarm = (
  context: Construct,
  betterUptimeTopic: Topic,
  dynamoDBTableAlarmName: string,
  dynamoDBTableName: string,
  operation: string,
  metric: string
) => {
  return new Alarm(context, dynamoDBTableAlarmName, {
    comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    threshold: 1,
    evaluationPeriods: 1,
    datapointsToAlarm: 1,
    alarmName: dynamoDBTableAlarmName,
    alarmDescription: `Covers ${metric} for ${operation} in ${dynamoDBTableName} in the AWS account. 
    Alarm triggers when there is more than 1 ${metric} for 1 data point (Checked every 5 minutes).`,
    metric: new Metric({
      label: `${dynamoDBTableName}${metric}`,
      namespace: 'AWS/DynamoDB',
      metricName: metric,
      dimensionsMap: {
        TableName: dynamoDBTableName,
        Operation: operation,
      },
    }).with({
      period: Duration.seconds(300),
      statistic: 'Average',
    }),
  }).addAlarmAction(new SnsAction(betterUptimeTopic))
}

const createApiGatewayThrottlingMetricFilter = (
  context: Construct,
  logGroup: ILogGroup,
  restApiName: string
) => {
  new MetricFilter(context, `${restApiName}ThrottlingMetricFilter`, {
    logGroup,
    metricNamespace: TARPON_CUSTOM_METRIC_NAMESPACE,
    metricName: `${restApiName}Throttling`,
    filterPattern: FilterPattern.stringValue('$.status', '=', '429'),
    metricValue: '1',
  })
}

export const createAPIGatewayThrottlingAlarm = (
  context: Construct,
  betterUptimeTopic: Topic,
  logGroup: ILogGroup,
  restApiAlarmName: string,
  restApiName: string
) => {
  createApiGatewayThrottlingMetricFilter(context, logGroup, restApiName)
  return new Alarm(context, restApiAlarmName, {
    comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    threshold: 15,
    evaluationPeriods: 3,
    datapointsToAlarm: 3,
    alarmName: `APIGateway-${restApiAlarmName}`,
    alarmDescription: `Covers throttling count in ${restApiName} in the AWS account. 
    Alarm triggers when 15 requests get throttled for 3 consecutive data points in 15 mins (Checked every 5 minutes). `,
    metric: new Metric({
      label: `${restApiAlarmName} Throttling Count`,
      namespace: TARPON_CUSTOM_METRIC_NAMESPACE,
      metricName: `${restApiName}Throttling`,
    }).with({
      period: Duration.seconds(300),
      statistic: 'Average',
    }),
  }).addAlarmAction(new SnsAction(betterUptimeTopic))
}

export const createLambdaErrorPercentageAlarm = (
  context: Construct,
  betterUptimeTopic: Topic,
  lambdaName: string
) => {
  return new Alarm(context, `${lambdaName}ErrorPercentage`, {
    comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    threshold: 90,
    evaluationPeriods: 3,
    datapointsToAlarm: 3,
    alarmName: `Lambda-${lambdaName}ErrorPercentage`,
    alarmDescription: `Covers Error percentage in ${lambdaName} in the AWS account. 
    Alarm triggers when Error percentage 90%  for 3 consecutive data points in 15 mins (Checked every 5 minutes). `,
    metric: new MathExpression({
      expression: '100*(m1/m2)',
      usingMetrics: {
        m1: new Metric({
          label: 'Overall lambda errors',
          namespace: 'AWS/Lambda',
          metricName: 'Errors',
          dimensionsMap: {
            name: 'FunctionName',
            value: lambdaName,
          },
        }).with({
          period: Duration.seconds(300),
          statistic: 'Average',
        }),
        m2: new Metric({
          label: 'Overall lambda invocations',
          namespace: 'AWS/Lambda',
          metricName: 'Invocations',
          dimensionsMap: {
            name: 'FunctionName',
            value: lambdaName,
          },
        }).with({
          period: Duration.seconds(300),
          statistic: 'Average',
        }),
      },
    }),
  }).addAlarmAction(new SnsAction(betterUptimeTopic))
}

export const createLambdaThrottlingAlarm = (
  context: Construct,
  betterUptimeTopic: Topic,
  lambdaName: string
) => {
  return new Alarm(context, `${lambdaName}Throttling`, {
    comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    threshold: 5,
    evaluationPeriods: 3,
    datapointsToAlarm: 3,
    alarmName: `Lambda-${lambdaName}Throttling`,
    alarmDescription: `Covers Throttle percentage in ${lambdaName} in the AWS account. 
    Alarm triggers when Throttle percentage 5% exceedes for 3 consecutive data points in 15 mins (Checked every 5 minutes). `,
    metric: new MathExpression({
      expression: '100*(m1/m2)',
      usingMetrics: {
        m1: new Metric({
          label: 'Overall lambda errors',
          namespace: 'AWS/Lambda',
          metricName: 'Throttles',
          dimensionsMap: {
            name: 'FunctionName',
            value: lambdaName,
          },
        }).with({
          period: Duration.seconds(300),
          statistic: 'Average',
        }),
        m2: new Metric({
          label: 'Overall lambda invocations',
          namespace: 'AWS/Lambda',
          metricName: 'Invocations',
          dimensionsMap: {
            name: 'FunctionName',
            value: lambdaName,
          },
        }).with({
          period: Duration.seconds(300),
          statistic: 'Average',
        }),
      },
    }),
  }).addAlarmAction(new SnsAction(betterUptimeTopic))
}
