import _ from 'lodash'
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
import { CaseTransaction } from '@/@types/openapi-internal/CaseTransaction'
import { logger } from '@/core/logger'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { HitRulesDetails } from '@/@types/openapi-internal/HitRulesDetails'
import { PRIORITYS } from '@/@types/openapi-internal-custom/Priority'
import { TransactionCaseManagement } from '@/@types/openapi-internal/TransactionCaseManagement'

export class CaseCreationService {
  caseRepository: CaseRepository
  userRepository: UserRepository
  ruleInstanceRepository: RuleInstanceRepository
  transactionRepository: MongoDbTransactionRepository

  constructor(
    caseRepository: CaseRepository,
    userRepository: UserRepository,
    ruleInstanceRepository: RuleInstanceRepository,
    transactionRepository: MongoDbTransactionRepository
  ) {
    this.caseRepository = caseRepository
    this.userRepository = userRepository
    this.ruleInstanceRepository = ruleInstanceRepository
    this.transactionRepository = transactionRepository
  }

  async getUsers(
    transaction: TransactionWithRulesResult
  ): Promise<(InternalConsumerUser | InternalBusinessUser)[]> {
    const userIds = []
    if (transaction.originUserId) userIds.push(transaction.originUserId)
    if (transaction.destinationUserId)
      userIds.push(transaction.destinationUserId)
    if (userIds.length) {
      return await this.userRepository.getMongoUsersByIds(userIds)
    } else {
      return []
    }
  }

