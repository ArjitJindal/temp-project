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

export const createTarponOverallLambdaAlarm = (
  context: Construct,
  betterUptimeTopic: Topic
) => {
  return new Alarm(context, 'OverallLambdaErrorPercentage', {
    comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    threshold: 90,
    evaluationPeriods: 3,
    datapointsToAlarm: 3,
    alarmName: 'OverallLambdaErrorPercentage',
    alarmDescription: `Covers all lambdas in the AWS account. 
    Alarm triggers when average error percentage is higher than 95% for 3 consecutive data points in 15 mins (Checked every 5 minutes). 
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
    alarmName: streamAlarmName,
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
    alarmName: restApiAlarmName,
    alarmDescription: `Covers error percentage in ${restApiName} in the AWS account. 
    Alarm triggers when average error percentage is higher than 5% for 3 consecutive data points in 15 mins (Checked every 5 minutes). 
    Error percentage is calculated by using '5XXError' with average statistic.`,
    metric: new MathExpression({
      expression: '100*m1',
      usingMetrics: {
        m1: new Metric({
          label: `${restApiAlarmName} error percentage`,
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
