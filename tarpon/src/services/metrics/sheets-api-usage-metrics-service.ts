/**
 * SOME IMPORTANT NOTES: (Please read before making any changes)
 * 1. Make sure your spreadsheet has enough columns to store all headers (If not we need to add them manually or this will fail)
 * 2. If we are adding header make sure it does not breaks the existing data
 * 3. Do not change meta data headers, If you want to change them make sure you make a migration script to update the existing data otherwise it will break the existing data
 * 4. If you are adding new custom metric make sure you add it to the CUSTOM_API_USAGE_METRIC_NAMES object in cloudwatch/metrics.ts and always add it in last of the object
 */

import {
  GoogleSpreadsheet,
  GoogleSpreadsheetRow,
  GoogleSpreadsheetWorksheet,
} from 'google-spreadsheet'
import { JWT } from 'google-auth-library'
import { memoize, merge } from 'lodash'
import { BackoffOptions, backOff } from 'exponential-backoff'
import { DailyMetricStats, MonthlyMetricStats } from './utils'
import { CUSTOM_API_USAGE_METRIC_NAMES } from '@/core/cloudwatch/metrics'
import { TenantBasic } from '@/services/accounts'
import { getSecretByName } from '@/utils/secrets-manager'
import { mergeObjects } from '@/utils/object'
import { traceable } from '@/core/xray'
import { logger } from '@/core/logger'

const RETRY_OPTIONS: BackoffOptions = {
  startingDelay: 15 * 1000, // ms
  maxDelay: 120 * 1000, // ms
  jitter: 'full',
  numOfAttempts: 10,
  retry: (e, i) => {
    logger.warn(`Retry number ${i} for error: ${e.message}`)
    return true
  },
}

const DAILY_USAGE_METRICS_SHEET_TITLE = 'DailyUsageMetrics'
const MONTHLY_USAGE_METRICS_SHEET_TITLE = 'MonthlyUsageMetrics'

const META_DATA_HEADERS_DAILY = {
  DATE: 'Date',
  TENANT_ID: 'TenantId',
  TENANT_NAME: 'TenantName',
  REGION: 'Region',
}

const META_DATA_HEADERS_MONTHLY = {
  MONTH: 'Month',
  TENANT_ID: 'TenantId',
  TENANT_NAME: 'TenantName',
  REGION: 'Region',
}

const DEFAULT_METRIC_VALUES = Object.fromEntries(
  Object.values(CUSTOM_API_USAGE_METRIC_NAMES).map((v) => [v, 0])
)

const getAllUsageMetricsRows = memoize(
  async (cacheKey: string, sheet: GoogleSpreadsheetWorksheet) => {
    if (!sheet) {
      throw new Error(
        `Sheet ${cacheKey} is not initialized. Please call initialize() first.`
      )
    }
    return await sheet.getRows()
  }
)

@traceable
export class SheetsApiUsageMetricsService {
  private dailyUsageMetricsSheet?: GoogleSpreadsheetWorksheet
  private monthlyUsageMetricsSheet?: GoogleSpreadsheetWorksheet
  private tenant: TenantBasic
  private tenantId: string
  private googleSheetId: string

  constructor(tenant: TenantBasic, googleSheetId: string) {
    this.tenant = tenant
    this.tenantId = tenant.id
    this.googleSheetId = googleSheetId
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
      const errorMessage = (error as Error).message
      if (errorMessage.includes('Quota exceed')) {
        throw error
      }
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
    const secret = await getSecretByName('GoogleSheetsPrivateKey')
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL as string,
      key: secret.privateKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    const googleSpreadsheetService = new GoogleSpreadsheet(
      this.googleSheetId,
      serviceAccountAuth
    )

    await googleSpreadsheetService.loadInfo()

    const dailyUsageMetricsSheet =
      googleSpreadsheetService.sheetsByTitle[DAILY_USAGE_METRICS_SHEET_TITLE]

    if (!dailyUsageMetricsSheet) {
      throw new Error(
        `Sheet with title '${DAILY_USAGE_METRICS_SHEET_TITLE}' not found in spreadsheet '${this.googleSheetId}'`
      )
    }

    const monthlyUsageMetricsSheet =
      googleSpreadsheetService.sheetsByTitle[MONTHLY_USAGE_METRICS_SHEET_TITLE]

    if (!monthlyUsageMetricsSheet) {
      throw new Error(
        `Sheet with title '${MONTHLY_USAGE_METRICS_SHEET_TITLE}' not found in spreadsheet '${this.googleSheetId}'`
      )
    }

    this.dailyUsageMetricsSheet = dailyUsageMetricsSheet
    this.monthlyUsageMetricsSheet = monthlyUsageMetricsSheet
    await this.createHeadersIfNotExists('daily')
    await this.createHeadersIfNotExists('monthly')
  }

