import { last, uniq, uniqBy } from 'lodash'
import { v4 as uuid4 } from 'uuid'
import { compile } from 'handlebars'
import { getRiskLevelFromScore } from '@flagright/lib/utils'
import { getRuleInstance, transactionRules, userRules } from '../data/rules'
import { getSLAPolicyById } from '../data/sla'
import { ID_PREFIXES, TIME_BACK_TO } from '../data/seeds'
import { BaseSampler } from './base'
import { Case } from '@/@types/openapi-internal/Case'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { Alert } from '@/@types/openapi-internal/Alert'
import { HitRulesDetails } from '@/@types/openapi-internal/HitRulesDetails'
import { CASE_REASONSS } from '@/@types/openapi-internal-custom/CaseReasons'
import { CASE_STATUSS } from '@/@types/openapi-internal-custom/CaseStatus'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { CaseReasons } from '@/@types/openapi-internal/CaseReasons'
import { isStatusInReview, statusEscalated } from '@/utils/helpers'
import { AlertStatus } from '@/@types/openapi-internal/AlertStatus'
import { CHECKLIST_STATUSS } from '@/@types/openapi-internal-custom/ChecklistStatus'
import { getAccounts } from '@/core/seed/samplers/accounts'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import dayjs from '@/utils/dayjs'
import { getChecklistTemplate } from '@/core/seed/data/checklists'
import { ChecklistItemValue } from '@/@types/openapi-internal/ChecklistItemValue'
import { PRIORITYS } from '@/@types/openapi-internal-custom/Priority'
import { CHECKLIST_DONE_STATUSS } from '@/@types/openapi-internal-custom/ChecklistDoneStatus'
import { PaymentMethod } from '@/@types/tranasction/payment-type'
import { uniqObjects } from '@/utils/object'
import { SLAPolicyDetails } from '@/@types/openapi-internal/SLAPolicyDetails'
import { getSLAStatusFromElapsedTime } from '@/services/sla/sla-utils'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { DEFAULT_CLASSIFICATION_SETTINGS } from '@/services/risk-scoring/repositories/risk-repository'
import { Account } from '@/@types/openapi-internal/Account'

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
    name = `${user.userDetails?.name?.firstName} ${user.userDetails?.name?.lastName}`
    country = `${user.userDetails?.countryOfResidence}`
    websites = []
  } else {
    name = user.legalEntity?.companyGeneralDetails?.legalName ?? ''
    country = user.legalEntity?.companyRegistrationDetails?.registrationCountry
    websites = user.legalEntity?.contactDetails?.websites
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

export const mapAccountToAssignment = (account: Account): Assignment[] => {
  return [
    {
      assigneeUserId: account.id,
      timestamp: Date.now(),
    },
  ]
}

export class TransactionUserCasesSampler extends BaseSampler<Case> {
  private statusChangeSampler: StatusChangeSampler
  private alertSampler: AlertSampler
  private procssedTxnIds: Set<string> = new Set()
  constructor(seed: number, counter?: number) {
    super(seed, counter)
    const childSamplerSeed = this.rng.randomInt()
    this.statusChangeSampler = new StatusChangeSampler(childSamplerSeed)
    this.alertSampler = new AlertSampler(childSamplerSeed)
  }

  protected handleCaseTransaction(
    t: InternalTransaction,
    userId: string,
    direction: 'origin' | 'destination',
    ruleInstanceTransactionMap: Map<string, InternalTransaction[]>
  ) {
    const hitDirection = direction === 'origin' ? 'ORIGIN' : 'DESTINATION'
    if (
      t[direction + 'UserId'] === userId &&
      !this.procssedTxnIds.has(t.transactionId)
    ) {
      const shouldInclude = t.hitRules.some((rh) => {
        const hit = rh.ruleHitMeta?.hitDirections?.includes(hitDirection)
        if (hit) {
          ruleInstanceTransactionMap.set(rh.ruleInstanceId, [
            ...(ruleInstanceTransactionMap.get(rh.ruleInstanceId) ?? []),
            t,
          ])
          return true
        }
        return false
      })
      return shouldInclude
    }
    return false
  }

  protected generateSample(params: {
    userId: string
    user: InternalBusinessUser | InternalConsumerUser
    transactions: InternalTransaction[]
  }): Case {
    const caseId = `${ID_PREFIXES.CASE}${counter++}`
    // seed for the child samplers - no need to pass it as param in getSample()
    const childSamplerSeed = this.rng.randomInt()
    this.statusChangeSampler.setRandomSeed(childSamplerSeed)
    this.alertSampler.setRandomSeed(childSamplerSeed)

    const { user } = params

    const ruleInstanceTransactionMap = new Map<string, InternalTransaction[]>()

    const transactions = params.transactions.filter((t) => {
      const isOriginTxn = this.handleCaseTransaction(
        t,
        params.userId,
        'origin',
        ruleInstanceTransactionMap
      )

      const isDestinationTxn = this.handleCaseTransaction(
        t,
        params.userId,
        'destination',
        ruleInstanceTransactionMap
      )

      return isOriginTxn || isDestinationTxn
    })

    transactions.forEach((t) => {
      this.procssedTxnIds.add(t.transactionId)
    })

    const alerts: Alert[] = []

    ruleInstanceTransactionMap.forEach((transactions, ruleInstanceId) => {
      const ruleHit = transactions[0].hitRules.find(
        (rh) => rh.ruleInstanceId === ruleInstanceId
      )
      if (!ruleHit?.isShadow) {
        const alert = this.alertSampler.getSample(undefined, {
          caseId,
          ruleInstanceId,
          ruleHit,
          transactions,
        })
        alerts.push(alert)
      }
    })

    // alerts for users rules
    user?.hitRules?.map((hitRule) => {
      const alert = this.alertSampler.getSample(undefined, {
        caseId,
        ruleInstanceId: hitRule.ruleInstanceId,
        ruleHit: hitRule,
        transactions: [],
      })
      alerts.push(alert)
    })

    const caseStatus = this.rng.pickRandom(
      CASE_STATUSS.filter((s) => !isStatusInReview(s))
    )
    const reasons = this.rng
      .r(1)
      .randomSubset<CaseReasons>([
        'Anti-money laundering',
        'Documents collected',
        'Fraud',
        'Terrorist financing',
        'Suspicious activity reported (SAR)',
      ])

    const userRiskLevel = getRiskLevelFromScore(
      DEFAULT_CLASSIFICATION_SETTINGS,
      user?.drsScore?.drsScore ?? user?.krsScore?.krsScore ?? 75
    )
    let reviewAssignments: Assignment[] | undefined = []

    if (isStatusInReview(caseStatus) || statusEscalated(caseStatus)) {
      reviewAssignments = mapAccountToAssignment(
        this.rng.r(2).pickRandom(getAccounts())
      )
    }
    const caseCreatedTimestamp = this.sampleTimestamp(TIME_BACK_TO)

    let ruleHits = uniqBy(
      transactions.flatMap((t) => t.hitRules),
      'ruleInstanceId'
    )

    ruleHits = ruleHits.concat(user?.hitRules ?? [])

    return {
      caseId,
      caseType: 'SYSTEM',
      caseStatus,
      priority: this.rng.r(3).pickRandom(PRIORITYS),
      createdTimestamp: caseCreatedTimestamp,
      latestTransactionArrivalTimestamp: transactions.reduce((acc, t) => {
        return Math.max(acc, t.timestamp)
      }, 0),
      comments: [],
      caseTransactionsCount: transactions.length,
      statusChanges: this.statusChangeSampler.getSample(
        undefined,
        caseStatus ?? 'OPEN',
        this.rng.r(3).pickRandom(getAccounts()).id
      ),
      assignments: mapAccountToAssignment(
        this.rng.r(4).pickRandom(getAccounts())
      ),
      reviewAssignments,
      updatedAt: this.sampleTimestamp(),
      lastStatusChange:
        caseStatus === 'CLOSED' && user
          ? {
              reason: reasons,
              userId: params.userId,
              timestamp: this.sampleTimestamp(), // TODO: should be different from updatedAt?
              comment: generateNarrative(
                ruleHits.map((r) => r.ruleDescription),
                reasons,
                user
              ),
            }
          : undefined,
      caseUsers: {
        origin: user,
        originUserRiskLevel:
          user?.drsScore?.manualRiskLevel ??
          user?.drsScore?.derivedRiskLevel ??
          userRiskLevel,
        originUserDrsScore: user?.drsScore?.drsScore,
      },
      caseAggregates: {
        originPaymentMethods:
          uniq(
            transactions
              .filter((t) => t.originPaymentDetails?.method)
              .map((t) => t.originPaymentDetails?.method) as PaymentMethod[]
          ) ?? [],
        destinationPaymentMethods:
          uniq(
            transactions
              .filter((t) => t.destinationPaymentDetails?.method)
              .map(
                (t) => t.destinationPaymentDetails?.method
              ) as PaymentMethod[]
          ) ?? [],
        tags: uniqObjects(transactions.flatMap((t) => t.tags ?? [])),
      },
      caseTransactionsIds: transactions.map((t) => t.transactionId),
      alerts: alerts,
    } as Case
  }
}

export class AlertSampler extends BaseSampler<Alert> {
  private statusChangeSampler: StatusChangeSampler

  constructor(seed: number, counter?: number) {
    super(seed, counter)
    this.statusChangeSampler = new StatusChangeSampler(this.rng.randomInt())
  }

  protected generateSample(params: {
    caseId: string
    ruleInstanceId: string
    ruleHit: HitRulesDetails
    transactions: InternalTransaction[]
  }): Alert {
    const { ruleHit, ruleInstanceId } = params
    const createdTimestamp = this.rng.r(1).randomTimestamp(TIME_BACK_TO)
    const ruleInstance = getRuleInstance(ruleInstanceId)
    this.statusChangeSampler.setRandomSeed(this.rng.randomInt())

    const alertStatus = this.rng.pickRandom([
      'OPEN',
      'OPEN',
      'OPEN',
      'OPEN',
      'OPEN',
      'CLOSED',
      'REOPENED',
    ]) as AlertStatus

    const statusChanges = this.statusChangeSampler.getSample(
      undefined,
      alertStatus ?? 'OPEN',
      this.rng.r(1).pickRandom(getAccounts()).id,
      true
    )
    const checklistTemplateId = ruleInstance.checklistTemplateId
    const slaPolicyDetails: SLAPolicyDetails[] | undefined = uniq(
      ruleInstance.alertConfig?.slaPolicies
    )?.map((sla) => {
      const slaPolicy = getSLAPolicyById(sla)
      let elapsedTime = 0
      if (slaPolicy && alertStatus === 'CLOSED') {
        elapsedTime = dayjs(last(statusChanges)?.timestamp).diff(
          createdTimestamp,
          'milliseconds'
        )
      }
      return {
        slaPolicyId: sla,
        /* Calculating SLA status for closed alerts her as we don't calculate it in the service  */
        policyStatus: slaPolicy
          ? getSLAStatusFromElapsedTime(
              elapsedTime,
              slaPolicy.policyConfiguration
            )
          : 'OK',
        elapsedTime,
      }
    })

    const isFirstPaymentRule = params.ruleHit.ruleId === 'R-1'
    const transactions = params.transactions
    const transactionIds = isFirstPaymentRule
      ? [transactions[0].transactionId]
      : transactions.map((t) => t.transactionId)

    let reviewAssignments: Assignment[] | undefined = []

    if (isStatusInReview(alertStatus) || statusEscalated(alertStatus)) {
      reviewAssignments = mapAccountToAssignment(
        this.rng.r(2).pickRandom(getAccounts())
      )
    }

    return {
      ...params.ruleHit,
      alertId: `${ID_PREFIXES.ALERT}${alertCounter++}`,
      createdTimestamp: createdTimestamp,
      latestTransactionArrivalTimestamp: createdTimestamp - 3600 * 1000,
      caseId: params.caseId,
      alertStatus,
      ruleInstanceId: ruleInstanceId,
      numberOfTransactionsHit: params.transactions.length,
      priority: this.rng.r(3).pickRandom(PRIORITYS),
      transactionIds,
      ruleQaStatus:
        this.rng.r(4).randomBool() && alertStatus === 'CLOSED'
          ? this.rng.r(5).pickRandom(CHECKLIST_STATUSS)
          : undefined,
      ruleChecklistTemplateId: checklistTemplateId,
      updatedAt: this.sampleTimestamp(), // TODO: should be different from createdTimestamp?
      statusChanges: statusChanges,
      lastStatusChange: last(statusChanges),
      assignments: mapAccountToAssignment(
        this.rng.r(4).pickRandom(getAccounts())
      ),
      qaAssignment: mapAccountToAssignment(
        this.rng.r(7).pickRandom(getAccounts())
      ),
      reviewAssignments,
      ruleChecklist: checklistTemplateId
        ? getChecklistTemplate(checklistTemplateId).categories.flatMap(
            (category): ChecklistItemValue[] =>
              category.checklistItems.map(
                (cli): ChecklistItemValue => ({
                  checklistItemId: cli.id,
                  done:
                    alertStatus === 'CLOSED'
                      ? 'DONE'
                      : this.rng.r(6).pickRandom(CHECKLIST_DONE_STATUSS),
                })
              )
          )
        : [],
      ruleNature: userRules()
        .concat(transactionRules(false)) // return normal transaction rules
        .concat(transactionRules(true)) // return crypto transaction rules
        .find((p) => p.ruleInstanceId === ruleInstanceId)?.nature,
      slaPolicyDetails: slaPolicyDetails,
      ruleHitMeta: ruleHit.ruleHitMeta,
      ruleQueueId: ruleInstance.queueId ?? undefined,
    }
  }
}

export class StatusChangeSampler extends BaseSampler<CaseStatusChange[]> {
  protected generateSample(
    caseStatus: CaseStatus,
    userId: string,
    alerts?: boolean
  ): CaseStatusChange[] {
    const statusChanges: CaseStatusChange[] = []
    if (caseStatus === 'CLOSED' || caseStatus === 'REOPENED') {
      const time = dayjs().subtract(
        Math.floor(this.rng.randomInt(alerts ? 150 : 400)),
        'minute'
      )
      statusChanges.push({
        caseStatus: 'OPEN_IN_PROGRESS',
        timestamp: time
          .subtract(
            Math.floor(this.rng.r(1).randomInt(alerts ? 150 : 400)),
            'minute'
          )
          .valueOf(),
        userId,
      })
      statusChanges.push({
        caseStatus: 'CLOSED',
        timestamp: time.valueOf(),
        reason: this.rng.r(2).randomSubset(CASE_REASONSS),
        userId,
      })
      if (caseStatus === 'REOPENED') {
        statusChanges.push({
          caseStatus: 'REOPENED',
          timestamp: time.valueOf(),
          userId,
        })
      }
      return statusChanges
    }

    if (caseStatus !== 'OPEN') {
      let insterted = false
      if (
        this.rng.r(2).randomBool() &&
        caseStatus !== 'OPEN_IN_PROGRESS' &&
        caseStatus.includes('OPEN')
      ) {
        statusChanges.push({
          caseStatus: 'OPEN_IN_PROGRESS',
          timestamp: dayjs()
            .subtract(
              Math.floor(this.rng.r(3).randomInt(alerts ? 150 : 400)),
              'minute'
            )
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
}

export class AuditLogForStatusChangeSampler extends BaseSampler<AuditLog> {
  protected generateSample(caseItem: Case): AuditLog {
    const reasons = this.rng.randomSubset<CaseReasons>([
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
      timestamp: this.sampleTimestamp(),
      type: 'CASE',
      user: this.rng.r(1).pickRandom(getAccounts()),
    }
  }
}
