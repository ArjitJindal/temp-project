import { compact, groupBy, isEqual, last, minBy, uniq, uniqBy } from 'lodash'
import {
  CaseRepository,
  MAX_TRANSACTION_IN_A_CASE,
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
    const originHit = transaction.hitRules.find(
      (hitRule) =>
        hitRule.ruleHitMeta?.hitDirections?.includes('ORIGIN') ?? false
    )
    const destinationHit = transaction.hitRules.find(
      (hitRule) =>
        hitRule.ruleHitMeta?.hitDirections?.includes('DESTINATION') ?? false
    )

    logger.info(`Fetching case users by ids`, {
      destinationUserId,
      originUserId,
    })

    let origin: CaseSubject | undefined = undefined
    if (isAnyRuleHasOriginHit) {
      const subjectType = originHit?.ruleHitMeta?.subjectType ?? 'USER'
      const createFor = originHit?.ruleHitMeta?.createCaseFor
      if (createFor == null || createFor === subjectType)
        if (subjectType === 'USER') {
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
      const subjectType = destinationHit?.ruleHitMeta?.subjectType ?? 'USER'
      if (subjectType === 'USER') {
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
            origin = {
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

  public separateExistingAndNewAlerts(
    hitRules: HitRulesDetails[],
    ruleInstances: readonly RuleInstance[],
    alerts: Alert[],
    createdTimestamp: number,
    latestTransactionArrivalTimestamp?: number,
    transaction?: InternalTransaction,
    checkListTemplates?: ChecklistTemplate[]
  ): { existingAlerts: Alert[]; newAlerts: Alert[] } {
    // Get the rule hits that are new for this transaction
    const newRuleHits = hitRules.filter(
      (hitRule) =>
        !alerts.some((alert) => alert.ruleInstanceId === hitRule.ruleInstanceId)
    )

    // Get the alerts that are new for this transaction
    const newAlerts =
      newRuleHits.length > 0
        ? this.getAlertsForNewCase(
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

  private getOrCreateAlertsForExistingCase(
    hitRules: HitRulesDetails[],
    alerts: Alert[] | undefined,
    ruleInstances: readonly RuleInstance[],
    createdTimestamp: number,
    latestTransaction?: InternalTransaction,
    latestTransactionArrivalTimestamp?: number,
    checkListTemplates?: ChecklistTemplate[]
  ) {
    if (alerts) {
      const { existingAlerts, newAlerts } = this.separateExistingAndNewAlerts(
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

  private getAlertsForNewCase(
    hitRules: HitRulesDetails[],
    ruleInstances: readonly RuleInstance[],
    createdTimestamp: number,
    latestTransactionArrivalTimestamp?: number,
    transaction?: InternalTransaction,
    checkListTemplates?: ChecklistTemplate[]
  ): Alert[] {
    const alerts: Alert[] = hitRules.map((hitRule: HitRulesDetails) => {
      const ruleInstanceMatch: RuleInstance | null =
        ruleInstances.find(
          (ruleInstance) => hitRule.ruleInstanceId === ruleInstance.id
        ) ?? null

      const now = Date.now()
      const availableAfterTimestamp: number | undefined =
        ruleInstanceMatch?.alertCreationInterval != null
          ? calculateCaseAvailableDate(
              now,
              ruleInstanceMatch?.alertCreationInterval,
              this.tenantSettings.tenantTimezone ?? getDefaultTimezone()
            )
          : undefined
      const ruleChecklist = checkListTemplates?.find(
        (x) => x.id === ruleInstanceMatch?.checklistTemplateId
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
      }
    })

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
    }
    return caseEntity
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
    const newCase = await this.caseRepository.addCaseMongo({
      alerts: newCaseAlerts,
      createdTimestamp: now,
      caseStatus: 'OPEN',
      caseType: 'SYSTEM',
      priority: minBy(newCaseAlerts, 'priority')?.priority ?? last(PRIORITYS),
      relatedCases: sourceCase.caseId
        ? [...(sourceCase.relatedCases ?? []), sourceCase.caseId]
        : sourceCase.relatedCases,
      caseUsers: sourceCase.caseUsers,
      caseTransactions: newCaseAlertsTransactions,
      caseTransactionsIds,
      caseTransactionsCount: caseTransactionsIds.length,
      updatedAt: now,
    })

    const oldCaseTransactionsIds = uniq(
      oldCaseAlertsTransactions.map(({ transactionId }) => transactionId)
    )

    // Save old case
    await this.caseRepository.addCaseMongo({
      ...sourceCase,
      alerts: oldCaseAlerts,
      caseTransactions: oldCaseAlertsTransactions,
      caseTransactionsIds: oldCaseTransactionsIds,
      caseTransactionsCount: oldCaseTransactionsIds.length,
      priority: minBy(oldCaseAlerts, 'priority')?.priority ?? last(PRIORITYS),
      updatedAt: now,
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
          hitRule.ruleHitMeta?.hitDirections != null &&
          !hitRule.ruleHitMeta?.hitDirections.some(
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

      if (subject.type === 'USER') {
        const userId = subject.user.userId
        if (userId == null) {
          continue
        }
        if (filteredTransaction) {
          const casesHavingSameTransaction =
            await this.caseRepository.getCasesByUserId(userId, {
              filterTransactionId: filteredTransaction.transactionId,
              filterCaseType: 'SYSTEM',
            })
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
            break
          }
        }
      }
      // const userId = subject.user.userId
      const now = Date.now()

      const delayTimestamps = filteredHitRules.map((hitRule) => {
        const ruleInstanceMatch: RuleInstance | undefined = ruleInstances.find(
          (x) => hitRule.ruleInstanceId === x.id
        )
        const availableAfterTimestamp: number | undefined =
          ruleInstanceMatch?.alertCreationInterval != null
            ? calculateCaseAvailableDate(
                now,
                ruleInstanceMatch?.alertCreationInterval,
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

      const casesParams = {
        filterOutCaseStatus: 'CLOSED',
        filterMaxTransactions: MAX_TRANSACTION_IN_A_CASE,
        filterAvailableAfterTimestamp: delayTimestampsGroups.map(
          ({ availableAfterTimestamp }) => availableAfterTimestamp
        ),
        filterCaseType: 'SYSTEM',
      } as const
      const cases =
        subject.type === 'USER'
          ? await this.caseRepository.getCasesByUserId(
              subject.user.userId,
              casesParams
            )
          : await this.caseRepository.getCasesByPaymentDetails(
              subject.paymentDetails,
              casesParams
            )

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

          const alerts = this.getOrCreateAlertsForExistingCase(
            hitRules,
            existedCase.alerts,
            ruleInstances,
            params.createdTimestamp,
            filteredTransaction,
            params.latestTransactionArrivalTimestamp,
            params.checkListTemplates
          )

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
            caseTransactions: uniqBy(
              // NOTE: filteredTransaction comes first to replace the existing transaction
              [
                filteredTransaction,
                ...(existedCase.caseTransactions ?? []),
              ].filter(Boolean) as InternalTransaction[],
              (t) => t.transactionId
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
            caseTransactionsIds: filteredTransaction
              ? [filteredTransaction.transactionId as string]
              : [],
            caseTransactionsCount: filteredTransaction ? 1 : 0,
            caseTransactions: filteredTransaction ? [filteredTransaction] : [],
            priority: params.priority,
            availableAfterTimestamp,
            alerts: this.getAlertsForNewCase(
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
      result.map((caseItem) => this.caseRepository.addCaseMongo(caseItem))
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
      result.map((caseItem) => this.caseRepository.addCaseMongo(caseItem))
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
        return this.caseRepository.addCaseMongo({
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
}
