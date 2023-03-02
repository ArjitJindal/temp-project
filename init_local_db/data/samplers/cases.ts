import { sampleTimestamp } from './timestamp'
import { sampleGuid } from './id'
import { Case } from '@/@types/openapi-internal/Case'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { CaseTransaction } from '@/@types/openapi-internal/CaseTransaction'
import { transactionsToAlerts } from '@/services/alerts'

export function sampleTransactionCase(
  transaction: CaseTransaction,
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
    transactions: CaseTransaction[]
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
    alerts: Object.values(transactionsToAlerts(transactions, caseId)).map(
      (alert) => {
        return { alertId: `alert-${sampleGuid(seed)}`, ...alert }
      }
    ),
  }
}
