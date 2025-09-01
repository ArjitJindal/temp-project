import * as cdk from 'aws-cdk-lib'
import { CfnDashboard } from 'aws-cdk-lib/aws-cloudwatch'

export const createTransactionFunctionPerformanceDashboard = (
  stack: cdk.Stack
) => {
  const dashboardBody = {
    widgets: [
      {
        type: 'text',
        x: 0,
        y: 0,
        width: 24,
        height: 3,
        properties: {
          markdown:
            '# Public API Transaction Function Lambda Dashboard\n\nMonitoring performance metrics for the Transaction Lambda function.\n\n**Instructions:**\n- Use time range picker for desired time window\n- Edit widget queries to filter by specific tenant ID if needed\n- Queries analyze CUSTOM_REPORT and CUSTOM_ERROR_REPORT logs\n\n**Note**: Requires performance logging enabled in Lambda functions.',
        },
      },
      {
        type: 'log',
        x: 0,
        y: 3,
        width: 24,
        height: 6,
        properties: {
          query:
            "SOURCE '/aws/lambda/tarponPublicApiTransactionFunction' | fields @timestamp, @requestId, @duration, @initDuration, requestId, tenantId\n| filter @message like /REPORT RequestId/ or @message like /Verifying transaction/\n| stats \n    latest(tenantId) as tenant_id,\n    latest(@duration) + coalesce(latest(@initDuration), 0) as duration\n    by coalesce(requestId, @requestId) as request_id\n| filter ispresent(tenant_id) and ispresent(duration) and ispresent(request_id)\n| stats \n    count() as transactions_count,\n    pct(duration, 50) as p50_duration,\n    pct(duration, 95) as p95_duration,\n    pct(duration, 99) as p99_duration,\n    avg(duration) as avg_duration,\n    min(duration) as min_duration,\n    max(duration) as max_duration\n    by tenant_id\n| sort transactions_count desc",
          queryLanguage: 'CWLI',
          region: stack.region,
          title: 'Duration Percentiles by Tenant',
          view: 'table',
        },
      },
      {
        type: 'log',
        x: 0,
        y: 9,
        width: 24,
        height: 6,
        properties: {
          query:
            "SOURCE '/aws/lambda/tarponPublicApiTransactionFunction' | fields @timestamp, @requestId, @duration, @initDuration, requestId, tenantId\n| filter @message like /REPORT RequestId/ or @message like /Verifying transaction/\n| filter not(ispresent(tenantId)) or tenantId='4c9cdf0251'\n| stats \n    bin(earliest(@timestamp), 2m) as time_bucket,\n    latest(tenantId) as tenant_id,\n    latest(@duration) + coalesce(latest(@initDuration), 0) as duration\n    by coalesce(requestId, @requestId) as request_id\n| filter ispresent(tenant_id) and ispresent(duration) and ispresent(request_id)\n| stats \n    pct(duration, 99) as p99_duration,\n    pct(duration, 50) as p50_duration\n    by time_bucket\n| sort time_bucket desc",
          queryLanguage: 'CWLI',
          region: stack.region,
          title: 'Performance Trends[P50, P99] - GC - 2mins bin',
          view: 'timeSeries',
          stacked: false,
        },
      },
      {
        type: 'log',
        x: 0,
        y: 15,
        width: 24,
        height: 6,
        properties: {
          query:
            "SOURCE '/aws/lambda/tarponPublicApiTransactionFunction' | fields @timestamp, @requestId, @duration, @initDuration, requestId, tenantId\n| filter @message like /REPORT RequestId/ or @message like /Verifying transaction/\n| filter not(ispresent(tenantId)) or tenantId='4c9cdf0251'\n| stats \n    bin(earliest(@timestamp), 30m) as time_bucket,\n    latest(tenantId) as tenant_id,\n    latest(@duration) + coalesce(latest(@initDuration), 0) as duration\n    by coalesce(requestId, @requestId) as request_id\n| filter ispresent(tenant_id) and ispresent(duration) and ispresent(request_id)\n| stats \n    count() as transactions_count,\n    pct(duration, 50) as p50_duration,\n    pct(duration, 95) as p95_duration,\n    pct(duration, 99) as p99_duration,\n    avg(duration) as avg_duration,\n    min(duration) as min_duration,\n    max(duration) as max_duration\n    by tenant_id, time_bucket\n| sort tenant_id, time_bucket desc",
          queryLanguage: 'CWLI',
          region: stack.region,
          title: 'Performance Trends - GC - 30mins bin',
          view: 'table',
        },
      },
      {
        type: 'log',
        x: 0,
        y: 21,
        width: 24,
        height: 3,
        properties: {
          query:
            "SOURCE '/aws/lambda/tarponPublicApiTransactionFunction' | fields @timestamp, @initDuration\n| filter @message like /REPORT RequestId/ and ispresent(@initDuration)\n| stats \n    count() as transactions_count,\n    pct(@initDuration, 50) as p50_duration,\n    pct(@initDuration, 95) as p95_duration,\n    pct(@initDuration, 99) as p99_duration,\n    avg(@initDuration) as avg_duration,\n    min(@initDuration) as min_duration,\n    max(@initDuration) as max_duration\n| sort transactions_count desc",
          queryLanguage: 'CWLI',
          region: stack.region,
          title: 'Lambda Init Duration stats',
          view: 'table',
        },
      },
    ],
  }

  new CfnDashboard(stack, 'tarponPublicApiTransactionFunctionDashboard', {
    dashboardName: `tarponPublicApiTransactionFunctionDashboard`,
    dashboardBody: JSON.stringify(dashboardBody),
  })
}
