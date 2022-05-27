import { CsvHeaderSettings } from '@/lambdas/phytoplankton-internal-api-handlers/services/export-service'
import { TransactionCaseManagement } from '@/@types/openapi-internal/TransactionCaseManagement'

export type DashboardTimeFrameType = 'YEAR' | 'WEEK' | 'MONTH' | 'DAY'
export const timeFrameValues = {
  YEAR: 'YEAR',
  MONTH: 'MONTH',
  DAY: 'DAY',
}

export type TransactionDashboardStats = {
  _id: string
  totalTransactions: number
  flaggedTransactions: number
  stoppedTransactions: number
}

export const TRANSACTION_EXPORT_HEADERS_SETTINGS: CsvHeaderSettings<TransactionCaseManagement> =
  {
    type: 'INCLUDE',
    transactionId: 'INCLUDE',
    timestamp: 'INCLUDE',
    transactionState: 'INCLUDE',
    originUserId: 'INCLUDE',
    destinationUserId: 'INCLUDE',
    originAmountDetails: {
      transactionAmount: 'INCLUDE',
      transactionCurrency: 'INCLUDE',
      country: 'INCLUDE',
    },
    destinationAmountDetails: {
      transactionAmount: 'INCLUDE',
      transactionCurrency: 'INCLUDE',
      country: 'INCLUDE',
    },
    originPaymentDetails: 'JSON',
    destinationPaymentDetails: 'JSON',
    productType: 'INCLUDE',
    promotionCodeUsed: 'INCLUDE',
    reference: 'INCLUDE',
    deviceData: {
      batteryLevel: 'INCLUDE',
      deviceLatitude: 'INCLUDE',
      deviceLongitude: 'INCLUDE',
      ipAddress: 'INCLUDE',
      deviceIdentifier: 'INCLUDE',
      vpnUsed: 'INCLUDE',
      operatingSystem: 'INCLUDE',
      deviceMaker: 'INCLUDE',
      deviceModel: 'INCLUDE',
      deviceYear: 'INCLUDE',
      appVersion: 'INCLUDE',
    },
    tags: 'JSON',
    executedRules: 'JSON',
    failedRules: 'JSON',
    comments: 'JSON',
    assignments: 'JSON',
    status: 'INCLUDE',
    statusChanges: 'JSON',
  }
