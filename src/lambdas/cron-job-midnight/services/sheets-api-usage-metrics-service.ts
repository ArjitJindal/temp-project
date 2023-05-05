import {
  GoogleSpreadsheet,
  GoogleSpreadsheetRow,
  GoogleSpreadsheetWorksheet,
} from 'google-spreadsheet'
import { MongoClient } from 'mongodb'
import _ from 'lodash'
import {
  ApiUsageMetrics,
  ApiUsageMetricsService,
} from './api-usage-metrics-service'
import dayjs from '@/utils/dayjs'
import { METRICS_COLLECTION } from '@/utils/mongoDBUtils'
import { CUSTOM_API_USAGE_METRIC_NAMES } from '@/core/cloudwatch/metrics'
import { logger } from '@/core/logger'
import { Tenant } from '@/services/accounts'
import { getSecret } from '@/utils/secrets-manager'
import { getDynamoDbClient } from '@/utils/dynamodb'

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

export class SheetsApiUsageMetricsService {
  private dailyUsageMetricsSheet?: GoogleSpreadsheetWorksheet
  private monthlyUsageMetricsSheet?: GoogleSpreadsheetWorksheet
  private tenant: Tenant
  private mongoDb: MongoClient
  private tenantId: string

  constructor(tenant: Tenant, connections: { mongoDb: MongoClient }) {
    this.tenant = tenant
    this.tenantId = tenant.id
    this.mongoDb = connections.mongoDb
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

  public async initialize() {
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

  private getDailyUsageMetadata(
    startTimestamp: number,
    endTimestamp: number
  ): {
    [key: string]: string | number
  } {
    return {
      [META_DATA_HEADERS_DAILY.START_TIMESTAMP]: startTimestamp,
      [META_DATA_HEADERS_DAILY.END_TIMESTAMP]: endTimestamp,
      [META_DATA_HEADERS_DAILY.DATE]:
        dayjs(startTimestamp).format('YYYY-MM-DD'),
      [META_DATA_HEADERS_DAILY.TENANT_ID]: this.tenantId,
      [META_DATA_HEADERS_DAILY.TENANT_NAME]: this.tenant.name,
      [META_DATA_HEADERS_DAILY.REGION]: this.tenant.region ?? 'local',
    }
  }

  private getMonthlyUsageMetadata(
    startTimestamp: number,
    endTimestamp: number
  ): {
    [key: string]: string | number
  } {
    return {
      [META_DATA_HEADERS_MONTHLY.START_TIMESTAMP]: dayjs(startTimestamp)
        .startOf('month')
        .valueOf(),
      [META_DATA_HEADERS_MONTHLY.END_TIMESTAMP]: endTimestamp,
      [META_DATA_HEADERS_MONTHLY.MONTH]: dayjs(startTimestamp).format('MMMM'),
      [META_DATA_HEADERS_MONTHLY.YEAR]: dayjs(startTimestamp).format('YYYY'),
      [META_DATA_HEADERS_MONTHLY.TENANT_ID]: this.tenantId,
      [META_DATA_HEADERS_MONTHLY.TENANT_NAME]: this.tenant.name,
      [META_DATA_HEADERS_MONTHLY.REGION]: this.tenant.region ?? 'local',
    }
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
          data.start.toString() &&
        row[META_DATA_HEADERS_DAILY.TENANT_ID].toString() ===
          data.tenantId.toString()
    )

    if (row !== -1) {
      rows[row] = _.merge(rows[row], data)
      await rows[row].save()
    } else {
      await this.dailyUsageMetricsSheet.addRow(data)
    }

    await this.dailyUsageMetricsSheet.addRow(data)
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
      tenantRows[tenantRow] = _.merge(tenantRows[tenantRow], data)
      await tenantRows[tenantRow].save()
    } else {
      await this.monthlyUsageMetricsSheet.addRow(data)
    }
  }