  public async initialize(): Promise<void> {
    await backOff(async () => {
      await this.initializePrivate()
    }, RETRY_OPTIONS)
  }

  private getDailyUsageMetadata(date: string): {
    [key: string]: string | number
  } {
    return {
      [META_DATA_HEADERS_DAILY.DATE]: date,
      [META_DATA_HEADERS_DAILY.TENANT_ID]: this.tenantId,
      [META_DATA_HEADERS_DAILY.TENANT_NAME]: this.tenant.name,
      [META_DATA_HEADERS_DAILY.REGION]: this.getRegion(),
      ...DEFAULT_METRIC_VALUES,
    }
  }

  private getMonthlyUsageMetadata(month: string): {
    [key: string]: string | number
  } {
    return {
      [META_DATA_HEADERS_MONTHLY.MONTH]: month,
      [META_DATA_HEADERS_MONTHLY.TENANT_ID]: this.tenantId,
      [META_DATA_HEADERS_MONTHLY.TENANT_NAME]: this.tenant.name,
      [META_DATA_HEADERS_MONTHLY.REGION]: this.getRegion(),
      ...DEFAULT_METRIC_VALUES,
    }
  }

  private getRegion(): string {
    return process.env.ENV === 'prod'
      ? (process.env.REGION as string)
      : process.env.ENV ?? 'local'
  }

  private async publishDailyUsageMetrics(
    dailyMetrics: DailyMetricStats
  ): Promise<void> {
    if (!this.dailyUsageMetricsSheet) {
      throw new Error(
        `Sheet daily is not initialized. Please call initialize() first.`
      )
    }

    const rows = await getAllUsageMetricsRows(
      `${this.googleSheetId}-DAILY`,
      this.dailyUsageMetricsSheet
    )
    const row = rows.findIndex(
      (row) =>
        row[META_DATA_HEADERS_DAILY.DATE].toString() === dailyMetrics.date &&
        row[META_DATA_HEADERS_DAILY.TENANT_ID].toString() === this.tenantId
    )
    const newRow = merge(
      this.getDailyUsageMetadata(dailyMetrics.date),
      ...dailyMetrics.values.map((value) => ({
        [value.metric.name]: value.value,
      }))
    )

    if (row > -1) {
      rows[row] = mergeObjects(rows[row], newRow as GoogleSpreadsheetRow)
      await rows[row].save()
    } else {
      await this.dailyUsageMetricsSheet.addRow(newRow)
    }
  }

  private async publishMonthlyUsageMetrics(
    monthlyMetrics: MonthlyMetricStats
  ): Promise<void> {
    if (!this.monthlyUsageMetricsSheet) {
      throw new Error(
        `Sheet monthly is not initialized. Please call initialize() first.`
      )
    }

    const tenantRows = await getAllUsageMetricsRows(
      `${this.googleSheetId}-MONTHLY`,
      this.monthlyUsageMetricsSheet
    )

    const tenantRow = tenantRows.findIndex((row) => {
      const rowData = row.toObject()

      return (
        rowData[META_DATA_HEADERS_MONTHLY.MONTH] === monthlyMetrics.month &&
        rowData[META_DATA_HEADERS_MONTHLY.TENANT_ID] === this.tenantId
      )
    })

    const newRow = merge(
      this.getMonthlyUsageMetadata(monthlyMetrics.month),
      ...monthlyMetrics.values.map((value) => ({
        [value.metric.name]: value.value,
      }))
    )

    if (tenantRow > -1) {
      tenantRows[tenantRow] = mergeObjects(
        tenantRows[tenantRow],
        newRow as GoogleSpreadsheetRow
      )

      await tenantRows[tenantRow].save()
    } else {
      await this.monthlyUsageMetricsSheet.addRow(newRow)
    }
  }

  public async updateUsageMetrics(
    dailyMetrics: DailyMetricStats[],
    monthlyMetrics: MonthlyMetricStats[]
  ): Promise<void> {
    for (const metric of dailyMetrics) {
      await backOff(
        async () => await this.publishDailyUsageMetrics(metric),
        RETRY_OPTIONS
      )
    }
    for (const metric of monthlyMetrics) {
      await backOff(
        async () => await this.publishMonthlyUsageMetrics(metric),
        RETRY_OPTIONS
      )
    }
  }
}
