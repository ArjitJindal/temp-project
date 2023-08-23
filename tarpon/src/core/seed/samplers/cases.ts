import { last, uniq } from 'lodash'
import { compile } from 'handlebars'
import { uuid4 } from '@sentry/utils'
import { randomBool } from 'fp-ts/Random'
import { transactionRules, userRules } from '../data/rules'
import { sampleTimestamp } from './timestamp'
import { Case } from '@/@types/openapi-internal/Case'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { Alert } from '@/@types/openapi-internal/Alert'
import { pickRandom, randomSubset } from '@/utils/prng'
import { HitRulesDetails } from '@/@types/openapi-internal/HitRulesDetails'
import { CASE_REASONSS } from '@/@types/openapi-internal-custom/CaseReasons'
import { CASE_STATUSS } from '@/@types/openapi-internal-custom/CaseStatus'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { CaseReasons } from '@/@types/openapi-internal/CaseReasons'
import { isStatusInReview } from '@/utils/helpers'
import { AlertStatus } from '@/@types/openapi-internal/AlertStatus'
import { CHECKLIST_STATUSS } from '@/@types/openapi-internal-custom/ChecklistStatus'
import { getRandomUser, getRandomUsers } from '@/core/seed/samplers/accounts'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import dayjs from '@/utils/dayjs'

let counter = 1
let alertCounter = 1

const exampleNarrative = `This SAR is being filed due to suspicious activity involving unexplained large cash deposits and potential structuring of transactions, indicating possible illicit financial behavior. The following details highlight the suspicious nature of the activities observed:

1. Unexplained Large Cash Deposits:
Over the past six months, the subject, {{ name }}, has made a series of unusually large cash deposits into his personal bank account. These deposits, each exceeding $10,000, are significantly higher than his usual deposit amounts. The sources of these funds remain unexplained and raise suspicions of illicit activities such as money laundering or unreported income.

2. Structuring of Transactions:
{{ name }} has also engaged in a pattern of structuring transactions by consistently making multiple cash deposits just below the $10,000 threshold that triggers the reporting requirement for the bank. This behavior suggests an attempt to evade reporting and conceal the true nature and extent of his financial transactions.

3. Inconsistent Business Activities:
Upon investigation, it was discovered that {{ name }} is self-employed and operates a small retail business. However, the reported income from his business does not align with the significant cash deposits made into his personal account. The lack of a legitimate explanation for the substantial influx of funds raises suspicions regarding the true source of these deposits.

4. Evasive Behavior:
During routine inquiries by bank personnel, {{ name }} exhibited evasive behavior, providing vague or inconsistent explanations for the origin of the cash deposits. His reluctance to provide transparent and verifiable information further contributes to the suspicion surrounding his financial activities.

5. Lack of Tangible Assets or Investments:
Despite the substantial cash deposits, there is no evidence of corresponding investments, significant purchases, or other substantial financial transactions associated with {{ name }}. The absence of a valid explanation for the large cash influx raises concerns regarding potential money laundering or undisclosed income.
Based on the aforementioned suspicious activity, there is reasonable suspicion that {{ name }} may be involved in illicit financial activities, such as money laundering or tax evasion. This report is being filed to notify the appropriate authorities and provide relevant information for further investigation into the matter.
`

export function generateNarrative(
  ruleDescriptions: string[],
  reasons: CaseReasons[],
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

  if (!reasons.includes('False positive')) {
    const tpl = compile(exampleNarrative)
    return tpl({ user: name })
  }

  const footer = reasons
    .map((reason) => {
      switch (reason) {
        case 'Anti-money laundering':
          return 'This case looks suspicious from an AML perspective due to unexplained large cash deposits and the structuring of transactions.'
        case 'Documents collected':
          return 'Identity and proof-of-fund documents have been collected from the user and align with our KYC checks.'
        case 'False positive':
          return 'This case can be closed as no significant suspicious activity was found upon investigation.'
        case 'Fraud':
          return 'This case looks suspicious from a Fraud perspective due to a steadily increasing transaction amount at the same time daily.'
        case 'Terrorist financing':
          return 'This user is potentially financing terrorism.'
        case 'Suspicious activity reported (SAR)':
          return 'The case has been closed as an SAR has been submitted to the FNTT.'
        default:
          return 'Investigation completed.'
      }
    })
    .join(' ')

  return `The following case has been closed for ${name}, ${country}. ${
    websites && websites?.length > 0 ? `\nWebsites: ${websites?.join(',')}` : ''
  } ${narrativeStatements}. 
${footer}`
}

