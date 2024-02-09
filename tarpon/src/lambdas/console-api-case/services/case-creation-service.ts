import {
  compact,
  groupBy,
  isEqual,
  last,
  memoize,
  minBy,
  sample,
  uniq,
} from 'lodash'
import pluralize from 'pluralize'
import createHttpError from 'http-errors'
import {
  CaseRepository,
  MAX_TRANSACTION_IN_A_CASE,
  SubjectCasesQueryParams,
} from '@/services/rules-engine/repositories/case-repository'
import { Case } from '@/@types/openapi-internal/Case'
import { Alert } from '@/@types/openapi-internal/Alert'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { RuleHitDirection } from '@/@types/openapi-public/RuleHitDirection'
import { Priority } from '@/@types/openapi-public-management/Priority'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { logger } from '@/core/logger'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { HitRulesDetails } from '@/@types/openapi-internal/HitRulesDetails'
import { PRIORITYS } from '@/@types/openapi-internal-custom/Priority'
import { calculateCaseAvailableDate } from '@/lambdas/console-api-case/services/utils'
import { TenantSettings } from '@/@types/openapi-internal/TenantSettings'
import { notNullish } from '@/core/utils/array'
import { getDefaultTimezone } from '@/utils/dayjs'
import { traceable } from '@/core/xray'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { ChecklistTemplatesService } from '@/services/tenants/checklist-template-service'
import { ChecklistTemplate } from '@/@types/openapi-internal/ChecklistTemplate'
import { ChecklistItemValue } from '@/@types/openapi-internal/ChecklistItemValue'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { RoleService } from '@/services/roles'
import { FLAGRIGHT_SYSTEM_USER } from '@/services/rules-engine/repositories/alerts-repository'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { CaseAggregates } from '@/@types/openapi-internal/CaseAggregates'
import { DEFAULT_CASE_AGGREGATES } from '@/utils/case'
import {
  tenantSettings as contextTenantSettings,
  getContext,
} from '@/core/utils/context'
import { uniqObjects } from '@/utils/object'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import { FileInfo } from '@/@types/openapi-internal/FileInfo'
import { Account } from '@/@types/openapi-internal/Account'
import { Comment } from '@/@types/openapi-internal/Comment'
import {
  ThinWebhookDeliveryTask,
  sendWebhookTasks,
} from '@/services/webhook/utils'
import { WebhookEventType } from '@/@types/openapi-internal/WebhookEventType'
import { CaseOpenedDetails } from '@/@types/openapi-public/CaseOpenedDetails'

type CaseSubject =
  | {
      type: 'USER'
      user: InternalUser
    }
  | {
      type: 'PAYMENT'
      paymentDetails: PaymentDetails
    }

@traceable
export class CaseCreationService {
  caseRepository: CaseRepository
  userRepository: UserRepository
  ruleInstanceRepository: RuleInstanceRepository
  transactionRepository: MongoDbTransactionRepository
  tenantSettings: TenantSettings
  constructor(
    caseRepository: CaseRepository,
    userRepository: UserRepository,
    ruleInstanceRepository: RuleInstanceRepository,
    transactionRepository: MongoDbTransactionRepository,
    tenantSettings: TenantSettings
  ) {
    this.caseRepository = caseRepository
    this.userRepository = userRepository
    this.ruleInstanceRepository = ruleInstanceRepository
    this.transactionRepository = transactionRepository
    this.tenantSettings = tenantSettings
  }

  private async sendCasesOpenedWebhook(cases: Case[]) {
    const webhookTasks: ThinWebhookDeliveryTask<CaseOpenedDetails>[] =
      cases.map((case_) => ({
        event: 'CASE_OPENED' as WebhookEventType,
        triggeredBy: 'SYSTEM',
        payload: {
          caseObject: case_,
          status: 'OPEN',
          userId:
            case_?.caseUsers?.origin?.userId ??
            case_?.caseUsers?.destination?.userId,
          transactionIds: case_?.caseTransactionsIds,
        },
      }))

    await sendWebhookTasks<CaseOpenedDetails>(
      this.caseRepository.tenantId,
      webhookTasks
    )
  }

