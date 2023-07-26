import { uniq } from 'lodash'
import { sampleTimestamp } from './timestamp'
import { Case } from '@/@types/openapi-internal/Case'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { Alert } from '@/@types/openapi-internal/Alert'
import { pickRandom, randomSubset } from '@/utils/prng'
import { HitRulesDetails } from '@/@types/openapi-internal/HitRulesDetails'
import { CASE_CLOSING_REASONSS } from '@/@types/openapi-internal-custom/CaseClosingReasons'
import { CASE_STATUSS } from '@/@types/openapi-internal-custom/CaseStatus'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { CaseClosingReasons } from '@/@types/openapi-internal/CaseClosingReasons'
import { isStatusInReview } from '@/utils/helpers'

let counter = 1
let alertCounter = 1

export function generateNarrative(
  ruleDescriptions: string[],
  reasons: CaseClosingReasons[],
  user: InternalBusinessUser | InternalConsumerUser,
  narrativeStatements?: string
) {
  let name: string
  let country: string | undefined
  let websites: string[] | undefined
  if (user.type === 'CONSUMER') {
    name = `${user.userDetails?.name.firstName} ${user.userDetails?.name.lastName}`
    country = `${user.userDetails?.countryOfResidence}`
    websites = []
  } else {
    name = user.legalEntity.companyGeneralDetails.legalName
    country = user.legalEntity.companyRegistrationDetails?.registrationCountry
    websites = user.legalEntity.contactDetails?.websites
  }
  const footer = reasons
    .map((reason) => {
      switch (reason) {
        case 'Anti-money laundering':
          return 'This case looks suspicious from an AML perspective.'
        case 'Documents collected':
          return 'Documents have been collected from the user.'
        case 'False positive':
          return 'This case can be closed as no significant suspicious activity was found upon investigation.'
        case 'Fraud':
          return 'This case looks suspicious from a Fraud perspective.'
        case 'Terrorist financing':
          return 'This user is potentially financing terrorism.'
        case 'Suspicious activity reported (SAR)':
          return 'The case has been closed as an SAR has been raised.'
        default:
          return 'Investigation completed.'
      }
    })
    .join(' ')

  return `The following case has been closed for ${name}, ${country}. ${
    websites && websites?.length > 0 ? `\nWebsites: ${websites?.join(',')}` : ''
  }. ${narrativeStatements}
Alerts were generated due to: ${ruleDescriptions
    .map((r) => r.charAt(0).toLowerCase() + r.slice(1))
    .join(', ')}.  
${footer}`
}

export function sampleUserCase(
  params: {
    transactions: InternalTransaction[]
    userId: string
    origin?: InternalBusinessUser | InternalConsumerUser
    destination?: InternalBusinessUser | InternalConsumerUser
  },
  seed?: number
): Case {
  const { transactions, origin, destination } = params

  const ruleHits = uniq(transactions.flatMap((t) => t.hitRules)).filter(
    (rh) => {
      if (rh.ruleHitMeta?.hitDirections?.includes('ORIGIN') && origin) {
        return true
      }
      if (
        rh.ruleHitMeta?.hitDirections?.includes('DESTINATION') &&
        destination
      ) {
        return true
      }
      return false
    }
  )

  let user = destination
  if (origin) {
    user = origin
  }

  const caseId = `C-${counter}`
  counter++
  const caseStatus = pickRandom(
    CASE_STATUSS.filter((s) => !isStatusInReview(s)),
    seed
  )
  const reasons = randomSubset(CASE_CLOSING_REASONSS)
  return {
    caseId: caseId,
    caseStatus,
    createdTimestamp: sampleTimestamp(seed),
    latestTransactionArrivalTimestamp: sampleTimestamp(seed) + 3600 * 1000,
    comments: [],
    caseTransactionsCount: transactions.length,
    assignments: [],
    statusChanges: [],
    lastStatusChange:
      caseStatus === 'CLOSED' && user
        ? {
            reason: reasons,
            userId: params.userId,
            timestamp: sampleTimestamp(seed),
            otherReason: generateNarrative(
              ruleHits.map((r) => r.ruleDescription),
              reasons,
              user
            ),
          }
        : undefined,
    priority: pickRandom(['P1', 'P2', 'P3', 'P4'], seed),
    relatedCases: [],
    caseUsers: {
      origin,
      destination,
    },
    caseTransactions: transactions,
    caseTransactionsIds: transactions.map((t) => t.transactionId!),
    alerts: ruleHits.map((ruleHit, i) =>
      sampleAlert(
        {
          caseId,
          ruleHit,
          transactions: transactions.filter(
            (t) =>
              !!t.hitRules.find(
                (hr) => hr.ruleInstanceId === ruleHit.ruleInstanceId
              )
          ),
        },
        i * 0.001
      )
    ),
  }
}

export function sampleAlert(
  params: {
    caseId: string
    ruleHit: HitRulesDetails
    transactions: InternalTransaction[]
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
    alertStatus: pickRandom(
      ['OPEN', 'OPEN', 'OPEN', 'OPEN', 'OPEN', 'CLOSED', 'REOPENED'],
      Math.random()
    ),
    ruleInstanceId: params.ruleHit.ruleInstanceId,
    numberOfTransactionsHit: params.transactions.length,
    priority: pickRandom(['P1', 'P2', 'P3', 'P4'], Math.random()),
    transactionIds: params.transactions.map((t) => t.transactionId),
  }
}
