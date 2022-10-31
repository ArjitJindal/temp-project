import { sampleTimestamp } from './timestamp'
import { sampleGuid } from './id'
import { Case } from '@/@types/openapi-internal/Case'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'

export function sampleTransactionCase(
  transactionId: string,
  seed?: number
): Case {
  return {
    caseId: `case-transaction-${sampleGuid(seed)}`,
    caseType: 'TRANSACTION',
    caseStatus: 'OPEN',
    createdTimestamp: sampleTimestamp(seed),
    latestTransactionArrivalTimestamp: sampleTimestamp(seed) + 3600 * 1000,
    comments: [],
    assignments: [],
    statusChanges: [],
    priority: 'P1',
    relatedCases: [],
    caseTransactionsIds: [transactionId],
  }
}

export function sampleUserCase(
  params: {
    transactionIds: string[]
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
  const { transactionIds, user } = params
  return {
    caseId: `case-transaction-${sampleGuid(seed)}`,
    caseType: 'USER',
    caseStatus: 'OPEN',
    createdTimestamp: sampleTimestamp(seed),
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
    caseTransactionsIds: transactionIds,
  }
}