  private getManualCaseComment(
    manualCaseData: CaseStatusChange,
    caseId: string,
    files: FileInfo[],
    transactionIds: string[]
  ): Comment {
    const { comment, reason, otherReason } = manualCaseData
    const { id: userId, email } = getContext()?.user as Account

    const transactionsCount = transactionIds.length

    // Break down string generation into smaller, more meaningful parts
    const createdByText = `Case ${caseId} is manually created by ${
      email ?? userId
    }`
    const reasonText = `with reason: ${reason}${
      reason?.[0] === 'Other' ? `: ${otherReason}` : ''
    }`

    // Individual components for transactionsText
    const transactionsCountText = `${transactionsCount} ${pluralize(
      'transaction',
      transactionsCount
    )}`

    const transactionIdsText = `${pluralize(
      'id',
      transactionsCount
    )} ${transactionIds.join(', ')}`

    // Final transactionsText based on the condition
    const transactionsText = transactionsCount
      ? ` and ${transactionsCountText} with ${transactionIdsText}`
      : ''

    const optionalComment = comment ? `\n${comment}` : ''

    const commentText = `${createdByText} ${reasonText}${transactionsText}${optionalComment}`

    return {
      body: commentText,
      createdAt: Date.now(),
      files,
      updatedAt: Date.now(),
      userId,
    }
  }

  public async createManualCaseFromUser(
    manualCaseData: CaseStatusChange,
    files: FileInfo[],
    transactionIds: string[],
    priority?: Priority
  ): Promise<Case> {
    const { id: userId } = getContext()?.user as Account

    const caseUser = await this.userRepository.getUserById(
      manualCaseData.userId
    )

    if (!caseUser) {
      throw new createHttpError.NotFound(
        `User ${manualCaseData.userId} not found`
      )
    }

    const statusChange: CaseStatusChange = {
      ...manualCaseData,
      caseStatus: 'OPEN',
      userId,
    }

    const transactions = compact(transactionIds).length
      ? await this.transactionRepository.getTransactionsByIds(
          compact(transactionIds)
        )
      : []

    const case_ = await this.addOrUpdateCase({
      caseType: 'MANUAL',
      caseStatus: 'OPEN',
      caseUsers: {
        origin: caseUser,
        originUserRiskLevel:
          caseUser.drsScore?.manualRiskLevel ??
          caseUser.drsScore?.derivedRiskLevel,
        originUserDrsScore: caseUser.drsScore?.drsScore,
      },
      alerts: [],
      caseTransactionsCount: transactions.length,
      createdBy: manualCaseData.userId,
      priority: priority ?? 'P1',
      updatedAt: Date.now(),
      createdTimestamp: Date.now(),
      caseTransactionsIds: transactions.map((t) => t.transactionId),
      statusChanges: [statusChange],
      lastStatusChange: statusChange,
      caseAggregates: {
        originPaymentMethods: compact(
          uniq(transactions.map((t) => t.originPaymentDetails?.method))
        ),
        destinationPaymentMethods: compact(
          uniq(transactions.map((t) => t.destinationPaymentDetails?.method))
        ),
        tags: compact(uniqObjects(transactions.flatMap((t) => t.tags ?? []))),
      },
    })

    const comment = this.getManualCaseComment(
      manualCaseData,
      case_.caseId!,
      files,
      transactions.map((t) => t.transactionId)
    )

    await this.caseRepository.saveCaseComment(case_.caseId!, comment)

    return case_
  }

  private async addOrUpdateCase(caseEntity: Case): Promise<Case> {
    const isNew = caseEntity.caseId == null
    const case_ = await this.caseRepository.addCaseMongo(caseEntity)
    if (isNew) {
      await this.sendCasesOpenedWebhook([case_])
    }
    return case_
  }

  async getUsers(
    transaction: TransactionWithRulesResult
  ): Promise<(InternalConsumerUser | InternalBusinessUser)[]> {
    const userIds = new Set<string>()
    if (transaction.originUserId) userIds.add(transaction.originUserId)
    if (transaction.destinationUserId)
      userIds.add(transaction.destinationUserId)
    if (userIds.size) {
      return await this.userRepository.getMongoUsersByIds([...userIds])
    } else {
      return []
    }
  }

  private async getUser(
    userId: string | undefined
  ): Promise<InternalUser | null> {
    if (userId == null) {
      return null
    }
    const user = await this.userRepository.getMongoUser(userId)
    // Do not use MissingUser wrapper to prevent case creation for missing users. Discussion: https://www.notion.so/flagright/Hide-cases-for-unknown-user-IDs-for-Kevin-3052119fc63c48058d6100d0de12bb29
    if (user == null || !('type' in user)) {
      return null
    }
    return user
  }

