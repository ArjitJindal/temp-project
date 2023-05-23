import {
  aws_lambda as lambda,
  aws_cloudwatch as cloudwatch,
  aws_sns as sns,
  aws_cloudwatch_actions as cw_actions,
  aws_sns_subscriptions as subscriptions,
  Duration,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'

import { BaseStack, StackCommonProps } from '../../../lib/base/base-stack'
import { MonitorDashboardConfig, ModelDetails } from '../../../lib/utils/types'
import { CloudWatchDashboard } from './cloudwatch-dashboard'

export enum ApiGatewayAlarmType {
  OverallCall,
  Error4xxCall,
  Error5xxCall,
}

export interface ApiGatewayAlarmProps {
  alarmType: ApiGatewayAlarmType
  alarmThreshold: number
  subscriptionEmails: string[]
}

export interface RestApisWidgetProps {
  widgetName: string
  restApisName: string
  alarms?: ApiGatewayAlarmProps[]
}

export class MonitorDashboardStack extends BaseStack {
  private readonly dashboard: CloudWatchDashboard

  constructor(
    scope: Construct,
    props: StackCommonProps,
    stackConfig: MonitorDashboardConfig
  ) {
    super(scope, stackConfig.Name, props, stackConfig)

    const dashboardName = stackConfig.DashboardName
    this.dashboard = new CloudWatchDashboard(this, dashboardName, {
      projectFullName: this.projectPrefix,
      dashboardName: dashboardName,
      period: Duration.minutes(1),
    })

    const restApisName = this.getParameter('apiGatewayName')
    this.createApiGatewayWidget('APIGateway', restApisName, stackConfig)

    const lambdaArn = this.getParameter('predictLambdaFunctionArn')
    this.createLambdaWidget('PredictorLambda', lambdaArn)

    const endpointName = this.getParameter('sageMakerEndpointName')
    const modelList: ModelDetails[] =
      this.commonProps.appConfig.Stack.ModelServing.ModelList
    for (const model of modelList) {
      this.addEndpointWidgets(
        model.VariantName,
        endpointName,
        model.VariantName
      )
    }
  }

  private createApiGatewayWidget(
    widgetName: string,
    restApisName: string,
    stackConfig: MonitorDashboardConfig
  ) {
    const countMetric = this.dashboard.createApiGatewayMetric(
      restApisName,
      'Count',
      { statistic: 'Sum', unit: cloudwatch.Unit.COUNT }
    )
    const error4xxMetric = this.dashboard.createApiGatewayMetric(
      restApisName,
      '4XXError',
      { statistic: 'Sum', unit: cloudwatch.Unit.COUNT }
    )
    const error5xxMetric = this.dashboard.createApiGatewayMetric(
      restApisName,
      '5XXError',
      { statistic: 'Sum', unit: cloudwatch.Unit.COUNT }
    )

    const latencyMetric = this.dashboard.createApiGatewayMetric(
      restApisName,
      'Latency',
      { statistic: 'Average', unit: cloudwatch.Unit.MILLISECONDS }
    )
    const IntegrationLatencyMetric = this.dashboard.createApiGatewayMetric(
      restApisName,
      'IntegrationLatency',
      { statistic: 'Average', unit: cloudwatch.Unit.MILLISECONDS }
    )

    this.dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: `${widgetName}-Count`,
        metrics: [countMetric, error4xxMetric, error5xxMetric],
        width: 24,
        height: 3,
      })
    )

    this.dashboard.addWidgets(
      this.dashboard.createWidget(
        `${widgetName}-Latency`,
        [latencyMetric, IntegrationLatencyMetric],
        24
      )
    )

    this.createWidgetAlarmAction(
      `${widgetName}-OverallCall`,
      countMetric,
      {
        alarmType: ApiGatewayAlarmType.OverallCall,
        alarmThreshold: stackConfig.ApiGatewayOverallCallThreshold,
        subscriptionEmails: stackConfig.SubscriptionEmails,
      },
      3,
      24
    )

    this.createWidgetAlarmAction(
      `${widgetName}-Error4xxCall`,
      error4xxMetric,
      {
        alarmType: ApiGatewayAlarmType.Error4xxCall,
        alarmThreshold: stackConfig.ApiGatewayError4xxCallThreshold,
        subscriptionEmails: stackConfig.SubscriptionEmails,
      },
      3,
      24
    )

    this.createWidgetAlarmAction(
      `${widgetName}-Error5xxCall`,
      error5xxMetric,
      {
        alarmType: ApiGatewayAlarmType.Error5xxCall,
        alarmThreshold: stackConfig.ApiGatewayError5xxCallThreshold,
        subscriptionEmails: stackConfig.SubscriptionEmails,
      },
      3,
      24
    )
  }

  private createWidgetAlarmAction(
    baseName: string,
    metric: cloudwatch.Metric,
    props: ApiGatewayAlarmProps,
    period: number,
    width: number,
    height?: number
  ) {
    const alarmTopic = new sns.Topic(this, `${baseName}-Alarm-Topic`, {
      displayName: `${this.projectPrefix}-${baseName}-Alarm-Topic`,
      topicName: `${this.projectPrefix}-${baseName}-Alarm-Topic`,
    })

    const emailList: string[] = props.subscriptionEmails
    emailList.forEach((email) =>
      alarmTopic.addSubscription(new subscriptions.EmailSubscription(email))
    )

    const metricAlarm = metric.createAlarm(this, `${baseName}-Alarm-Metric`, {
      alarmName: `${this.projectPrefix}-${baseName}-Alarm`,
      threshold: props.alarmThreshold,
      evaluationPeriods: period,
      actionsEnabled: true,
      alarmDescription: `This alarm occurs when ${baseName} is over ${props.alarmThreshold} for ${period} minutes.`,
    })
    metricAlarm.addAlarmAction(new cw_actions.SnsAction(alarmTopic))

    this.dashboard.addWidgets(
      new cloudwatch.AlarmWidget({
        title: baseName,
        alarm: metricAlarm,
        width: width,
        height: height,
      })
    )
  }

  private createLambdaWidget(widgetName: string, lambdaArn: string) {
    const functionName = lambda.Function.fromFunctionArn(
      this,
      widgetName,
      lambdaArn
    ).functionName
    const functionAlias = `${functionName}:${this.commonProps.appConfig.Project.Stage}`

    this.dashboard.addWidgets(
      this.dashboard.createWidget(
        `${widgetName}-Invocations`,
        [
          this.dashboard.createLambdaMetric(functionAlias, 'Invocations', {
            statistic: 'Sum',
            unit: cloudwatch.Unit.COUNT,
          }),
          this.dashboard.createLambdaMetric(
            functionAlias,
            'ProvisionedConcurrencyInvocations',
            { statistic: 'Sum', unit: cloudwatch.Unit.COUNT }
          ),
        ],
        12
      ),
      this.dashboard.createWidget(
        `${widgetName}-ConcurrentExecutions`,
        [
          this.dashboard.createLambdaMetric(
            functionAlias,
            'ConcurrentExecutions',
            { statistic: 'Maximum', unit: cloudwatch.Unit.COUNT }
          ),
          this.dashboard.createLambdaMetric(
            functionAlias,
            'ProvisionedConcurrentExecutions',
            { statistic: 'Maximum', unit: cloudwatch.Unit.COUNT }
          ),
          this.dashboard.createLambdaMetric(
            functionAlias,
            'ProvisionedConcurrencyUtilization',
            { statistic: 'Maximum', unit: cloudwatch.Unit.COUNT }
          ),
        ],
        12
      ),
      this.dashboard.createWidget(
        `${widgetName}-Duration`,
        [
          this.dashboard.createLambdaMetric(functionAlias, 'Duration', {
            statistic: 'Average',
            unit: cloudwatch.Unit.MILLISECONDS,
          }),
          this.dashboard.createLambdaMetric(functionAlias, 'Duration', {
            statistic: 'Minimum',
            unit: cloudwatch.Unit.MILLISECONDS,
          }),
          this.dashboard.createLambdaMetric(functionAlias, 'Duration', {
            statistic: 'Maximum',
            unit: cloudwatch.Unit.MILLISECONDS,
          }),
        ],
        8
      ),
      this.dashboard.createWidget(
        `${widgetName}-Errors`,
        [
          this.dashboard.createLambdaMetric(functionAlias, 'Errors', {
            statistic: 'Sum',
            unit: cloudwatch.Unit.COUNT,
          }),
        ],
        8
      ),
      this.dashboard.createWidget(
        `${widgetName}-Throttles`,
        [
          this.dashboard.createLambdaMetric(functionAlias, 'Throttles', {
            statistic: 'Sum',
            unit: cloudwatch.Unit.COUNT,
          }),
        ],
        8
      )
    )
  }

  private addEndpointWidgets(
    widgetName: string,
    endpointName: string,
    variantName: string
  ) {
    this.dashboard.addWidgets(
      this.dashboard.createWidget(
        `${widgetName}-Instance-Utilization`,
        this.dashboard.createEndpointInstanceMetrics(
          endpointName,
          variantName,
          ['CPUUtilization', 'MemoryUtilization', 'DiskUtilization']
        ),
        12
      ),
      this.dashboard.createWidget(
        `${widgetName}-Invocation-Errors`,
        this.dashboard.createEndpointInvocationMetrics(
          endpointName,
          variantName,
          ['Invocation5XXErrors', 'Invocation4XXErrors'],
          { statistic: 'Sum', unit: cloudwatch.Unit.COUNT }
        ),
        12
      ),
      this.dashboard.createWidget(
        `${widgetName}-Invocation-Count`,
        this.dashboard.createEndpointInvocationMetrics(
          endpointName,
          variantName,
          ['Invocations', 'InvocationsPerInstance'],
          { statistic: 'Sum', unit: cloudwatch.Unit.COUNT }
        ),
        12
      ),
      this.dashboard.createWidget(
        `${widgetName}-Invocation-Latency`,
        this.dashboard.createEndpointInvocationMetrics(
          endpointName,
          variantName,
          ['ModelLatency', 'OverheadLatency'],
          { statistic: 'Average', unit: cloudwatch.Unit.MILLISECONDS }
        ),
        12
      )
    )
  }
}