  private async getUser(
    userId: string | undefined
  ): Promise<InternalConsumerUser | InternalBusinessUser | null> {
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

  private async getTransactionUsers(
    transaction: TransactionWithRulesResult
  ): Promise<
    Record<
      RuleHitDirection,
      InternalConsumerUser | InternalBusinessUser | undefined
    >
  > {
    const { destinationUserId, originUserId } = transaction
    logger.info(`Fetching case users by ids`, {
      destinationUserId,
      originUserId,
    })
    return {
      ORIGIN: (await this.getUser(originUserId)) ?? undefined,
      DESTINATION: (await this.getUser(destinationUserId)) ?? undefined,
    }
  }

  public separateExistingAndNewAlerts(
    hitRules: HitRulesDetails[],
    ruleInstances: readonly RuleInstance[],
    alerts: Alert[],
    createdTimestamp: number,
    latestTransactionArrivalTimestamp: number,
    transactionId: string
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
            transactionId
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
    latestTransaction: CaseTransaction,
    latestTransactionArrivalTimestamp: number
  ) {
    if (alerts) {
      const { existingAlerts, newAlerts } = this.separateExistingAndNewAlerts(
        hitRules,
        ruleInstances,
        alerts,
        createdTimestamp,
        latestTransactionArrivalTimestamp,
        latestTransaction.transactionId
      )

      const updatedExistingAlerts =
        existingAlerts.length > 0
          ? this.updateExistingAlerts(
              existingAlerts,
              latestTransaction,
              latestTransactionArrivalTimestamp
            )
          : []

      return [...updatedExistingAlerts, ...newAlerts]
    } else {
      return this.getAlertsForNewCase(
        hitRules,
        ruleInstances,
        createdTimestamp,
        latestTransactionArrivalTimestamp,
        latestTransaction.transactionId
      )
    }
  }

  private getAlertsForNewCase(
    hitRules: HitRulesDetails[],
    ruleInstances: readonly RuleInstance[],
    createdTimestamp: number,
    latestTransactionArrivalTimestamp: number,
    transactionId: string
  ): Alert[] {
    const alerts: Alert[] = hitRules.map((hitRule: HitRulesDetails) => {
      let priority
      ruleInstances.map((ruleInstance: RuleInstance) => {
        if (hitRule.ruleInstanceId === ruleInstance.id) {
          priority = ruleInstance.casePriority
        }
      })
      return {
        createdTimestamp: createdTimestamp,
        latestTransactionArrivalTimestamp: latestTransactionArrivalTimestamp,
        alertStatus: 'OPEN',
        ruleId: hitRule.ruleId,
        ruleInstanceId: hitRule.ruleInstanceId,
        ruleName: hitRule.ruleName,
        ruleDescription: hitRule.ruleDescription,
        ruleAction: hitRule.ruleAction,
        numberOfTransactionsHit: 1,
        transactionIds: [transactionId],
        priority: (priority ?? _.last(PRIORITYS)) as Priority,
      }
    })

    return alerts
  }

  private updateExistingAlerts(
    alerts: Alert[],
    transaction: CaseTransaction,
    latestTransactionArrivalTimestamp: number
  ): Alert[] {
    return alerts.map((alert) => {
      const txnSet = new Set(alert.transactionIds).add(
        transaction.transactionId
      )
      return {
        ...alert,
        latestTransactionArrivalTimestamp: latestTransactionArrivalTimestamp,
        transactionIds: Array.from(txnSet),
        numberOfTransactionsHit: txnSet.size,
      }
    })
  }

  private getNewCase(
    direction: RuleHitDirection,
    user: InternalConsumerUser | InternalBusinessUser
  ): Case {
    const caseEntity: Case = {
      caseStatus: 'OPEN',
      caseUsers: {
        origin: direction === 'ORIGIN' ? user : undefined,
        destination: direction === 'DESTINATION' ? user : undefined,
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
    const transactionPredicate = (transaction: TransactionCaseManagement) => {
      return newCaseAlertsTransactionsIds.includes(transaction.transactionId)
    }
    const newCaseAlertsTransactions =
      allAlertsTransactions.filter(transactionPredicate)
    const oldCaseAlertsTransactions = allAlertsTransactions.filter(
      (x) => !transactionPredicate(x)
    )

    // Create new case
    const newCase = await this.caseRepository.addCaseMongo({
      alerts: newCaseAlerts,
      createdTimestamp: Date.now(),
      caseStatus: 'OPEN',
      priority:
        _.minBy(newCaseAlerts, 'priority')?.priority ?? _.last(PRIORITYS),
      relatedCases: sourceCase.caseId
        ? [...(sourceCase.relatedCases ?? []), sourceCase.caseId]
        : sourceCase.relatedCases,
      caseUsers: sourceCase.caseUsers,
      caseTransactions: newCaseAlertsTransactions,
      caseTransactionsIds: _.uniq(
        newCaseAlertsTransactions.map(({ transactionId }) => transactionId)
      ),
    })

    // Save old case
    await this.caseRepository.addCaseMongo({
      ...sourceCase,
      alerts: oldCaseAlerts,
      caseTransactions: oldCaseAlertsTransactions,
      caseTransactionsIds: _.uniq(
        oldCaseAlertsTransactions.map(({ transactionId }) => transactionId)
      ),
      priority:
        _.minBy(oldCaseAlerts, 'priority')?.priority ?? _.last(PRIORITYS),
    })
    return newCase
  }

  private async getOrCreateCases(
    hitUsers: Array<{
      user: InternalConsumerUser | InternalBusinessUser
      direction: RuleHitDirection
    }>,
    params: {
      createdTimestamp: number
      latestTransactionArrivalTimestamp: number
      priority: Priority
      transaction: CaseTransaction
    },
    ruleInstances: ReadonlyArray<RuleInstance>
  ): Promise<Case[]> {
    logger.info(`Hit directions to create or update user cases`, {
      hitDirections: hitUsers.map((hitUser) => hitUser.direction),
      hitUserIds: hitUsers.map((hitUser) => hitUser.user.userId),
    })
    const result: Case[] = []
    for (const hitUser of hitUsers) {
      const userId = hitUser.user.userId
      const filteredTransaction = {
        ...params.transaction,
        // keep only user related hits
        hitRules: params.transaction.hitRules.filter((hitRule) => {
          if (
            hitRule.ruleHitMeta?.hitDirections != null &&
            !hitRule.ruleHitMeta?.hitDirections.some(
              (hitDirection) => hitDirection === hitUser.direction
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
        }),
      }
      if (userId != null) {
        const cases = await this.caseRepository.getCasesByUserId(userId, {
          filterOutCaseStatus: 'CLOSED',
          filterMaxTransactions: MAX_TRANSACTION_IN_A_CASE,
        })
        const existedCase = cases.find(
          ({ caseStatus }) => caseStatus !== 'CLOSED'
        )
        logger.info(`Existed case for user`, {
          existedCaseId: existedCase?.caseId ?? null,
          existedCaseTransactionsIdsLength: (
            existedCase?.caseTransactionsIds || []
          ).length,
        })

        if (existedCase) {
          const alerts = this.getOrCreateAlertsForExistingCase(
            params.transaction.hitRules,
            existedCase.alerts,
            ruleInstances,
            params.createdTimestamp,
            filteredTransaction,
            params.latestTransactionArrivalTimestamp
          )

          logger.info('Update existed case with transaction')
          result.push({
            ...existedCase,
            latestTransactionArrivalTimestamp:
              params.latestTransactionArrivalTimestamp,
            caseTransactionsIds: [
              ...(existedCase.caseTransactionsIds ?? []),
              filteredTransaction.transactionId as string,
            ],
            caseTransactions: [
              ...(existedCase.caseTransactions ?? []),
              filteredTransaction,
            ],
            priority:
              _.minBy(alerts, 'priority')?.priority ?? _.last(PRIORITYS),
            alerts,
          })
        } else {
          logger.info('Create a new user case for a transaction')
          result.push({
            ...this.getNewCase(hitUser.direction, hitUser.user),
            createdTimestamp: params.createdTimestamp,
            latestTransactionArrivalTimestamp:
              params.latestTransactionArrivalTimestamp,
            caseTransactionsIds: [filteredTransaction.transactionId as string],
            caseTransactions: [filteredTransaction],
            priority: params.priority,
            alerts: this.getAlertsForNewCase(
              params.transaction.hitRules,
              ruleInstances,
              params.createdTimestamp,
              params.latestTransactionArrivalTimestamp,
              params.transaction.transactionId
            ),
          })
        }
      }
    }
    return result
  }

  async handleTransaction(
    transaction: TransactionWithRulesResult
  ): Promise<Case[]> {
    logger.info(`Handling transaction for case creation`, {
      transactionId: transaction.transactionId,
    })
    const result: Case[] = []

    const transactionUsers = await this.getTransactionUsers(transaction)
    const ruleInstances =
      await this.ruleInstanceRepository.getRuleInstancesByIds(
        transaction.hitRules.map((hitRule) => hitRule.ruleInstanceId)
      )
    const casePriority = CaseRepository.getPriority(
      ruleInstances.map((ruleInstance) => ruleInstance.casePriority)
    )

    const now = Date.now()

    logger.info(`Updating user cases`, {
      transactionId: transaction.transactionId,
    })
    const hitUsers: Array<{
      user: InternalConsumerUser | InternalBusinessUser
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
      const hitDirectionUser = transactionUsers[ruleHitDirection]
      if (hitDirectionUser) {
        hitUsers.push({
          user: hitDirectionUser,
          direction: ruleHitDirection,
        })
      }
    }

    const cases = await this.getOrCreateCases(
      hitUsers,
      {
        createdTimestamp: now,
        latestTransactionArrivalTimestamp: now,
        priority: casePriority,
        transaction,
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
    if (savedCases.length > 1) {
      return await Promise.all(
        savedCases.map((nextCase) => {
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
    return savedCases
  }
}