  public async getTransactionSubjects(
    transaction: TransactionWithRulesResult
  ): Promise<Record<RuleHitDirection, CaseSubject | undefined>> {
    const {
      originUserId,
      destinationUserId,
      originPaymentDetails,
      destinationPaymentDetails,
    } = transaction

    // If the origin user and the destination user are the same, we can pass undefined for the destination user
    const isAnyRuleHasOriginHit = transaction.hitRules.some(
      (hitRule) =>
        hitRule.ruleHitMeta?.hitDirections?.includes('ORIGIN') ?? false
    )

    logger.info(`Fetching case users by ids`, {
      destinationUserId,
      originUserId,
    })

    let origin: CaseSubject | undefined = undefined
    if (isAnyRuleHasOriginHit) {
      if (originUserId) {
        const user = await this.getUser(originUserId)
        if (user != null) {
          origin = {
            type: 'USER',
            user: user,
          }
        }
      } else {
        if (originPaymentDetails != null) {
          origin = {
            type: 'PAYMENT',
            paymentDetails: originPaymentDetails,
          }
        }
      }
    }
    let destination: CaseSubject | undefined
    {
      if (destinationUserId) {
        if (!(isAnyRuleHasOriginHit && originUserId === destinationUserId)) {
          const user = await this.getUser(destinationUserId)
          if (user != null) {
            destination = {
              type: 'USER',
              user: user,
            }
          }
        }
      } else {
        if (
          !(
            isAnyRuleHasOriginHit &&
            isEqual(destinationPaymentDetails, originPaymentDetails)
          )
        ) {
          if (destinationPaymentDetails != null) {
            destination = {
              type: 'PAYMENT',
              paymentDetails: destinationPaymentDetails,
            }
          }
        }
      }
    }

    return {
      ORIGIN: origin,
      DESTINATION: destination,
    }
  }

  public async separateExistingAndNewAlerts(
    hitRules: HitRulesDetails[],
    ruleInstances: readonly RuleInstance[],
    alerts: Alert[],
    createdTimestamp: number,
    latestTransactionArrivalTimestamp?: number,
    transaction?: InternalTransaction,
    checkListTemplates?: ChecklistTemplate[]
  ): Promise<{ existingAlerts: Alert[]; newAlerts: Alert[] }> {
    // Get the rule hits that are new for this transaction
    const newRuleHits = hitRules.filter(
      (hitRule) =>
        !alerts.some((alert) => alert.ruleInstanceId === hitRule.ruleInstanceId)
    )

    // Get the alerts that are new for this transaction
    const newAlerts =
      newRuleHits.length > 0
        ? await this.getAlertsForNewCase(
            newRuleHits,
            ruleInstances,
            createdTimestamp,
            latestTransactionArrivalTimestamp,
            transaction,
            checkListTemplates
          )
        : []

    // Get the alerts that already existed on the case
    const existingAlerts = alerts.filter(
      (existingAlert) =>
        !newRuleHits.some(
          (newRuleHits) =>
            newRuleHits.ruleInstanceId === existingAlert.ruleInstanceId
        )
    )

    return {
      existingAlerts,
      newAlerts,
    }
  }

  private async getOrCreateAlertsForExistingCase(
    hitRules: HitRulesDetails[],
    alerts: Alert[] | undefined,
    ruleInstances: readonly RuleInstance[],
    createdTimestamp: number,
    latestTransaction?: InternalTransaction,
    latestTransactionArrivalTimestamp?: number,
    checkListTemplates?: ChecklistTemplate[]
  ) {
    if (alerts) {
      const { existingAlerts, newAlerts } =
        await this.separateExistingAndNewAlerts(
          hitRules,
          ruleInstances,
          alerts,
          createdTimestamp,
          latestTransactionArrivalTimestamp,
          latestTransaction,
          checkListTemplates
        )

      const updatedExistingAlerts =
        existingAlerts.length > 0
          ? this.updateExistingAlerts(
              existingAlerts,
              latestTransaction,
              latestTransactionArrivalTimestamp,
              ruleInstances,
              checkListTemplates
            )
          : []

      return [...updatedExistingAlerts, ...newAlerts]
    } else {
      return this.getAlertsForNewCase(
        hitRules,
        ruleInstances,
        createdTimestamp,
        latestTransactionArrivalTimestamp,
        latestTransaction,
        checkListTemplates
      )
    }
  }

