import { Case } from '@/@types/openapi-internal/Case'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { AlertsService } from '@/services/alerts'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { sampleTimestamp } from '@/core/seed/samplers/timestamp'
import { sampleGuid } from '@/core/seed/samplers/id'

export function sampleTransactionCase(
  transaction: InternalTransaction,
  seed?: number
): Case {
  return {
    caseId: `case-transaction-${sampleGuid(seed)}`,
    caseStatus: 'OPEN',
    createdTimestamp: sampleTimestamp(seed),
    latestTransactionArrivalTimestamp: sampleTimestamp(seed) + 3600 * 1000,
    comments: [],
    assignments: [],
    statusChanges: [],
    priority: 'P1',
    relatedCases: [],
    caseTransactionsIds: [transaction.transactionId!],
    caseTransactions: [transaction],
  }
}

export function sampleUserCase(
  params: {
    transactions: InternalTransaction[]
    user:
      | {
          origin: Business | User
        }
      | {
          destination: Business | User
        }
  },
  seed?: number
): Case {
  const { transactions, user } = params
  const createdAt = sampleTimestamp(seed)
  const caseId = `case-transaction-${sampleGuid(seed)}`
  return {
    caseId: `case-transaction-${sampleGuid(seed)}`,
    caseStatus: 'OPEN',
    createdTimestamp: createdAt,
    latestTransactionArrivalTimestamp: sampleTimestamp(seed) + 3600 * 1000,
    comments: [],
    assignments: [],
    statusChanges: [],
    priority: 'P1',
    relatedCases: [],
    caseUsers: {
      origin: undefined,
      destination: undefined,
      ...user,
    },
    caseTransactionsIds: transactions.map((t) => t.transactionId!),
    caseTransactions: transactions,
    alerts: AlertsService.transactionsToAlerts(transactions, caseId).map(
      (alert) => {
        return { alertId: `alert-${sampleGuid(seed)}`, ...alert }
      }
    ),
  }
}
