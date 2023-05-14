import _ from 'lodash'
import { sampleTimestamp } from './timestamp'
import { Case } from '@/@types/openapi-internal/Case'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { Alert } from '@/@types/openapi-internal/Alert'
import { pickRandom, randomInt } from '@/utils/prng'
import { HitRulesDetails } from '@/@types/openapi-internal/HitRulesDetails'

let counter = 1
let alertCounter = 1
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

  const ruleHits = _.uniq(transactions.flatMap((t) => t.hitRules))

  const caseId = `C-${counter}`
  counter++
  return {
    caseId: caseId,
    caseStatus: pickRandom(['OPEN', 'CLOSED', 'REOPENED'], seed),
    createdTimestamp: sampleTimestamp(seed),
    latestTransactionArrivalTimestamp: sampleTimestamp(seed) + 3600 * 1000,
    comments: [],
    caseTransactionsCount: transactions.length,
    assignments: [],
    statusChanges: [],
    priority: pickRandom(['P1', 'P2', 'P3', 'P4'], seed),
    relatedCases: [],
    caseUsers: {
      origin: undefined,
      destination: undefined,
      ...user,
    },
    caseTransactions: transactions,
    caseTransactionsIds: transactions.map((t) => t.transactionId!),
    alerts: ruleHits.map((ruleHit, i) =>
      sampleAlert({ caseId, ruleHit }, i * 0.001)
    ),
  }
}

export function sampleAlert(
  params: {
    caseId: string
    ruleHit: HitRulesDetails
  },
  seed?: number
): Alert {
  const createdTimestamp = sampleTimestamp(seed, 3600 * 24 * 1000 * 30)
  const alertId = `A-${alertCounter}`
  alertCounter++
  return {
    ...params.ruleHit,
    alertId: alertId,
    createdTimestamp: createdTimestamp,
    latestTransactionArrivalTimestamp: createdTimestamp - 3600 * 1000,
    caseId: params.caseId,
    alertStatus: pickRandom(['OPEN', 'CLOSED', 'REOPENED'], seed),
    ruleInstanceId: params.ruleHit.ruleInstanceId,
    numberOfTransactionsHit: randomInt(seed, 100),
    priority: pickRandom(['P1', 'P2', 'P3', 'P4'], seed),
  }
}