  private async getAlertsForNewCase(
    hitRules: HitRulesDetails[],
    ruleInstances: readonly RuleInstance[],
    createdTimestamp: number,
    latestTransactionArrivalTimestamp?: number,
    transaction?: InternalTransaction,
    checkListTemplates?: ChecklistTemplate[]
  ): Promise<Alert[]> {
    const alerts: Alert[] = await Promise.all(
      hitRules.map(async (hitRule: HitRulesDetails) => {
        const ruleInstanceMatch: RuleInstance | null =
          ruleInstances.find(
            (ruleInstance) => hitRule.ruleInstanceId === ruleInstance.id
          ) ?? null

        const now = Date.now()
        const availableAfterTimestamp: number | undefined =
          ruleInstanceMatch?.alertConfig?.alertCreationInterval != null
            ? calculateCaseAvailableDate(
                now,
                ruleInstanceMatch?.alertConfig?.alertCreationInterval,
                this.tenantSettings.tenantTimezone ?? getDefaultTimezone()
              )
            : undefined
        const ruleChecklist = checkListTemplates?.find(
          (x) => x.id === ruleInstanceMatch?.checklistTemplateId
        )
        const assignee = await this.getRuleAlertAssignee(
          ruleInstanceMatch?.alertConfig?.alertAssignees,
          ruleInstanceMatch?.alertConfig?.alertAssigneeRole
        )
        return {
          createdTimestamp: availableAfterTimestamp ?? createdTimestamp,
          latestTransactionArrivalTimestamp,
          updatedAt: now,
          alertStatus: 'OPEN',
          ruleId: hitRule.ruleId,
          availableAfterTimestamp: availableAfterTimestamp,
          ruleInstanceId: hitRule.ruleInstanceId,
          ruleName: hitRule.ruleName,
          ruleDescription: hitRule.ruleDescription,
          ruleAction: hitRule.ruleAction,
          ruleHitMeta: hitRule.ruleHitMeta,
          ruleNature: hitRule.nature,
          ruleQueueId: ruleInstanceMatch?.queueId,
          numberOfTransactionsHit: transaction ? 1 : 0,
          transactionIds: transaction ? [transaction.transactionId] : [],
          priority: (ruleInstanceMatch?.casePriority ??
            last(PRIORITYS)) as Priority,
          originPaymentMethods: transaction?.originPaymentDetails?.method
            ? [transaction?.originPaymentDetails?.method]
            : [],
          destinationPaymentMethods: transaction?.destinationPaymentDetails
            ?.method
            ? [transaction?.destinationPaymentDetails?.method]
            : [],
          ruleChecklistTemplateId: ruleInstanceMatch?.checklistTemplateId,
          ruleChecklist: ruleChecklist?.categories.flatMap(
            (category) =>
              category.checklistItems.map(
                (item) =>
                  ({
                    checklistItemId: item.id,
                    done: 'NOT_STARTED',
                  } as ChecklistItemValue)
              ) ?? []
          ),
          assignments: assignee ? [assignee] : [],
        }
      })
    )

    return alerts
  }

  private updateExistingAlerts(
    alerts: Alert[],
    transaction?: InternalTransaction,
    latestTransactionArrivalTimestamp?: number,
    ruleInstances?: readonly RuleInstance[],
    checkListTemplates?: ChecklistTemplate[]
  ): Alert[] {
    return alerts.map((alert) => {
      if (!transaction || !latestTransactionArrivalTimestamp) {
        return alert
      }
      const transactionBelongsToAlert = Boolean(
        transaction.hitRules.find(
          (rule) => rule.ruleInstanceId === alert.ruleInstanceId
        )
      )
      if (!transactionBelongsToAlert) {
        return alert
      }
      const txnSet = new Set(alert.transactionIds).add(
        transaction.transactionId
      )
      const originPaymentDetails = new Set(alert.originPaymentMethods)
      const destinationPaymentDetails = new Set(alert.destinationPaymentMethods)
      if (transaction.originPaymentDetails?.method) {
        originPaymentDetails.add(transaction.originPaymentDetails.method)
      }
      if (transaction.destinationPaymentDetails?.method) {
        destinationPaymentDetails.add(
          transaction.destinationPaymentDetails.method
        )
      }
      return {
        ...alert,
        latestTransactionArrivalTimestamp: latestTransactionArrivalTimestamp,
        transactionIds: Array.from(txnSet),
        originPaymentMethods: Array.from(originPaymentDetails),
        destinationPaymentMethods: Array.from(destinationPaymentDetails),
        numberOfTransactionsHit: txnSet.size,
        updatedAt: Date.now(),
        ruleChecklistTemplateId:
          alert?.ruleChecklistTemplateId ??
          ruleInstances?.find((rule) => rule.id === alert.ruleInstanceId)
            ?.checklistTemplateId,
        ruleChecklist:
          alert?.ruleChecklist ??
          checkListTemplates?.flatMap((template) =>
            template.categories.flatMap((category) =>
              category.checklistItems.map(
                (item) =>
                  ({
                    checklistItemId: item.id,
                    done: 'NOT_STARTED',
                  } as ChecklistItemValue)
              )
            )
          ),
      }
    })
  }

  private getNewUserCase(
    direction: RuleHitDirection,
    user: InternalConsumerUser | InternalBusinessUser
  ): Case {
    const caseEntity: Case = {
      caseStatus: 'OPEN',
      caseType: 'SYSTEM',
      subjectType: 'USER',
      caseUsers: {
        origin: direction === 'ORIGIN' ? user : undefined,
        destination: direction === 'DESTINATION' ? user : undefined,
      },
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    }
    return caseEntity
  }

