import {
  GoogleSpreadsheet,
  GoogleSpreadsheetRow,
  GoogleSpreadsheetWorksheet,
} from 'google-spreadsheet'
import { MongoClient } from 'mongodb'
import _ from 'lodash'
import { ApiUsageMetrics } from './api-usage-metrics-service'
import dayjs from '@/utils/dayjs'
import { METRICS_COLLECTION } from '@/utils/mongoDBUtils'
import { CUSTOM_API_USAGE_METRIC_NAMES } from '@/core/cloudwatch/metrics'
import { logger } from '@/core/logger'
import { TenantBasic } from '@/services/accounts'
import { getSecret } from '@/utils/secrets-manager'
import { exponentialRetry } from '@/utils/retry'
import { mergeObjects } from '@/utils/object'

const DAILY_USAGE_METRICS_SHEET_TITLE = 'DailyUsageMetrics'
const MONTHLY_USAGE_METRICS_SHEET_TITLE = 'MonthlyUsageMetrics'

/**
 * SOME IMPORTANT NOTES: (Please read before making any changes)
 * 1. Make sure your spreadsheet has enough columns to store all headers (If not we need to add them manually or this will fail)
 * 2. If we are adding header make sure it does not breaks the existing data
 * 3. Do not change meta data headers, If you want to change them make sure you make a migration script to update the existing data otherwise it will break the existing data
 * 4. If you are adding new custom metric make sure you add it to the CUSTOM_API_USAGE_METRIC_NAMES object in cloudwatch/metrics.ts and always add it in last of the object
 */

const META_DATA_HEADERS_DAILY = {
  DATE: 'Date',
  TENANT_ID: 'TenantId',
  TENANT_NAME: 'TenantName',
  REGION: 'Region',
  START_TIMESTAMP: 'StartTimestamp',
  END_TIMESTAMP: 'EndTimestamp',
}

const META_DATA_HEADERS_MONTHLY = {
  MONTH: 'Month',
  YEAR: 'Year',
  TENANT_ID: 'TenantId',
  TENANT_NAME: 'TenantName',
  REGION: 'Region',
  START_TIMESTAMP: 'StartTimestamp',
  END_TIMESTAMP: 'EndTimestamp',
}

type DataCounts = {
  transactionEventsCount: number
  transactionsCount: number
  usersCount: number
  sanctionsChecksCount: number
  ibanResolutinosCount: number
}

export class SheetsApiUsageMetricsService {
  private dailyUsageMetricsSheet?: GoogleSpreadsheetWorksheet
  private monthlyUsageMetricsSheet?: GoogleSpreadsheetWorksheet
  private tenant: TenantBasic
  private mongoDb: MongoClient
  private tenantId: string
  private monthlyCounts: DataCounts
  private startTimestamp: number
  private endTimestamp: number

  constructor(
    tenant: TenantBasic,
    connections: { mongoDb: MongoClient },
    monthlyCounts: DataCounts,
    timestamps: { startTimestamp: number; endTimestamp: number }
  ) {
    this.tenant = tenant
    this.tenantId = tenant.id
    this.mongoDb = connections.mongoDb
    this.monthlyCounts = monthlyCounts
    this.startTimestamp = dayjs(timestamps.startTimestamp)
      .startOf('day')
      .valueOf()
    this.endTimestamp = dayjs(timestamps.endTimestamp).endOf('day').valueOf()
  }

  private getMonthStartTimestamp(): number {
    return dayjs(this.startTimestamp).startOf('month').valueOf()
  }

  private async createHeadersIfNotExists(
    sheetType: 'daily' | 'monthly'
  ): Promise<void> {
    let currentHeaders: string[] = []

    const sheet =
      sheetType === 'daily'
        ? this.dailyUsageMetricsSheet
        : this.monthlyUsageMetricsSheet

    if (!sheet) {
      throw new Error(
        `Sheet ${sheetType} is not initialized. Please call initialize() first.`
      )
    }

    try {
      await sheet.loadHeaderRow()
      currentHeaders = sheet.headerValues
    } catch (error) {
      // If the sheet is empty, loadHeaderRow() will throw an error
      // We can ignore this error and continue
      logger.error(
        `Error while loading header row for sheet ${sheet.title}: ${
          (error as Error).message
        } Maybe a false alarm, continuing...`
      )
    }

    const META_DATA_HEADERS =
      sheetType === 'daily'
        ? Object.values(META_DATA_HEADERS_DAILY)
        : Object.values(META_DATA_HEADERS_MONTHLY)

    const allRequiredHeadersExist = META_DATA_HEADERS.concat(
      Object.values(CUSTOM_API_USAGE_METRIC_NAMES)
    )
    const missingHeaders = allRequiredHeadersExist.filter(
      (header) => !currentHeaders.includes(header)
    )

    if (missingHeaders.length > 0) {
      await sheet.setHeaderRow(currentHeaders.concat(missingHeaders))
    }
  }

