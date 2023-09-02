import { Duration } from 'aws-cdk-lib'
import {
  Metric,
  Alarm,
  ComparisonOperator,
  MathExpression,
  DimensionsMap,
  TreatMissingData,
} from 'aws-cdk-lib/aws-cloudwatch'
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions'
import { Construct } from 'constructs'
import { Topic } from 'aws-cdk-lib/aws-sns'
import { FilterPattern, ILogGroup, MetricFilter } from 'aws-cdk-lib/aws-logs'
import { isQaEnv } from '@lib/qa'

export const TARPON_CUSTOM_METRIC_NAMESPACE = 'TarponCustom'
const isDevUserStack = isQaEnv()
const isDev = process.env.ENV === 'dev'

export const createTarponOverallLambdaAlarm = (
  context: Construct,
  betterUptimeTopic: Topic
) => {
  if (isDevUserStack) {
    return null
  }
  return new Alarm(context, 'OverallLambdaErrorPercentage', {
    comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    threshold: 10,
    evaluationPeriods: 3,
    datapointsToAlarm: 3,
    alarmName: 'Lambda-OverallErrorPercentage',
    alarmDescription: `Covers all lambdas in the AWS account. 
    Alarm triggers when average error percentage is higher than 10% for 3 consecutive data points in 15 mins (Checked every 5 minutes). 
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
  if (isDevUserStack) {
    return null
  }
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
            StreamName: kinesisStreamName,
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
            StreamName: kinesisStreamName,
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
  if (isDevUserStack) {
    return null
  }
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
            ApiName: restApiName,
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
  metric: string,
  options: {
    threshold: number
    period: Duration
    statistic?: string
    dimensions?: DimensionsMap
  }
) => {
  if (isDevUserStack) {
    return null
  }
  return new Alarm(context, dynamoDBTableAlarmName, {
    comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    threshold: options.threshold,
    evaluationPeriods: 1,
    datapointsToAlarm: 1,
    alarmName: dynamoDBTableAlarmName,
    alarmDescription: `Covers ${metric} for ${
      options.dimensions?.operation
    } in ${dynamoDBTableName} in the AWS account. 
    Alarm triggers when there is more than ${
      options.threshold
    } ${metric} for 1 data point (Checked every ${options.period.toMinutes()} minutes).`,
    metric: new Metric({
      label: `${dynamoDBTableName}${metric}`,
      namespace: 'AWS/DynamoDB',
      metricName: metric,
      dimensionsMap: {
        TableName: dynamoDBTableName,
        ...(options.dimensions || {}),
      },
    }).with({
      period: options.period,
      statistic: options.statistic || 'Average',
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
  if (isDevUserStack) {
    return null
  }
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
  if (isDevUserStack) {
    return null
  }
  return new Alarm(context, `${lambdaName}ErrorPercentage`, {
    comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    threshold: 10,
    evaluationPeriods: 3,
    datapointsToAlarm: 3,
    alarmName: `Lambda-${lambdaName}ErrorPercentage`,
    alarmDescription: `Covers Error percentage in ${lambdaName} in the AWS account. 
    Alarm triggers when Error percentage 10%  for 3 consecutive data points in 15 mins (Checked every 5 minutes). `,
    metric: new MathExpression({
      expression: '100*(m1/m2)',
      usingMetrics: {
        m1: new Metric({
          label: 'Overall lambda errors',
          namespace: 'AWS/Lambda',
          metricName: 'Errors',
          dimensionsMap: {
            FunctionName: lambdaName,
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
            FunctionName: lambdaName,
          },
        }).with({
          period: Duration.seconds(300),
          statistic: 'Average',
        }),
      },
    }),
  }).addAlarmAction(new SnsAction(betterUptimeTopic))
}

export const createLambdaConsumerIteratorAgeAlarm = (
  context: Construct,
  betterUptimeTopic: Topic,
  lambdaName: string
) => {
  if (isDevUserStack) {
    return null
  }
  return new Alarm(context, `${lambdaName}IteratorAge`, {
    comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    threshold:
      (isDev ? Duration.minutes(30) : Duration.minutes(2)).toSeconds() * 1000,
    evaluationPeriods: 3,
    datapointsToAlarm: 3,
    alarmName: `Lambda-${lambdaName}IteratorAge`,
    alarmDescription: `Covers IteratorAge in ${lambdaName} in the AWS account. 
    Alarm triggers when IteratorAge exceedes 20s for 3 consecutive data points in 15 mins (Checked every 5 minutes). `,
    metric: new Metric({
      label: 'Lambda Iterator Age',
      namespace: 'AWS/Lambda',
      metricName: 'IteratorAge',
      dimensionsMap: {
        FunctionName: lambdaName,
      },
    }).with({
      period: Duration.seconds(300),
      statistic: 'Average',
    }),
  }).addAlarmAction(new SnsAction(betterUptimeTopic))
}
export const createLambdaDurationAlarm = (
  context: Construct,
  betterUptimeTopic: Topic,
  lambdaName: string,
  duration: Duration
) => {
  if (isDevUserStack) {
    return null
  }
  return new Alarm(context, `${lambdaName}Duration`, {
    comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    threshold: duration.toSeconds() * 1000,
    evaluationPeriods: 6,
    datapointsToAlarm: 3,
    treatMissingData: TreatMissingData.NOT_BREACHING,
    alarmName: `Lambda-${lambdaName}Duration`,
    alarmDescription: `Covers Duration in ${lambdaName} in the AWS account. 
    Alarm triggers when Maximum Duration exceedes ${duration.toSeconds()}s for 3 consecutive data points in 30 mins (Checked every 5 minutes). `,
    metric: new Metric({
      label: 'Lambda Maximum Duration',
      namespace: 'AWS/Lambda',
      metricName: 'Duration',
      dimensionsMap: {
        FunctionName: lambdaName,
      },
    }).with({
      period: Duration.seconds(300),
      statistic: 'Maximum',
    }),
  }).addAlarmAction(new SnsAction(betterUptimeTopic))
}
export const createLambdaThrottlingAlarm = (
  context: Construct,
  betterUptimeTopic: Topic,
  lambdaName: string
) => {
  if (isDevUserStack) {
    return null
  }
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
            FunctionName: lambdaName,
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
            FunctionName: lambdaName,
          },
        }).with({
          period: Duration.seconds(300),
          statistic: 'Average',
        }),
      },
    }),
  }).addAlarmAction(new SnsAction(betterUptimeTopic))
}

export const createLambdaMemoryUtilizationAlarm = (
  context: Construct,
  betterUptimeTopic: Topic,
  lambdaName: string
) => {
  if (isDevUserStack) {
    return null
  }
  return new Alarm(context, `${lambdaName}MemoryUtilization`, {
    comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    threshold: 90,
    evaluationPeriods: 3,
    datapointsToAlarm: 3,
    alarmName: `Lambda-${lambdaName}MemoryUtilization`,
    alarmDescription: `Covers memory utilization percentage in ${lambdaName} in the AWS account. 
    Alarm triggers when memory utilization percentage exceedes 90% for 3 consecutive data points in 15 mins (Checked every 5 minutes). `,
    metric: new MathExpression({
      expression: 'm1',
      usingMetrics: {
        m1: new Metric({
          label: 'Lambda memory utilization %',
          namespace: 'LambdaInsights',
          metricName: 'memory_utilization',
          dimensionsMap: {
            function_name: lambdaName,
          },
        }).with({
          period: Duration.seconds(300),
          statistic: 'Maximum',
        }),
      },
    }),
  }).addAlarmAction(new SnsAction(betterUptimeTopic))
}

export const createSQSOldestMessageAgeAlarm = (
  context: Construct,
  betterUptimeTopic: Topic,
  sqsQueue: string,
  threshold: Duration
) => {
  if (isDevUserStack) {
    return null
  }
  return new Alarm(context, `${sqsQueue}OldestMessageAge`, {
    comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    threshold: threshold.toSeconds(),
    evaluationPeriods: 1,
    alarmName: `SQS-${sqsQueue}OldestMessageAge`,
    alarmDescription: `Covers ApproximateAgeOfOldestMessage in ${sqsQueue} in the AWS account. 
    Alarm triggers when ApproximateAgeOfOldestMessage exceedes ${threshold.toSeconds()} seconds.`,
    metric: new Metric({
      label: 'SQS Approximate Age Of Oldest Message',
      namespace: 'AWS/SQS',
      metricName: 'ApproximateAgeOfOldestMessage',
      dimensionsMap: {
        QueueName: sqsQueue,
      },
    }),
  }).addAlarmAction(new SnsAction(betterUptimeTopic))
}
