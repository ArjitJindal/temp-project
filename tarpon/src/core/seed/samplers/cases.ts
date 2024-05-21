import { last, uniq, uniqBy } from 'lodash'
import { v4 as uuid4 } from 'uuid'
import { compile } from 'handlebars'
import { randomBool } from 'fp-ts/Random'
import { getRuleInstance, transactionRules, userRules } from '../data/rules'
import { sampleTimestamp } from './timestamp'
import { Case } from '@/@types/openapi-internal/Case'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { Alert } from '@/@types/openapi-internal/Alert'
import { pickRandom, randomInt, randomSubset } from '@/core/seed/samplers/prng'
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
import { getChecklistTemplate } from '@/core/seed/data/checklists'
import { ChecklistItemValue } from '@/@types/openapi-internal/ChecklistItemValue'
import { RULE_NATURES } from '@/@types/openapi-internal-custom/RuleNature'
import { PRIORITYS } from '@/@types/openapi-internal-custom/Priority'
import { CHECKLIST_DONE_STATUSS } from '@/@types/openapi-internal-custom/ChecklistDoneStatus'
import { PaymentMethod } from '@/@types/tranasction/payment-type'
import { uniqObjects } from '@/utils/object'

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
  user: InternalBusinessUser | InternalConsumerUser
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
        case 'Fraud':
          return 'This case looks suspicious from a Fraud perspective due to a steadily increasing transaction amount at the same time daily.'
        case 'Terrorist financing':
          return 'This user is potentially financing terrorism.'
        case 'Suspicious activity reported (SAR)':
          return 'The case has been closed as an SAR has been submitted to the FNTT.'
        case 'Investigation completed':
          return `The investigation was completed on ${new Date().toLocaleDateString()}.`
        default:
          return `${reason}.`
      }
    })
    .join(' ')

  return `The following case has been closed for ${name}, ${country}. ${
    websites && websites?.length > 0
      ? `\nWebsites: ${websites?.join(',')}.`
      : ''
  } 
${footer}`
}

export function sampleTransactionUserCases(params: {
  transactions: InternalTransaction[]
  userId: string
  origin?: InternalBusinessUser | InternalConsumerUser
  destination?: InternalBusinessUser | InternalConsumerUser
}): Case[] {
  const { transactions, origin, destination } = params
  if (transactions.length === 0) {
    return []
  }

  let user = destination
  let userType = 'DESTINATION'
  let userId = destination?.userId
  if (origin) {
    user = origin
    userType = 'ORIGIN'
    userId = origin?.userId
  }

  const caseTransactions = transactions.filter(
    (transaction) => transaction[`${userType.toLowerCase()}UserId`] === userId
  )

  let ruleHits = uniqBy(
    caseTransactions.flatMap((t) => t.hitRules),
    'ruleInstanceId'
  ).filter((rh) => {
    if (rh.ruleHitMeta?.hitDirections?.includes('ORIGIN') && origin) {
      return true
    } else if (
      rh.ruleHitMeta?.hitDirections?.includes('DESTINATION') &&
      destination
    ) {
      return true
    }
    return false
  })

  ruleHits = ruleHits.concat(user?.hitRules ?? [])

  return RULE_NATURES.map((nature): Case => {
    const caseStatus = pickRandom(
      CASE_STATUSS.filter((s) => !isStatusInReview(s))
    )

    const reasons = randomSubset<CaseReasons>([
      'Anti-money laundering',
      'Documents collected',
      'Fraud',
      'Terrorist financing',
      'Suspicious activity reported (SAR)',
    ])
    const caseId = `C-${counter++}`
    return {
      caseId,
      caseType: 'SYSTEM',
      caseStatus,
      createdTimestamp: sampleTimestamp(),
      latestTransactionArrivalTimestamp: sampleTimestamp(),
      comments: [],
      caseTransactionsCount: caseTransactions.length,
      statusChanges: getStatusChangesObject(
        caseStatus ?? 'OPEN',
        getRandomUser().assigneeUserId
      ),
      assignments: getRandomUsers(),
      reviewAssignments: getRandomUsers(),
      updatedAt: sampleTimestamp(),
      lastStatusChange:
        caseStatus === 'CLOSED' && user
          ? {
              reason: reasons,
              userId: params.userId,
              timestamp: sampleTimestamp(),
              comment: generateNarrative(
                ruleHits.map((r) => r.ruleDescription),
                reasons,
                user
              ),
            }
          : undefined,
      priority: pickRandom(['P1', 'P2', 'P3', 'P4']),
      relatedCases: [],
      caseUsers: {
        origin,
        destination,
        originUserRiskLevel:
          origin?.drsScore?.manualRiskLevel ??
          origin?.drsScore?.derivedRiskLevel,
        destinationUserRiskLevel:
          destination?.drsScore?.manualRiskLevel ??
          destination?.drsScore?.derivedRiskLevel,
        originUserDrsScore: origin?.drsScore?.drsScore,
        destinationUserDrsScore: destination?.drsScore?.drsScore,
      },
      caseAggregates: {
        originPaymentMethods:
          uniq(
            caseTransactions
              .filter((t) => t.originPaymentDetails?.method)
              .map((t) => t.originPaymentDetails?.method) as PaymentMethod[]
          ) ?? [],
        destinationPaymentMethods:
          uniq(
            caseTransactions
              .filter((t) => t.destinationPaymentDetails?.method)
              .map(
                (t) => t.destinationPaymentDetails?.method
              ) as PaymentMethod[]
          ) ?? [],
        tags: uniqObjects(caseTransactions.flatMap((t) => t.tags ?? [])),
      },

      caseTransactionsIds: caseTransactions.map((t) => t.transactionId),
      alerts: ruleHits
        .filter((rh) => rh.nature === nature)
        .map((ruleHit) => {
          const ruleInstance = getRuleInstance(ruleHit.ruleInstanceId)

          const alertTransactions =
            ruleInstance.type === 'USER'
              ? []
              : caseTransactions.filter(
                  (t) =>
                    !!t.hitRules.find(
                      (hr) => hr.ruleInstanceId === ruleHit.ruleInstanceId
                    )
                )

          return sampleAlert({
            caseId,
            ruleHit,
            transactions: alertTransactions,
          })
        }),
    }
  }).filter((c) => c.alerts && c.alerts.length > 0)
}