  private async initializePrivate() {
    const spreadsheetId = process.env.SHEET_ID as string
    const googleSpreadsheetService = new GoogleSpreadsheet(spreadsheetId)

    const secret = await getSecret<{ privateKey: string }>(
      process.env.GOOGLE_SHEETS_PRIVATE_KEY as string
    )

    await googleSpreadsheetService.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL as string,
      private_key: secret.privateKey.replace(/\\n/g, '\n'),
    })

    await googleSpreadsheetService.loadInfo()

    const dailyUsageMetricsSheet =
      googleSpreadsheetService.sheetsByTitle[DAILY_USAGE_METRICS_SHEET_TITLE]

    if (!dailyUsageMetricsSheet) {
      throw new Error(
        `Sheet with title '${DAILY_USAGE_METRICS_SHEET_TITLE}' not found in spreadsheet '${spreadsheetId}'`
      )
    }

    const monthlyUsageMetricsSheet =
      googleSpreadsheetService.sheetsByTitle[MONTHLY_USAGE_METRICS_SHEET_TITLE]

    if (!monthlyUsageMetricsSheet) {
      throw new Error(
        `Sheet with title '${MONTHLY_USAGE_METRICS_SHEET_TITLE}' not found in spreadsheet '${spreadsheetId}'`
      )
    }

    this.dailyUsageMetricsSheet = dailyUsageMetricsSheet
    this.monthlyUsageMetricsSheet = monthlyUsageMetricsSheet
    await this.createHeadersIfNotExists('daily')
    await this.createHeadersIfNotExists('monthly')
  }

  public async initialize(): Promise<void> {
    await exponentialRetry(async () => {
      await this.initializePrivate()
    }, `Error while initializing SheetsApiUsageMetricsService for tenant ${this.tenantId}`)
  }

  private getDailyUsageMetadata(): {
    [key: string]: string | number
  } {
    return {
      [META_DATA_HEADERS_DAILY.START_TIMESTAMP]: this.startTimestamp,
      [META_DATA_HEADERS_DAILY.END_TIMESTAMP]: this.endTimestamp,
      [META_DATA_HEADERS_DAILY.DATE]: dayjs(this.startTimestamp).format(
        'YYYY-MM-DD'
      ),
      [META_DATA_HEADERS_DAILY.TENANT_ID]: this.tenantId,
      [META_DATA_HEADERS_DAILY.TENANT_NAME]: this.tenant.name,
      [META_DATA_HEADERS_DAILY.REGION]: this.getRegion(),
    }
  }

  private getMonthlyUsageMetadata(): {
    [key: string]: string | number
  } {
    return {
      [META_DATA_HEADERS_MONTHLY.START_TIMESTAMP]: dayjs(this.startTimestamp)
        .startOf('month')
        .valueOf(),
      [META_DATA_HEADERS_MONTHLY.END_TIMESTAMP]: this.endTimestamp,
      [META_DATA_HEADERS_MONTHLY.MONTH]: dayjs(this.startTimestamp).format(
        'MMMM'
      ),
      [META_DATA_HEADERS_MONTHLY.YEAR]: dayjs(this.startTimestamp).format(
        'YYYY'
      ),
      [META_DATA_HEADERS_MONTHLY.TENANT_ID]: this.tenantId,
      [META_DATA_HEADERS_MONTHLY.TENANT_NAME]: this.tenant.name,
      [META_DATA_HEADERS_MONTHLY.REGION]: this.getRegion(),
    }
  }

  private getRegion(): string {
    return process.env.ENV === 'prod'
      ? (process.env.REGION as string)
      : process.env.ENV ?? 'local'
  }

  private async publishDailyUsageMetrics(data: {
    [key: string]: string | number
  }): Promise<void> {
    if (!this.dailyUsageMetricsSheet) {
      throw new Error(
        `Sheet daily is not initialized. Please call initialize() first.`
      )
    }

    const rows = await this.getAllDailyUsageMetricsRows()
    const row = rows.findIndex(
      (row) =>
        row[META_DATA_HEADERS_DAILY.START_TIMESTAMP].toString() ===
          data[META_DATA_HEADERS_DAILY.START_TIMESTAMP].toString() &&
        row[META_DATA_HEADERS_DAILY.TENANT_ID].toString() ===
          data[META_DATA_HEADERS_DAILY.TENANT_ID].toString()
    )

    if (row > -1) {
      rows[row] = mergeObjects(rows[row], data as GoogleSpreadsheetRow)
      await rows[row].save()
    } else {
      await this.dailyUsageMetricsSheet.addRow(data)
    }
  }

  private async getAllMonthlyUsageMetricsRows(): Promise<
    Array<GoogleSpreadsheetRow>
  > {
    if (!this.monthlyUsageMetricsSheet) {
      throw new Error(
        `Sheet monthly is not initialized. Please call initialize() first.`
      )
    }
    return await this.monthlyUsageMetricsSheet.getRows()
  }

  private async getAllDailyUsageMetricsRows(): Promise<
    Array<GoogleSpreadsheetRow>
  > {
    if (!this.dailyUsageMetricsSheet) {
      throw new Error(
        `Sheet daily is not initialized. Please call initialize() first.`
      )
    }
    return await this.dailyUsageMetricsSheet.getRows()
  }

  private async publishMonthlyUsageMetrics(data: {
    [key: string]: string | number
  }): Promise<void> {
    if (!this.monthlyUsageMetricsSheet) {
      throw new Error(
        `Sheet monthly is not initialized. Please call initialize() first.`
      )
    }

    const tenantRows = await this.getAllMonthlyUsageMetricsRows()

    const tenantRow = tenantRows.findIndex(
      (row) =>
        row[META_DATA_HEADERS_MONTHLY.MONTH] ===
          data[META_DATA_HEADERS_MONTHLY.MONTH] &&
        String(row[META_DATA_HEADERS_MONTHLY.YEAR]) ===
          String(data[META_DATA_HEADERS_MONTHLY.YEAR]) &&
        row[META_DATA_HEADERS_MONTHLY.TENANT_ID] ===
          data[META_DATA_HEADERS_MONTHLY.TENANT_ID]
    )

    if (tenantRow > -1) {
      tenantRows[tenantRow] = mergeObjects(
        tenantRows[tenantRow],
        data as GoogleSpreadsheetRow
      )
      await tenantRows[tenantRow].save()
    } else {
      await this.monthlyUsageMetricsSheet.addRow(data)
    }
  }

  private async updateUsageMetricsPrivate(): Promise<void> {
    const dailyUsageMetrics = await this.getDailyUsageMetricsData()
    const transformedDailyUsageMetrics =
      this.transformDailyUsageMetrics(dailyUsageMetrics)
    await this.publishDailyUsageMetrics(
      mergeObjects(this.getDailyUsageMetadata(), transformedDailyUsageMetrics)
    )
    const monthlyUsageMetrics = await this.getMonthlyUsageMetricsData()

    const transformedMonthlyUsageMetrics =
      this.transformMonthlyUsageMetrics(monthlyUsageMetrics)

    await this.publishMonthlyUsageMetrics(
      mergeObjects(
        this.getMonthlyUsageMetadata(),
        transformedMonthlyUsageMetrics
      )
    )
  }

  public async updateUsageMetrics() {
    await exponentialRetry(
      async () => await this.updateUsageMetricsPrivate(),
      `Error while updating usage metrics for tenant '${this.tenantId}' with startTimestamp '${this.startTimestamp}' and endTimestamp '${this.endTimestamp}'`
    )
  }

  private async getDailyUsageMetricsData(): Promise<Array<ApiUsageMetrics>> {
    const metricsCollection = this.mongoDb
      .db()
      .collection<ApiUsageMetrics>(METRICS_COLLECTION(this.tenantId))

    const dailyUsageMetrics = await metricsCollection
      .find({
        startTimestamp: this.startTimestamp,
        endTimestamp: this.endTimestamp,
      })
      .toArray()

    if (!dailyUsageMetrics?.length) {
      throw new Error(
        `No daily usage metrics found for tenant '${this.tenantId}' with startTimestamp '${this.startTimestamp}' and endTimestamp '${this.endTimestamp}'`
      )
    }

    return dailyUsageMetrics
  }

  private async getMonthlyUsageMetricsData(): Promise<Array<ApiUsageMetrics>> {
    const metricsCollectionName = METRICS_COLLECTION(this.tenantId)

    const metricsCollection = this.mongoDb
      .db()
      .collection<ApiUsageMetrics>(metricsCollectionName)

    const monthlyUsageMetrics = await metricsCollection
      .find({
        startTimestamp: {
          $gte: this.getMonthStartTimestamp(),
        },
        endTimestamp: {
          $lte: this.endTimestamp,
        },
      })
      .toArray()

    if (!monthlyUsageMetrics?.length) {
      throw new Error(
        `No monthly usage metrics found for tenant '${
          this.tenantId
        }' with startTimestamp '${this.getMonthStartTimestamp()}' and endTimestamp '${
          this.endTimestamp
        }'`
      )
    }

    return monthlyUsageMetrics
  }

  private transformMonthlyUsageMetrics(
    monthlyUsageMetrics: Array<ApiUsageMetrics>
  ): { [key: string]: number } {
    const [activeRuleInstancesCount, tenantSeatsCount] = [
      CUSTOM_API_USAGE_METRIC_NAMES.ACTIVE_RULE_INSTANCES_COUNT_METRIC_NAME,
      CUSTOM_API_USAGE_METRIC_NAMES.TENANT_SEATS_COUNT_METRIC_NAME,
    ].map((metricName) => this.getMaxUsage(monthlyUsageMetrics, metricName))

    return {
      [CUSTOM_API_USAGE_METRIC_NAMES.TRANSACTION_COUNT_METRIC_NAME]:
        this.monthlyCounts.transactionsCount,
      [CUSTOM_API_USAGE_METRIC_NAMES.TRANSACTION_EVENTS_COUNT_METRIC_NAME]:
        this.monthlyCounts.transactionEventsCount,
      [CUSTOM_API_USAGE_METRIC_NAMES.USERS_COUNT_METRIC_NAME]:
        this.monthlyCounts.usersCount,
      [CUSTOM_API_USAGE_METRIC_NAMES.ACTIVE_RULE_INSTANCES_COUNT_METRIC_NAME]:
        activeRuleInstancesCount,
      [CUSTOM_API_USAGE_METRIC_NAMES.IBAN_RESOLUTION_COUNT_METRIC_NAME]:
        this.monthlyCounts.ibanResolutinosCount,
      [CUSTOM_API_USAGE_METRIC_NAMES.SANCTIONS_SEARCHES_COUNT_METRIC_NAME]:
        this.monthlyCounts.sanctionsChecksCount,
      [CUSTOM_API_USAGE_METRIC_NAMES.TENANT_SEATS_COUNT_METRIC_NAME]:
        tenantSeatsCount,
    }
  }

  private transformDailyUsageMetrics(apiUsageMetrics: ApiUsageMetrics[]): {
    [key: string]: string | number
  } {
    return [
      CUSTOM_API_USAGE_METRIC_NAMES.TRANSACTION_COUNT_METRIC_NAME,
      CUSTOM_API_USAGE_METRIC_NAMES.TRANSACTION_EVENTS_COUNT_METRIC_NAME,
      CUSTOM_API_USAGE_METRIC_NAMES.USERS_COUNT_METRIC_NAME,
      CUSTOM_API_USAGE_METRIC_NAMES.ACTIVE_RULE_INSTANCES_COUNT_METRIC_NAME,
      CUSTOM_API_USAGE_METRIC_NAMES.IBAN_RESOLUTION_COUNT_METRIC_NAME,
      CUSTOM_API_USAGE_METRIC_NAMES.SANCTIONS_SEARCHES_COUNT_METRIC_NAME,
      CUSTOM_API_USAGE_METRIC_NAMES.TENANT_SEATS_COUNT_METRIC_NAME,
    ].reduce((obj, metricName) => {
      obj[metricName] =
        apiUsageMetrics.find((metric) => metric.name === metricName)?.value ?? 0
      return obj
    }, {} as { [key: string]: string | number })
  }

  private calulateTotalUsageMetrics(
    usageMetrics: ApiUsageMetrics[],
    fieldName: string
  ) {
    return usageMetrics.reduce((acc, metric) => {
      if (
        metric.name === fieldName &&
        metric.value != null &&
        typeof metric.value === 'number'
      ) {
        return acc + metric.value
      }
      return acc
    }, 0)
  }

  private getMaxUsage(usageMetrics: ApiUsageMetrics[], fieldName: string) {
    const maxUsage = usageMetrics.reduce((acc, metric) => {
      if (
        metric.name === fieldName &&
        metric.value != null &&
        typeof metric.value === 'number'
      ) {
        return Math.max(acc, metric.value)
      }
      return acc
    }, 0)

    return maxUsage
  }
}
