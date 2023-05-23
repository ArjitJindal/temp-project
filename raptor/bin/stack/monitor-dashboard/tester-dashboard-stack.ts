import { Construct } from 'constructs'
import { aws_cloudwatch as cloudwatch, Duration } from 'aws-cdk-lib'

import { BaseStack, StackCommonProps } from '../../../lib/base/base-stack'
import { TesterDashboardConfig } from '../../../lib/utils/types'
import { CloudWatchDashboard } from './cloudwatch-dashboard'

export class TesterDashboardStack extends BaseStack {
  private readonly dashboard: CloudWatchDashboard

  constructor(
    scope: Construct,
    props: StackCommonProps,
    stackConfig: TesterDashboardConfig
  ) {
    super(scope, stackConfig.Name, props, stackConfig)

    const dashboardName = stackConfig.DashboardName
    this.dashboard = new CloudWatchDashboard(this, dashboardName, {
      projectFullName: this.projectPrefix,
      dashboardName: dashboardName,
      period: Duration.minutes(1),
    })

    const topicName = this.getParameter('testTriggerSnsTopicName')
    this.createSnsTopicWidget('TriggerSNSTopic', topicName)

    this.createResponseTimeWidget('ResponseTime', 'ApiGateway')
    this.createSuccessWidget('SuccessSum', 'ApiGateway')
    this.createFailWidget('FailSum', 'ApiGateway')
  }

  private createResponseTimeWidget(testTitle: string, testName: string) {
    const metricNameList = ['ResponseTime']
    const testCaseList = ['tc-001', 'tc-002', 'tc-003', 'tc-004']
    const requestResultMetric: cloudwatch.IMetric[] = []
    for (const metricName of metricNameList) {
      for (const testCase of testCaseList) {
        const metric = this.dashboard.createCustomMetric(
          this.commonProps.appConfig.Project.Name,
          metricName,
          {
            Stage: this.commonProps.appConfig.Project.Stage,
            Type: `${testName}/${testCase}`,
          },
          {
            statistic: 'Average',
            label: `${testCase}-${metricName}`,
            unit: cloudwatch.Unit.MILLISECONDS,
          }
        )
        requestResultMetric.push(metric)
      }
    }
    const requestResultWidget = this.dashboard.createWidget(
      `${testTitle}-${testName}`,
      requestResultMetric,
      24
    )

    this.dashboard.addWidgets(requestResultWidget)
  }

  private createSuccessWidget(testTitle: string, testName: string) {
    const metricNameList = ['StatusSuccess', 'TestSuccess']
    const testCaseList = ['tc-001', 'tc-002', 'tc-003', 'tc-004']
    const requestResultMetric: cloudwatch.IMetric[] = []
    for (const metricName of metricNameList) {
      for (const testCase of testCaseList) {
        const metric = this.dashboard.createCustomMetric(
          this.commonProps.appConfig.Project.Name,
          metricName,
          {
            Stage: this.commonProps.appConfig.Project.Stage,
            Type: `${testName}/${testCase}`,
          },
          {
            statistic: 'Sum',
            label: `${testCase}-${metricName}`,
          }
        )
        requestResultMetric.push(metric)
      }
    }
    const requestResultWidget = this.dashboard.createWidget(
      `${testTitle}-${testName}`,
      requestResultMetric,
      24
    )

    this.dashboard.addWidgets(requestResultWidget)
  }

  private createFailWidget(testTitle: string, testName: string) {
    const metricNameList = ['StatusError', 'TestFail']
    const testCaseList = ['tc-001', 'tc-002', 'tc-003', 'tc-004']
    const requestResultMetric: cloudwatch.IMetric[] = []
    for (const metricName of metricNameList) {
      for (const testCase of testCaseList) {
        const metric = this.dashboard.createCustomMetric(
          this.commonProps.appConfig.Project.Name,
          metricName,
          {
            Stage: this.commonProps.appConfig.Project.Stage,
            Type: `${testName}/${testCase}`,
          },
          {
            statistic: 'Sum',
            label: `${testCase}-${metricName}`,
          }
        )
        requestResultMetric.push(metric)
      }
    }
    const requestResultWidget = this.dashboard.createWidget(
      `${testTitle}-${testName}`,
      requestResultMetric,
      24
    )

    this.dashboard.addWidgets(requestResultWidget)
  }

  private createSnsTopicWidget(widgetName: string, topicName: string) {
    const publishedMetric = this.dashboard.createSnsMetric(
      topicName,
      'NumberOfMessagesPublished',
      { statistic: 'Sum', unit: cloudwatch.Unit.COUNT }
    )
    const deliveredMetric = this.dashboard.createSnsMetric(
      topicName,
      'NumberOfNotificationsDelivered',
      { statistic: 'Sum', unit: cloudwatch.Unit.COUNT }
    )
    const failedMetric = this.dashboard.createSnsMetric(
      topicName,
      'NumberOfNotificationsFailed',
      { statistic: 'Sum', unit: cloudwatch.Unit.COUNT }
    )

    const widget = this.dashboard.createWidget(
      widgetName,
      [publishedMetric, deliveredMetric, failedMetric],
      24
    )

    this.dashboard.addWidgets(widget)
  }
}