  private getNewPaymentCase(
    direction: RuleHitDirection,
    paymentDetails: PaymentDetails
  ): Case {
    const caseEntity: Case = {
      caseStatus: 'OPEN',
      caseType: 'SYSTEM',
      subjectType: 'PAYMENT',
      paymentDetails: {
        origin: direction === 'ORIGIN' ? paymentDetails : undefined,
        destination: direction === 'DESTINATION' ? paymentDetails : undefined,
      },
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    }
    return caseEntity
  }

  private getCaseAggregatesFromTransactions(
    transactions: InternalTransaction[]
  ): CaseAggregates {
    const originPaymentMethods = uniq(
      compact(
        transactions.flatMap(
          ({ originPaymentDetails }) => originPaymentDetails?.method ?? []
        )
      )
    )
    const destinationPaymentMethods = uniq(
      compact(
        transactions.flatMap(
          ({ destinationPaymentDetails }) =>
            destinationPaymentDetails?.method ?? []
        )
      )
    )
    const tags = uniqObjects(
      compact(transactions.flatMap(({ tags }) => tags ?? []))
    ).sort()

    return {
      originPaymentMethods,
      destinationPaymentMethods,
      tags,
    }
  }

  public async createNewCaseFromAlerts(
    sourceCase: Case,
    alertIds: string[]
  ): Promise<Case> {
    // Extract all alerts transactions
    const sourceAlerts = sourceCase.alerts ?? []
    const allAlertsTransactionIds: string[] = sourceAlerts
      .flatMap(({ transactionIds }) => transactionIds)
      .filter((id: string | undefined): id is string => id != null)
    const { data: allAlertsTransactions } =
      await this.transactionRepository.getTransactions({
        filterIdList: allAlertsTransactionIds,
        afterTimestamp: 0,
        beforeTimestamp: Number.MAX_SAFE_INTEGER,
        pageSize: 'DISABLED',
      })

    // Split alerts which goes to new case and alerts which stay in the old one
    const predicate = (x: Alert) =>
      x.alertId != null && alertIds.includes(x.alertId)
    const newCaseAlerts = sourceAlerts.filter(predicate)
    const oldCaseAlerts = sourceAlerts.filter((x) => !predicate(x))

    // Split transactions
    const newCaseAlertsTransactionsIds =
      newCaseAlerts.flatMap(({ transactionIds }) => transactionIds) ?? []
    const transactionPredicate = (transaction: InternalTransaction) => {
      return newCaseAlertsTransactionsIds.includes(transaction.transactionId)
    }
    const newCaseAlertsTransactions =
      allAlertsTransactions.filter(transactionPredicate)
    const oldCaseAlertsTransactions = allAlertsTransactions.filter(
      (x) => !transactionPredicate(x)
    )

    const caseTransactionsIds = uniq(
      newCaseAlertsTransactions.map(({ transactionId }) => transactionId)
    )

    const now = Date.now()

    // Create new case
    const newCase = await this.addOrUpdateCase({
      alerts: newCaseAlerts,
      createdTimestamp: now,
      caseStatus: 'OPEN',
      caseType: 'SYSTEM',
      priority: minBy(newCaseAlerts, 'priority')?.priority ?? last(PRIORITYS),
      relatedCases: sourceCase.caseId
        ? [...(sourceCase.relatedCases ?? []), sourceCase.caseId]
        : sourceCase.relatedCases,
      caseUsers: sourceCase.caseUsers,
      caseTransactionsIds,
      caseTransactionsCount: caseTransactionsIds.length,
      updatedAt: now,
      caseAggregates: this.getCaseAggregatesFromTransactions(
        newCaseAlertsTransactions ?? []
      ),
    })

    const oldCaseTransactionsIds = uniq(
      oldCaseAlertsTransactions.map(({ transactionId }) => transactionId)
    )

    // Save old case
    await this.addOrUpdateCase({
      ...sourceCase,
      alerts: oldCaseAlerts,
      caseTransactionsIds: oldCaseTransactionsIds,
      caseTransactionsCount: oldCaseTransactionsIds.length,
      priority: minBy(oldCaseAlerts, 'priority')?.priority ?? last(PRIORITYS),
      updatedAt: now,
      caseAggregates: this.getCaseAggregatesFromTransactions(
        oldCaseAlertsTransactions ?? []
      ),
    })

    return newCase
  }

  private async getCheckListTemplates(
    ruleInstances: readonly RuleInstance[],
    hitRules: HitRulesDetails[]
  ): Promise<ChecklistTemplate[]> {
    const checklistTemplatesService = new ChecklistTemplatesService(
      this.userRepository.tenantId,
      this.userRepository.mongoDb
    )

    const checkListTemplateIds = uniq(
      compact(
        ruleInstances
          .filter((x) => hitRules.some((y) => y.ruleInstanceId === x.id))
          .map((x) => x.checklistTemplateId)
      )
    )

    if (checkListTemplateIds.length === 0) {
      return []
    }

    const checkListTemplates =
      await checklistTemplatesService.getChecklistTemplateByIds(
        checkListTemplateIds
      )

    return checkListTemplates
  }

