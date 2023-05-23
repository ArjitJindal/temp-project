import { Construct } from 'constructs'
import { aws_cloudwatch as cloudwatch, Duration } from 'aws-cdk-lib'

export interface CloudWatchDashboardProps {
  readonly projectFullName: string
  readonly dashboardName: string
  readonly period: Duration
}

export class CloudWatchDashboard extends Construct {
  private dashboard: cloudwatch.Dashboard
  private props: CloudWatchDashboardProps

  constructor(scope: Construct, id: string, props: CloudWatchDashboardProps) {
    super(scope, id)
    this.props = props

    this.dashboard = new cloudwatch.Dashboard(this, props.dashboardName, {
      dashboardName: `${props.projectFullName}-${props.dashboardName}`,
    })
  }

  public addWidgets(...widgets: cloudwatch.IWidget[]): void {
    this.dashboard.addWidgets(...widgets)
  }

  public createWidget(
    name: string,
    metrics: cloudwatch.IMetric[],
    width?: number
  ): cloudwatch.GraphWidget {
    const widget = new cloudwatch.GraphWidget({
      title: name,
      left: metrics,
      width: width,
    })
    return widget
  }

  public createLeftRightWidget(
    name: string,
    leftMetrics: cloudwatch.IMetric[],
    rightMetrics: cloudwatch.IMetric[],
    width?: number
  ): cloudwatch.GraphWidget {
    const widget = new cloudwatch.GraphWidget({
      title: name,
      left: leftMetrics,
      right: rightMetrics,
      width: width,
    })
    return widget
  }

  public createDynamoDBMetric(
    tableName: string,
    metricName: string,
    options: cloudwatch.MetricOptions = {},
    operation?: string
  ): cloudwatch.Metric {
    const dimensions: any = { TableName: tableName }
    if (operation != undefined) {
      dimensions['operation'] = operation
    }

    return new cloudwatch.Metric({
      metricName,
      namespace: 'AWS/DynamoDB',
      dimensionsMap: dimensions,
      statistic: options.statistic,
      unit: options.unit,
      period: this.props.period,
      label: options.label != undefined ? options.label : metricName,
      ...options,
    })
  }

  public createLambdaMetric(
    lambdaFunctionName: string,
    metricName: string,
    options: cloudwatch.MetricOptions = {}
  ): cloudwatch.Metric {
    /*
        Options:
         - Sum : cloudwatch.Unit.COUNT
         - Average/Minimum/Maximum : Milliseconds
        */

    return new cloudwatch.Metric({
      metricName,
      namespace: 'AWS/Lambda',
      dimensionsMap: {
        FunctionName: lambdaFunctionName.includes(':')
          ? lambdaFunctionName.split(':')[0]
          : lambdaFunctionName, //lambdaNameAlias.split(':')[0],
        Resource: lambdaFunctionName, //lambdaNameAlias
      },
      statistic: options.statistic, // Sum
      unit: options.unit, //cloudwatch.Unit.COUNT
      period: this.props.period,
      label: options.label != undefined ? options.label : metricName,
      ...options,
    })
  }

  public createKinesisMetric(
    streamName: string,
    metricName: string,
    options: cloudwatch.MetricOptions = {}
  ): cloudwatch.Metric {
    return new cloudwatch.Metric({
      metricName,
      namespace: 'AWS/Kinesis',
      dimensionsMap: {
        StreamName: streamName,
      },
      unit: cloudwatch.Unit.COUNT,
      period: this.props.period,
      label: options.label != undefined ? options.label : metricName,
      ...options,
    })
  }

  public createEndpointInstanceMetrics(
    endpointName: string,
    variantName: string,
    metricNames: string[],
    options: cloudwatch.MetricOptions = {}
  ): cloudwatch.Metric[] {
    const metric: cloudwatch.Metric[] = metricNames.map((metricName) => {
      return new cloudwatch.Metric({
        metricName,
        namespace: '/aws/sagemaker/Endpoints',
        dimensionsMap: {
          EndpointName: endpointName,
          VariantName: variantName,
        },
        statistic: 'Average',
        unit: cloudwatch.Unit.PERCENT,
        period: this.props.period,
        label: options.label != undefined ? options.label : metricName,
        ...options,
      })
    })

    return metric
  }

  public createEndpointInvocationMetrics(
    endpointName: string,
    variantName: string,
    metricNames: string[],
    options: cloudwatch.MetricOptions = {}
  ): cloudwatch.Metric[] {
    const metric: cloudwatch.Metric[] = metricNames.map((metricName) => {
      return new cloudwatch.Metric({
        metricName,
        namespace: 'AWS/SageMaker',
        dimensionsMap: {
          EndpointName: endpointName,
          VariantName: variantName,
        },
        statistic: options.statistic, // Sum, Average
        unit: options.unit, //cloudwatch.Unit.COUNT Milliseconds
        period: this.props.period,
        label: options.label != undefined ? options.label : metricName,
        ...options,
      })
    })

    return metric
  }

  public createApiGatewayMetric(
    apiName: string,
    metricName: string,
    options: cloudwatch.MetricOptions = {}
  ): cloudwatch.Metric {
    return new cloudwatch.Metric({
      metricName,
      namespace: 'AWS/ApiGateway',
      dimensionsMap: {
        ApiName: apiName,
      },
      statistic: options.statistic,
      unit: options.unit,
      period: this.props.period,
      label: options.label != undefined ? options.label : metricName,
      ...options,
    })
  }

  public createSnsMetric(
    topicName: string,
    metricName: string,
    options: cloudwatch.MetricOptions = {}
  ): cloudwatch.Metric {
    return new cloudwatch.Metric({
      metricName,
      namespace: 'AWS/SNS',
      dimensionsMap: {
        TopicName: topicName,
      },
      statistic: options.statistic,
      unit: options.unit,
      period: this.props.period,
      label: options.label != undefined ? options.label : metricName,
      ...options,
    })
  }

  public createCustomMetric(
    namespace: string,
    metricName: string,
    dimensions: any,
    options: cloudwatch.MetricOptions = {}
  ): cloudwatch.Metric {
    return new cloudwatch.Metric({
      metricName,
      namespace: namespace,
      dimensionsMap: dimensions,
      statistic: options.statistic,
      unit: options.unit,
      period: this.props.period,
      label: options.label != undefined ? options.label : metricName,
      ...options,
    })
  }
}