  public async updateUsageMetrics(
    startTimestamp: number,
    endTimestamp: number
  ) {
    const dailyUsageMetrics = await this.getDailyUsageMetricsData(
      startTimestamp,
      endTimestamp
    )

    const transformedDailyUsageMetrics =
      this.transformDailyUsageMetrics(dailyUsageMetrics)

    await this.publishDailyUsageMetrics(
      _.merge(
        this.getDailyUsageMetadata(startTimestamp, endTimestamp),
        transformedDailyUsageMetrics
      )
    )

    const monthlyUsageMetrics = await this.getMonthlyUsageMetricsData(
      startTimestamp,
      endTimestamp
    )

    const transformedMonthlyUsageMetrics =
      await this.transformMonthlyUsageMetrics(monthlyUsageMetrics)

    await this.publishMonthlyUsageMetrics(
      _.merge(
        this.getMonthlyUsageMetadata(startTimestamp, endTimestamp),
        transformedMonthlyUsageMetrics
      )
    )
  }

  private async getDailyUsageMetricsData(
    startTimestamp: number,
    endTimestamp: number
  ): Promise<Array<ApiUsageMetrics>> {
    const metricsCollection = this.mongoDb
      .db()
      .collection<ApiUsageMetrics>(METRICS_COLLECTION(this.tenantId))

    const dailyUsageMetrics = await metricsCollection
      .find({ startTimestamp, endTimestamp })
      .toArray()

    if (!dailyUsageMetrics?.length) {
      throw new Error(
        `No daily usage metrics found for tenant '${this.tenantId}' with startTimestamp '${startTimestamp}' and endTimestamp '${endTimestamp}'`
      )
    }

    return dailyUsageMetrics
  }

  private async getMonthlyUsageMetricsData(
    startTimestamp: number,
    endTimestamp: number
  ): Promise<Array<ApiUsageMetrics>> {
    const metricsCollectionName = METRICS_COLLECTION(this.tenantId)

    const metricsCollection = this.mongoDb
      .db()
      .collection<ApiUsageMetrics>(metricsCollectionName)

    const monthlyUsageMetrics = await metricsCollection
      .find({
        startTimestamp: {
          $gte: dayjs(startTimestamp).startOf('month').valueOf(),
        },
        endTimestamp: {
          $lte: endTimestamp,
        },
      })
      .toArray()

    if (!monthlyUsageMetrics?.length) {
      throw new Error(
        `No monthly usage metrics found for tenant '${this.tenantId}' with startTimestamp '${startTimestamp}' and endTimestamp '${endTimestamp}'`
      )
    }

    return monthlyUsageMetrics
  }

  private async transformMonthlyUsageMetrics(
    monthlyUsageMetrics: Array<ApiUsageMetrics>
  ): Promise<{ [key: string]: number }> {
    const [activeRuleInstancesCount, tenantSeatsCount] = [
      CUSTOM_API_USAGE_METRIC_NAMES.ACTIVE_RULE_INSTANCES_COUNT_METRIC_NAME,
      CUSTOM_API_USAGE_METRIC_NAMES.TENANT_SEATS_COUNT_METRIC_NAME,
    ].map((metricName) => this.getMaxUsage(monthlyUsageMetrics, metricName))

    const dynamoDb = getDynamoDbClient()
    const apiUsageMetricsService = new ApiUsageMetricsService(
      this.tenant,
      { mongoDb: this.mongoDb, dynamoDb },
      {
        startTimestamp: dayjs().startOf('month').valueOf(),
        endTimestamp: dayjs().endOf('month').valueOf(),
      }
    )

    return {
      [CUSTOM_API_USAGE_METRIC_NAMES.TRANSACTION_COUNT_METRIC_NAME]:
        await apiUsageMetricsService.getTransactionsCount(),
      [CUSTOM_API_USAGE_METRIC_NAMES.TRANSACTION_EVENTS_COUNT_METRIC_NAME]:
        await apiUsageMetricsService.getTransactionsEventsCount(),
      [CUSTOM_API_USAGE_METRIC_NAMES.USERS_COUNT_METRIC_NAME]:
        await apiUsageMetricsService.getUsersCount(),
      [CUSTOM_API_USAGE_METRIC_NAMES.ACTIVE_RULE_INSTANCES_COUNT_METRIC_NAME]:
        activeRuleInstancesCount,
      [CUSTOM_API_USAGE_METRIC_NAMES.IBAN_RESOLUTION_COUNT_METRIC_NAME]:
        await apiUsageMetricsService.getNumberOfIbanResolutions(),
      [CUSTOM_API_USAGE_METRIC_NAMES.SANCTIONS_SEARCHES_COUNT_METRIC_NAME]:
        await apiUsageMetricsService.getNumberOfSanctionsChecks(),
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