export function sampleAlert(params: {
  caseId: string
  ruleHit: HitRulesDetails
  transactions: InternalTransaction[]
}): Alert {
  const createdTimestamp = sampleTimestamp(3600 * 24 * 1000 * 30)
  const alertStatus = pickRandom([
    'OPEN',
    'OPEN',
    'OPEN',
    'OPEN',
    'OPEN',
    'CLOSED',
    'REOPENED',
  ]) as AlertStatus

  const statusChanges = getStatusChangesObject(
    alertStatus ?? 'OPEN',
    getRandomUser().assigneeUserId,
    true
  )
  const checklistTemplateId = getRuleInstance(
    params.ruleHit.ruleInstanceId
  ).checklistTemplateId
  const isFirstPaymentRule = params.ruleHit.ruleId === 'R-1'
  const transactions = params.transactions
  const transactionIds = isFirstPaymentRule
    ? [transactions[0].transactionId]
    : transactions.map((t) => t.transactionId)

  return {
    ...params.ruleHit,
    alertId: `A-${alertCounter++}`,
    createdTimestamp: createdTimestamp,
    latestTransactionArrivalTimestamp: createdTimestamp - 3600 * 1000,
    caseId: params.caseId,
    alertStatus,
    ruleInstanceId: params.ruleHit.ruleInstanceId,
    numberOfTransactionsHit: params.transactions.length,
    priority: pickRandom(PRIORITYS),
    transactionIds,
    ruleQaStatus:
      randomBool() && alertStatus === 'CLOSED'
        ? pickRandom(CHECKLIST_STATUSS)
        : undefined,
    ruleChecklistTemplateId: checklistTemplateId,
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
    ruleChecklist: checklistTemplateId
      ? getChecklistTemplate(checklistTemplateId).categories.flatMap(
          (category): ChecklistItemValue[] =>
            category.checklistItems.map(
              (cli): ChecklistItemValue => ({
                checklistItemId: cli.id,
                done:
                  alertStatus === 'CLOSED'
                    ? 'DONE'
                    : pickRandom(CHECKLIST_DONE_STATUSS),
              })
            )
        )
      : undefined,
    ruleNature: userRules()
      .concat(transactionRules())
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
        .subtract(Math.floor(randomInt(alerts ? 150 : 400)), 'minute')
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
          .subtract(Math.floor(randomInt(alerts ? 150 : 400)), 'minute')
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

export const sampleAuditLogForStatusChange = (caseItem: Case) => {
  const reasons = randomSubset<CaseReasons>([
    'Anti-money laundering',
    'Documents collected',
    'Fraud',
    'Terrorist financing',
    'Suspicious activity reported (SAR)',
  ])
  return {
    action: 'UPDATE',
    auditlogId: uuid4(),
    entityId: caseItem.caseId,
    newImage: {
      reason: reasons,
      caseStatus: caseItem.caseStatus,
    },
    oldImage: {},
    subtype: 'STATUS_CHANGE',
    timestamp: Date.now(),
    type: 'CASE',
  }
}