export function sampleTransactionUserCase(
  params: {
    transactions: InternalTransaction[]
    userId: string
    origin?: InternalBusinessUser | InternalConsumerUser
    destination?: InternalBusinessUser | InternalConsumerUser
  },
  seed?: number
): Case {
  const { transactions, origin, destination } = params

  let ruleHits = uniq(transactions.flatMap((t) => t.hitRules)).filter((rh) => {
    if (rh.ruleHitMeta?.hitDirections?.includes('ORIGIN') && origin) {
      return true
    }
    if (rh.ruleHitMeta?.hitDirections?.includes('DESTINATION') && destination) {
      return true
    }
    return false
  })

  let user = destination
  if (origin) {
    user = origin
  }

  ruleHits = ruleHits.concat(user?.hitRules ?? [])
  const caseId = `C-${counter}`

  counter++
  const caseStatus = pickRandom(
    CASE_STATUSS.filter((s) => !isStatusInReview(s)),
    seed
  )
  const reasons = randomSubset(CASE_REASONSS)
  return {
    caseId: caseId,
    caseType: 'SYSTEM',
    caseStatus,
    createdTimestamp: sampleTimestamp(seed),
    latestTransactionArrivalTimestamp: sampleTimestamp(seed) + 3600 * 1000,
    comments: [],
    caseTransactionsCount: transactions.length,
    statusChanges: getStatusChangesObject(
      caseStatus ?? 'OPEN',
      getRandomUser().assigneeUserId
    ),
    assignments: getRandomUsers(),
    reviewAssignments: getRandomUsers(),
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
  const alertStatus = pickRandom(
    ['OPEN', 'OPEN', 'OPEN', 'OPEN', 'OPEN', 'CLOSED', 'REOPENED'],
    Math.random()
  ) as AlertStatus

  const statusChanges = getStatusChangesObject(
    alertStatus ?? 'OPEN',
    getRandomUser().assigneeUserId,
    true
  )

  return {
    ...params.ruleHit,
    alertId: alertId,
    createdTimestamp: createdTimestamp,
    latestTransactionArrivalTimestamp: createdTimestamp - 3600 * 1000,
    caseId: params.caseId,
    alertStatus,
    ruleInstanceId: params.ruleHit.ruleInstanceId,
    numberOfTransactionsHit: params.transactions.length,
    priority: pickRandom(['P1', 'P2', 'P3', 'P4'], Math.random()),
    transactionIds: params.transactions.map((t) => t.transactionId),
    ruleQaStatus: pickRandom(CHECKLIST_STATUSS),
    updatedAt: sampleTimestamp(),
    statusChanges: getStatusChangesObject(
      alertStatus ?? 'OPEN',
      getRandomUser().assigneeUserId,
      true
    ),
    lastStatusChange: last(statusChanges),
    assignments: getRandomUsers(),
    qaAssignment: getRandomUsers(),
    reviewAssignments: getRandomUsers(),
    ruleChecklist: [
      {
        checklistItemId: uuid4(),
        done: randomBool(),
        status: pickRandom(CHECKLIST_STATUSS),
      },
    ],
    ruleNature: userRules
      .concat(transactionRules)
      .find((p) => p.ruleInstanceId === params.ruleHit.ruleInstanceId)?.nature,
  }
}

const getStatusChangesObject = (
  caseStatus: CaseStatus,
  userId: string,
  alerts?: boolean
): CaseStatusChange[] => {
  const statusChanges: CaseStatusChange[] = []
  if (caseStatus === 'CLOSED') {
    statusChanges.push({
      caseStatus: 'CLOSED',
      timestamp: dayjs()
        .subtract(Math.floor(Math.random() * (alerts ? 150 : 400)), 'minute')
        .valueOf(),
      reason: randomSubset(CASE_REASONSS),
      userId,
    })
    return statusChanges
  }

  if (caseStatus !== 'OPEN') {
    let insterted = false
    if (
      pickRandom([true, false]) &&
      caseStatus !== 'OPEN_IN_PROGRESS' &&
      caseStatus.includes('OPEN')
    ) {
      statusChanges.push({
        caseStatus: 'OPEN_IN_PROGRESS',
        timestamp: dayjs()
          .subtract(Math.floor(Math.random() * (alerts ? 150 : 400)), 'minute')
          .valueOf(),
        userId,
      })
      insterted = true
    }
    if (!insterted || caseStatus !== 'OPEN_IN_PROGRESS') {
      statusChanges.push({
        caseStatus: caseStatus,
        timestamp: dayjs().valueOf(),
        userId,
      })
    }
  }
  return statusChanges
}