  private async getCasesBySubject(
    subject: CaseSubject,
    params: SubjectCasesQueryParams
  ) {
    return subject.type === 'USER'
      ? await this.caseRepository.getCasesByUserId(subject.user.userId, params)
      : await this.caseRepository.getCasesByPaymentDetails(
          subject.paymentDetails,
          params
        )
  }

  private async getOrCreateCases(
    hitSubjects: Array<{
      subject: CaseSubject
      direction: RuleHitDirection
    }>,
    params: {
      createdTimestamp: number
      latestTransactionArrivalTimestamp?: number
      priority: Priority
      transaction?: InternalTransaction
      hitRules: HitRulesDetails[]
      checkListTemplates?: ChecklistTemplate[]
    },
    ruleInstances: ReadonlyArray<RuleInstance>
  ): Promise<Case[]> {
    logger.info(`Hit directions to create or update cases`, {
      hitDirections: hitSubjects.map((hitUser) => hitUser.direction),
    })
    const result: Case[] = []
    for (const { subject, direction } of hitSubjects) {
      // keep only user related hits
      const filteredHitRules = params.hitRules.filter((hitRule) => {
        if (
          !hitRule.ruleHitMeta?.hitDirections?.some(
            (hitDirection) => hitDirection === direction
          )
        ) {
          return false
        }
        const ruleInstance = ruleInstances.find(
          (x) => x.id === hitRule.ruleInstanceId
        )
        if (ruleInstance == null) {
          return false
        }
        // Create AlertFor Logic
        let { alertCreatedFor } = ruleInstance.alertConfig ?? {}
        alertCreatedFor =
          !alertCreatedFor || alertCreatedFor.length === 0
            ? ['USER']
            : alertCreatedFor

        if (
          !alertCreatedFor.includes('PAYMENT_DETAILS') &&
          subject.type === 'PAYMENT'
        ) {
          return false
        }

        if (!alertCreatedFor.includes('USER') && subject.type === 'USER') {
          return false
        }

        return true
      })
      const filteredTransaction = params.transaction
        ? {
            ...params.transaction,
            hitRules: filteredHitRules,
          }
        : undefined
      const hitRuleInstanceIds = filteredHitRules.map(
        (rule) => rule.ruleInstanceId
      )

      if (filteredHitRules.length === 0) {
        continue
      }
      if (filteredTransaction) {
        const casesHavingSameTransaction = await this.getCasesBySubject(
          subject,
          {
            filterTransactionId: filteredTransaction.transactionId,
            filterCaseType: 'SYSTEM',
          }
        )
        const casesHavingSameTransactionWithSameHitRules =
          casesHavingSameTransaction.filter((c) => {
            return hitRuleInstanceIds.every((ruleInstanceId) =>
              c.alerts?.find(
                (alert) =>
                  alert.ruleInstanceId === ruleInstanceId &&
                  alert.transactionIds?.includes(
                    filteredTransaction.transactionId
                  )
              )
            )
          })
        if (casesHavingSameTransactionWithSameHitRules.length > 0) {
          continue
        }
      }
      const now = Date.now()

      const delayTimestamps = filteredHitRules.map((hitRule) => {
        const ruleInstanceMatch: RuleInstance | undefined = ruleInstances.find(
          (x) => hitRule.ruleInstanceId === x.id
        )
        const availableAfterTimestamp: number | undefined =
          ruleInstanceMatch?.alertConfig?.alertCreationInterval != null
            ? calculateCaseAvailableDate(
                now,
                ruleInstanceMatch?.alertConfig?.alertCreationInterval,
                this.tenantSettings.tenantTimezone ?? getDefaultTimezone()
              )
            : undefined
        return {
          hitRule,
          ruleInstance: ruleInstanceMatch,
          availableAfterTimestamp,
        }
      })
      const delayTimestampsGroups = Object.entries(
        groupBy(delayTimestamps, (x) => x.availableAfterTimestamp)
      ).map(([key, values]) => ({
        availableAfterTimestamp:
          key === 'undefined' ? undefined : parseInt(key),
        hitRules: values.map((x) => x.hitRule).filter(notNullish),
        ruleInstances: values.map((x) => x.ruleInstance).filter(notNullish),
      }))

      const casesParams: SubjectCasesQueryParams = {
        filterOutCaseStatus: 'CLOSED',
        filterMaxTransactions: MAX_TRANSACTION_IN_A_CASE,
        filterAvailableAfterTimestamp: delayTimestampsGroups.map(
          ({ availableAfterTimestamp }) => availableAfterTimestamp
        ),
        filterCaseType: 'SYSTEM',
      }
      const cases = await this.getCasesBySubject(subject, casesParams)

      for (const {
        availableAfterTimestamp,
        ruleInstances,
        hitRules,
      } of delayTimestampsGroups) {
        const existedCase = cases.find(
          (x) =>
            x.availableAfterTimestamp === availableAfterTimestamp ||
            (x.availableAfterTimestamp == null &&
              availableAfterTimestamp == null)
        )

        if (existedCase) {
          logger.info(`Existed case for user`, {
            existedCaseId: existedCase?.caseId ?? null,
            existedCaseTransactionsIdsLength: (
              existedCase?.caseTransactionsIds || []
            ).length,
          })

          const unclosedAlerts =
            existedCase.alerts?.filter((a) => a.alertStatus !== 'CLOSED') ?? []
          const closedAlerts =
            existedCase.alerts?.filter((a) => a.alertStatus === 'CLOSED') ?? []
          const updatedAlerts = await this.getOrCreateAlertsForExistingCase(
            hitRules,
            unclosedAlerts,
            ruleInstances,
            params.createdTimestamp,
            filteredTransaction,
            params.latestTransactionArrivalTimestamp,
            params.checkListTemplates
          )
          const alerts = [...updatedAlerts, ...closedAlerts]

          const caseTransactionsIds = uniq(
            [
              ...(existedCase.caseTransactionsIds ?? []),
              filteredTransaction?.transactionId as string,
            ].filter(Boolean)
          )

          logger.info('Update existed case with transaction')
          result.push({
            ...existedCase,
            latestTransactionArrivalTimestamp:
              params.latestTransactionArrivalTimestamp,
            caseTransactionsIds,
            caseAggregates:
              this.getCaseAggregatesFromTransactionsWithExistingAggregates(
                [filteredTransaction as InternalTransaction],
                existedCase.caseAggregates
              ),
            caseTransactionsCount: caseTransactionsIds.length,
            priority: minBy(alerts, 'priority')?.priority ?? last(PRIORITYS),
            alerts,
            updatedAt: now,
          })
        } else {
          logger.info('Create a new case for a transaction')
          result.push({
            ...(subject.type === 'USER'
              ? this.getNewUserCase(direction, subject.user)
              : this.getNewPaymentCase(direction, subject.paymentDetails)),
            createdTimestamp:
              availableAfterTimestamp ?? params.createdTimestamp,
            latestTransactionArrivalTimestamp:
              params.latestTransactionArrivalTimestamp,
            caseAggregates: {
              originPaymentMethods: filteredTransaction?.originPaymentDetails
                ?.method
                ? [filteredTransaction?.originPaymentDetails?.method]
                : [],
              destinationPaymentMethods: filteredTransaction
                ?.destinationPaymentDetails?.method
                ? [filteredTransaction?.destinationPaymentDetails?.method]
                : [],
              tags: uniqObjects(compact(filteredTransaction?.tags ?? [])),
            },
            caseTransactionsIds: filteredTransaction
              ? [filteredTransaction.transactionId as string]
              : [],
            caseTransactionsCount: filteredTransaction ? 1 : 0,
            priority: params.priority,
            availableAfterTimestamp,
            alerts: await this.getAlertsForNewCase(
              hitRules,
              ruleInstances,
              params.createdTimestamp,
              params.latestTransactionArrivalTimestamp,
              params.transaction,
              params.checkListTemplates
            ),
            updatedAt: now,
          })
        }
      }
    }
    return result
  }

