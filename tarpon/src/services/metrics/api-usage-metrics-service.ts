/**
 * API usage metrics service - Gathers API usages of a tenant and publish to CloudWatch, MongoDB and Google Spreadsheet
 * Spreadsheeets: https://drive.google.com/drive/folders/1yQQJL1gEO5UlmsQkY-KXSgPil2sn7iQU
 *
 * Debugging:
 * ENV=prod:asia-2 ts-node scripts/billing/get-tenant-api-usages.ts --tenantId U7O12AVVL9 --month 2023-07
 * ENV=dev ts-node scripts/billing/publish-tenant-api-usages.ts --tenantId flagright --tenantName flagright --month 2023-05
 */

import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { Dimension } from '@aws-sdk/client-cloudwatch'

import {
  groupBy,
  mapValues,
  maxBy,
  mergeWith,
  min,
  sortBy,
  sumBy,
} from 'lodash'
import { PostHog } from 'posthog-node'
import {
  DailyMetricStats,
  DailyStats,
  MonthlyMetricStats,
  getDailyUsage,
  getMetricValues,
} from './utils'
import { SheetsApiUsageMetricsService } from './sheets-api-usage-metrics-service'
import { logger } from '@/core/logger'
import {
  IBAN_COLLECTION,
  METRICS_COLLECTION,
  SANCTIONS_SEARCHES_COLLECTION,
  TRANSACTIONS_COLLECTION,
  TRANSACTION_EVENTS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import {
  publishMetrics,
  TRANSACTIONS_COUNT_METRIC,
  TRANSACTION_EVENTS_COUNT_METRIC,
  USERS_COUNT_METRIC,
  ACTIVE_RULE_INSTANCES_COUNT_METRIC,
  MetricsData,
  SANCTIONS_SEARCHES_COUNT_METRIC,
  TENANT_SEATS_COUNT_METRIC,
  IBAN_RESOLUTION_COUNT_METRIC,
  Metric,
} from '@/core/cloudwatch/metrics'
import { AccountsService, TenantBasic } from '@/services/accounts'
import dayjs from '@/utils/dayjs'
import { traceable } from '@/core/xray'
import { MONTH_DATE_FORMAT_JS } from '@/utils/mongodb-utils'

type TimeRange = { startTimestamp: number; endTimestamp: number }

export type ApiUsageMetrics = {
  name: string
  value: string | number | undefined
  date: string
  collectedTimestamp: number
}

@traceable
export class ApiUsageMetricsService {
  connections: {
    mongoDb: MongoClient
    dynamoDb: DynamoDBDocumentClient
  }

  constructor(connections: {
    mongoDb: MongoClient
    dynamoDb: DynamoDBDocumentClient
  }) {
    this.connections = connections
  }

  public async getDailyMetricValues(
    tenantInfo: TenantBasic,
    timeRange: TimeRange
  ): Promise<DailyMetricStats[]> {
    const transactionsCounts = await getDailyUsage(
      TRANSACTIONS_COLLECTION(tenantInfo.id),
      'createdAt',
      timeRange
    )
    const transactionEventsCounts = await this.getDailyTransactionsEventsCounts(
      tenantInfo,
      timeRange,
      transactionsCounts
    )
    const usersCounts = await getDailyUsage(
      USERS_COLLECTION(tenantInfo.id),
      'createdAt',
      timeRange
    )
    const sanctionsChecksCounts = await getDailyUsage(
      SANCTIONS_SEARCHES_COLLECTION(tenantInfo.id),
      'createdAt',
      timeRange
    )
    const ibanResolutinosCounts = await getDailyUsage(
      IBAN_COLLECTION(tenantInfo.id),
      'createdAt',
      timeRange
    )
    const activeRuleInstanceCounts =
      await this.getDailyActiveRuleInstancesCount(tenantInfo, timeRange)
    const tenantSeatCounts = await this.getDailyNumberOfSeats(
      tenantInfo,
      timeRange
    )
    const result: any = mergeWith(
      mapValues(transactionsCounts, (v) => [
        {
          metric: TRANSACTIONS_COUNT_METRIC,
          value: v,
        },
      ]),
      mapValues(transactionEventsCounts, (v) => [
        {
          metric: TRANSACTION_EVENTS_COUNT_METRIC,
          value: v,
        },
      ]),
      mapValues(usersCounts, (v) => [
        {
          metric: USERS_COUNT_METRIC,
          value: v,
        },
      ]),
      mapValues(sanctionsChecksCounts, (v) => [
        {
          metric: SANCTIONS_SEARCHES_COUNT_METRIC,
          value: v,
        },
      ]),
      mapValues(ibanResolutinosCounts, (v) => [
        {
          metric: IBAN_RESOLUTION_COUNT_METRIC,
          value: v,
        },
      ]),

      // TODO: Support getting retorspective gauge metrics
      mapValues(activeRuleInstanceCounts, (v) => [
        {
          metric: ACTIVE_RULE_INSTANCES_COUNT_METRIC,
          value: v,
        },
      ]),
      mapValues(tenantSeatCounts, (v) => [
        {
          metric: TENANT_SEATS_COUNT_METRIC,
          value: v,
        },
      ]),
      (a: any[], b: any[]) => (a ?? []).concat(b ?? [])
    )

    return sortBy(
      Object.entries(result).map((entry) => ({
        date: entry[0],
        values: entry[1] as Array<{
          metric: Metric
          value: number
        }>,
      })),
      (v) => v.date
    )
  }

  public getMonthlyMetricValues(
    dailyMetrics: DailyMetricStats[]
  ): MonthlyMetricStats[] {
    const monthlyMetrics = mapValues(
      groupBy(dailyMetrics, (dailyMetric) =>
        dayjs(dailyMetric.date).format('YYYY-MM')
      ),
      (metrics) => {
        return Object.values(
          mapValues(
            groupBy(
              metrics.flatMap((metric) => metric.values),
              (metric) => metric.metric.name
            ),
            (metrics) => {
              if (metrics[0].metric.kind === 'GAUGE') {
                return {
                  metric: metrics[0].metric,
                  value: maxBy(metrics, (metric) => metric.value)
                    ?.value as number,
                }
              } else if (metrics[0].metric.kind === 'CULMULATIVE') {
                return {
                  metric: metrics[0].metric,
                  value: sumBy(metrics, (metric) => metric.value),
                }
              } else {
                throw new Error(
                  `Unsupported metric kind: ${metrics[0].metric.kind}`
                )
              }
            }
          )
        )
      }
    )
    return sortBy(
      Object.entries(monthlyMetrics).map((entry) => ({
        month: entry[0],
        values: entry[1],
      })),
      (v) => v.month
    )
  }

  public async publishApiUsageMetrics(
    tenantInfo: TenantBasic,
    month: string, // e.g '2023-01,
    googleSheetIds: string[]
  ): Promise<void> {
    const timeRange: TimeRange = {
      startTimestamp: dayjs(month).startOf('month').valueOf(),
      endTimestamp:
        min([dayjs(month).endOf('month').valueOf(), Date.now()]) || Date.now(),
    }
    const dimensions = this.getDimensions(tenantInfo)
    const dailyValues = await this.getDailyMetricValues(tenantInfo, timeRange)
    const monthlyMetrics = this.getMonthlyMetricValues(dailyValues)
    const dailyMetricsData: MetricsData[] = dailyValues.flatMap((entry) =>
      entry.values.map((item) => ({
        metric: item.metric,
        dimensions,
        value: item.value,
        timestamp: new Date(entry.date).valueOf(),
      }))
    )
    logger.info('Publishing to CloudWatch...')
    await publishMetrics(dailyMetricsData)
    logger.info('Published to CloudWatch')
    logger.info('Publishing to MongoDB...')
    await this.publishMetricsToMongoDb(tenantInfo, dailyValues)
    logger.info('Published to MongoDB')
    logger.info('Publishing to Google Sheet...')
    await this.publishToGoogleSheets(
      tenantInfo,
      googleSheetIds,
      dailyValues,
      monthlyMetrics
    )

    logger.info('Published to Google Sheet')

    await this.publishToPostHog(tenantInfo, dailyValues, monthlyMetrics)

    logger.info('Published to PostHog')
  }

  private async getDailyTransactionsEventsCounts(
    tenantInfo: TenantBasic,
    timeRange: TimeRange,
    dailyTransactionsCountsStats: DailyStats
  ): Promise<DailyStats> {
    const transactionEventsCounts = await getDailyUsage(
      TRANSACTION_EVENTS_COLLECTION(tenantInfo.id),
      'createdAt',
      timeRange
    )
    return mapValues(transactionEventsCounts, (value, key) =>
      Math.max(value - (dailyTransactionsCountsStats[key] ?? 0), 0)
    )
  }

  private async getDailyActiveRuleInstancesCount(
    tenantInfo: TenantBasic,
    timeRange: TimeRange
  ): Promise<DailyStats> {
    const ruleInstanceRepository = new RuleInstanceRepository(tenantInfo.id, {
      dynamoDb: this.connections.dynamoDb,
    })
    const allInstances = await ruleInstanceRepository.getActiveRuleInstances(
      'TRANSACTION'
    )
    const dailyValues = await getMetricValues(
      tenantInfo.id,
      ACTIVE_RULE_INSTANCES_COUNT_METRIC.name,
      timeRange
    )
    return {
      ...dailyValues,
      [dayjs().format(MONTH_DATE_FORMAT_JS)]: allInstances.length,
    }
  }

  private async getDailyNumberOfSeats(
    tenantInfo: TenantBasic,
    timeRange: TimeRange
  ): Promise<DailyStats> {
    if (!tenantInfo.auth0Domain) {
      return {}
    }
    const accountsService = new AccountsService(
      { auth0Domain: tenantInfo.auth0Domain },
      { mongoDb: this.connections.mongoDb }
    )
    const tenant = await accountsService.getTenantById(tenantInfo.id)
    if (!tenant) {
      logger.warn(
        `Tenant not found for getting seats: ${tenantInfo.id}, ${tenantInfo.name}`
      )
      return {}
    }
    const account = await accountsService.getTenantAccounts(tenant)
    const filteredAccount = account.filter(
      (account) => account.role !== 'root' && !account.blocked
    )
    const dailyValues = await getMetricValues(
      tenantInfo.id,
      TENANT_SEATS_COUNT_METRIC.name,
      timeRange
    )

    return {
      ...dailyValues,
      [dayjs().format(MONTH_DATE_FORMAT_JS)]: filteredAccount.length,
    }
  }

  private getDimensions(tenantInfo: TenantBasic): Dimension[] {
    return [
      { Name: 'Tenant Id', Value: tenantInfo.id },
      { Name: 'Tenant Name', Value: tenantInfo.name },
      { Name: 'Region', Value: process.env.AWS_REGION as string },
    ]
  }

  private async publishMetricsToMongoDb(
    tenantInfo: TenantBasic,
    metrics: DailyMetricStats[]
  ): Promise<void> {
    const mongoDb = this.connections.mongoDb.db()
    const metricsCollectionName = METRICS_COLLECTION(tenantInfo.id)
    const metricsCollection = mongoDb.collection(metricsCollectionName)
    const mongoMetrics: ApiUsageMetrics[] = metrics.flatMap((metric) => {
      return metric.values.map((value) => {
        return {
          name: value.metric.name,
          value: value.value,
          date: metric.date,
          collectedTimestamp: Date.now(),
        }
      })
    })

    await Promise.all(
      mongoMetrics.map(
        async (metric) =>
          await metricsCollection.updateOne(
            {
              name: metric.name,
              date: metric.date,
            },
            { $set: metric },
            { upsert: true }
          )
      )
    )
  }

  private async publishToGoogleSheets(
    tenantInfo: TenantBasic,
    googleSheetIds: string[],
    dailyMetrics: DailyMetricStats[],
    monthlyMetrics: MonthlyMetricStats[]
  ) {
    for (const sheetId of googleSheetIds) {
      const sheetsService = new SheetsApiUsageMetricsService(
        tenantInfo,
        sheetId
      )
      await sheetsService.initialize()
      await sheetsService.updateUsageMetrics(dailyMetrics, monthlyMetrics)
    }
  }

  private getPostHogClient(): PostHog | null {
    if (!process.env.POSTHOG_API_KEY || !process.env.POSTHOG_HOST) {
      return null
    }

    return new PostHog(process.env.POSTHOG_API_KEY, {
      host: process.env.POSTHOG_HOST as string,
    })
  }

  private capturePostHogEvents(
    event: string,
    date: string,
    values: Array<{ metric: Metric; value: number }>,
    timestampFormat: string,
    tenantInfo: TenantBasic
  ) {
    const postHogClient = this.getPostHogClient()

    if (!postHogClient) {
      return
    }

    postHogClient.capture({
      distinctId: tenantInfo.id,
      event,
      disableGeoip: true,
      properties: {
        ...values.reduce(
          (acc, value) => ({
            ...acc,
            [value.metric.name]: value.value,
          }),
          {}
        ),
        tenantId: tenantInfo.id,
        tenantName: tenantInfo.name,
        region: process.env.AWS_REGION,
        date,
      },
      timestamp: dayjs(date, timestampFormat).toDate(),
    })
  }

  private async publishToPostHog(
    tenantInfo: TenantBasic,
    dailyMetrics: DailyMetricStats[],
    monthlyMetrics: MonthlyMetricStats[]
  ) {
    const postHogClient = this.getPostHogClient()

    if (!postHogClient) {
      return
    }

    dailyMetrics.forEach((dailyMetric) => {
      this.capturePostHogEvents(
        'api-usage-metrics-daily',
        dailyMetric.date,
        dailyMetric.values,
        'YYYY-MM-DD',
        tenantInfo
      )
    })

    monthlyMetrics.forEach((monthlyMetric) => {
      this.capturePostHogEvents(
        'api_usage_metrics_monthly',
        monthlyMetric.month,
        monthlyMetric.values,
        'YYYY-MM',
        tenantInfo
      )
    })

    await postHogClient.flush()
    await postHogClient.shutdown()
  }
}