  private getCaseAggregatesFromTransactionsWithExistingAggregates(
    transactions: InternalTransaction[],
    caseAggregates: CaseAggregates
  ): CaseAggregates {
    const originPaymentMethods = uniq(
      compact(
        transactions.map(
          (transaction) => transaction?.originPaymentDetails?.method
        )
      ).concat(caseAggregates?.originPaymentMethods ?? [])
    )

    const destinationPaymentMethods = uniq(
      compact(
        transactions.map(
          (transaction) => transaction?.destinationPaymentDetails?.method
        )
      ).concat(caseAggregates?.destinationPaymentMethods ?? [])
    )

    const tags = uniqObjects(
      transactions
        .flatMap((transaction) => transaction?.tags ?? [])
        .concat(caseAggregates?.tags ?? [])
    )

    return {
      originPaymentMethods,
      destinationPaymentMethods,
      tags,
    }
  }

  async handleTransaction(
    transaction: InternalTransaction,
    ruleInstances: RuleInstance[],
    transactionSubjects: Record<RuleHitDirection, CaseSubject | undefined>
  ): Promise<Case[]> {
    logger.info(`Handling transaction for case creation`, {
      transactionId: transaction.transactionId,
    })
    const result: Case[] = []

    const casePriority = CaseRepository.getPriority(
      ruleInstances.map((ruleInstance) => ruleInstance.casePriority)
    )

    const now = Date.now()

    logger.info(`Updating cases`, {
      transactionId: transaction.transactionId,
    })
    const hitSubjects: Array<{
      subject: CaseSubject
      direction: RuleHitDirection
    }> = []

    // Collect all hit directions from rule hits
    const hitDirections: Set<RuleHitDirection> = new Set()
    for (const hitRule of transaction.hitRules) {
      const ruleInstance = ruleInstances.find(
        (x) => x.id === hitRule.ruleInstanceId
      )
      if (ruleInstance && hitRule.ruleHitMeta?.hitDirections != null) {
        for (const ruleHitDirection of hitRule.ruleHitMeta.hitDirections) {
          hitDirections.add(ruleHitDirection)
        }
      }
    }

    // Create a hit user for every hit direction
    for (const ruleHitDirection of hitDirections) {
      const hitDirectionSubject = transactionSubjects[ruleHitDirection]
      if (hitDirectionSubject) {
        hitSubjects.push({
          subject: hitDirectionSubject,
          direction: ruleHitDirection,
        })
      }
    }

    const checkListTemplates = await this.getCheckListTemplates(
      ruleInstances,
      transaction.hitRules
    )

    const cases = await this.getOrCreateCases(
      hitSubjects,
      {
        createdTimestamp: now,
        latestTransactionArrivalTimestamp: now,
        priority: casePriority,
        transaction,
        hitRules: transaction.hitRules,
        checkListTemplates,
      },
      ruleInstances
    )
    result.push(...cases)

    const savedCases = await Promise.all(
      result.map((caseItem) => this.addOrUpdateCase(caseItem))
    )

    logger.info(`Updated/created cases count`, {
      count: savedCases.length,
    })

    return this.updateRelatedCases(savedCases)
  }

  async handleUser(user: InternalUser): Promise<Case[]> {
    logger.info(`Handling user for case creation`, {
      userId: user.userId,
    })
    const hitRules = user.hitRules ?? []
    if (hitRules.length === 0) {
      return []
    }

    const ruleInstances =
      await this.ruleInstanceRepository.getRuleInstancesByIds(
        hitRules.map((hitRule) => hitRule.ruleInstanceId)
      )
    const casePriority = CaseRepository.getPriority(
      ruleInstances.map((ruleInstance) => ruleInstance.casePriority)
    )
    const now = Date.now()
    const checkListTemplates = await this.getCheckListTemplates(
      ruleInstances,
      hitRules
    )
    logger.info(`Updating cases`, {
      userId: user.userId,
    })

    const result = await this.getOrCreateCases(
      [{ subject: { type: 'USER', user }, direction: 'ORIGIN' }],
      {
        createdTimestamp: now,
        priority: casePriority,
        hitRules,
        checkListTemplates,
      },
      ruleInstances
    )

    const savedCases = await Promise.all(
      result.map((caseItem) => this.addOrUpdateCase(caseItem))
    )

    logger.info(`Updated/created cases count`, {
      count: savedCases.length,
    })

    return this.updateRelatedCases(savedCases)
  }

  private async updateRelatedCases(savedCases: Case[]): Promise<Case[]> {
    if (savedCases.length <= 1) {
      return savedCases
    }
    return await Promise.all(
      savedCases.map((nextCase) => {
        // todo: filter unpublished cases?
        const relatedCases = nextCase.relatedCases ?? []
        return this.addOrUpdateCase({
          ...nextCase,
          relatedCases: [
            ...relatedCases,
            ...savedCases
              .map(({ caseId }) => caseId)
              .filter(
                (caseId): caseId is string =>
                  caseId != null &&
                  caseId !== nextCase.caseId &&
                  !relatedCases.includes(caseId)
              ),
          ],
        })
      })
    )
  }

  getUsersByRole = memoize(async (assignedRole) => {
    const settings = await contextTenantSettings(this.caseRepository.tenantId)
    const roleService = new RoleService({
      auth0Domain:
        settings?.auth0Domain || (process.env.AUTH0_DOMAIN as string),
    })
    return (await roleService.getUsersByRole(assignedRole))
      .map((user) => user?.user_id)
      .filter((user) => user !== undefined && user !== '')
  })

  async getRuleAlertAssignee(assignees?: string[], assignedRole?: string) {
    let assigneeId: string | undefined
    if ((assignees?.length ?? 0) >= 1) {
      assigneeId = sample(assignees)
    } else if (assignedRole) {
      const roleUsers = await this.getUsersByRole(assignedRole)
      assigneeId = sample(roleUsers)
    }
    return assigneeId
      ? ({
          assigneeUserId: assigneeId,
          assignedByUserId: FLAGRIGHT_SYSTEM_USER,
          timestamp: Date.now(),
        } as Assignment)
      : null
  }
}
