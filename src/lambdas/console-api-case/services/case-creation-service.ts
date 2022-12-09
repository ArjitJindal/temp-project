import _ from 'lodash'
import {
  CaseRepository,
  MAX_TRANSACTION_IN_A_CASE,
} from '@/services/rules-engine/repositories/case-repository'
import { Case } from '@/@types/openapi-internal/Case'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import { RuleHitDirection } from '@/@types/openapi-public/RuleHitDirection'
import { CasePriority } from '@/@types/openapi-public-management/CasePriority'
import { CASE_PRIORITY } from '@/@types/case/case-priority'
import { CaseTransaction } from '@/@types/openapi-internal/CaseTransaction'
import { logger } from '@/core/logger'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'

export class CaseCreationService {
  caseRepository: CaseRepository
  userRepository: UserRepository
  ruleInstanceRepository: RuleInstanceRepository
  transactionRepository: TransactionRepository

  constructor(
    caseRepository: CaseRepository,
    userRepository: UserRepository,
    ruleInstanceRepository: RuleInstanceRepository,
    transactionRepository: TransactionRepository
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
      return await this.userRepository.getMongoUsersById(userIds)
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

  private getNewUserCase(
    direction: RuleHitDirection,
    user: InternalConsumerUser | InternalBusinessUser
  ): Case {
    const caseEntity: Case = {
      caseType: 'USER',
      caseStatus: 'OPEN',
      caseUsers: {
        origin: direction === 'ORIGIN' ? user : undefined,
        destination: direction === 'DESTINATION' ? user : undefined,
      },
    }
    return caseEntity
  }

  private async getOrCreateUserCases(
    hitUsers: Array<{
      user: InternalConsumerUser | InternalBusinessUser
      direction: RuleHitDirection
    }>,
    params: {
      createdTimestamp: number
      latestTransactionArrivalTimestamp: number
      priority: CasePriority
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
          if (ruleInstance.caseCreationType !== 'USER') {
            return false
          }
          return true
        }),
      }
      if (userId != null) {
        const cases = await this.caseRepository.getCasesByUserId(userId, {
          filterOutCaseStatus: 'CLOSED',
          filterCaseType: 'USER',
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
            priority: _.min([
              existedCase.priority ?? _.last(CASE_PRIORITY),
              params.priority,
            ]) as CasePriority,
          })
        } else {
          logger.info('Create a new user case for a transaction')
          result.push({
            ...this.getNewUserCase(hitUser.direction, hitUser.user),
            createdTimestamp: params.createdTimestamp,
            latestTransactionArrivalTimestamp:
              params.latestTransactionArrivalTimestamp,
            caseTransactionsIds: [filteredTransaction.transactionId as string],
            caseTransactions: [filteredTransaction],
            priority: params.priority,
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
    const transactionStatus = TransactionRepository.getAggregatedRuleStatus(
      transaction.hitRules.map((rule) => rule.ruleAction)
    )
    const ruleInstances =
      await this.ruleInstanceRepository.getRuleInstancesByIds(
        transaction.hitRules.map((hitRule) => hitRule.ruleInstanceId)
      )
    const casePriority = CaseRepository.getPriority(
      ruleInstances.map((ruleInstance) => ruleInstance.casePriority)
    )

    let updateUserCase = false
    let updateTransactionCase = false
    for (const ruleInstance of ruleInstances) {
      const caseCreationType = ruleInstance.caseCreationType
      updateUserCase = updateUserCase || caseCreationType === 'USER'
      updateTransactionCase =
        updateTransactionCase || caseCreationType === 'TRANSACTION'
      if (updateUserCase && updateTransactionCase) {
        break
      }
    }

    const now = Date.now()

    // Handle user cases
    if (updateUserCase) {
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
        if (
          ruleInstance &&
          ruleInstance.caseCreationType === 'USER' &&
          hitRule.ruleHitMeta?.hitDirections != null
        ) {
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

      const userCases = await this.getOrCreateUserCases(
        hitUsers,
        {
          createdTimestamp: now,
          latestTransactionArrivalTimestamp: now,
          priority: casePriority,
          transaction,
        },
        ruleInstances
      )
      result.push(...userCases)
    }

    // Handle transaction cases
    if (updateTransactionCase) {
      logger.info(`Updating transaction cases`, {
        transactionId: transaction.transactionId,
        originUserId: transactionUsers.ORIGIN?.userId ?? null,
        desinationUserId: transactionUsers.DESTINATION?.userId ?? null,
      })
      // Check if case is possible false positive
      let isFalsePositive = true
      let overallConfidenceScore = 0
      for (const hitRule of transaction.hitRules) {
        if (
          !hitRule.ruleHitMeta ||
          !hitRule.ruleHitMeta.falsePositiveDetails ||
          !hitRule.ruleHitMeta.falsePositiveDetails?.isFalsePositive
        ) {
          isFalsePositive = false
          break
        }
        overallConfidenceScore +=
          hitRule.ruleHitMeta.falsePositiveDetails.confidenceScore
      }
      overallConfidenceScore = parseFloat(
        (overallConfidenceScore / transaction.hitRules.length).toFixed(2)
      )

      // NOTE: We only create a case for a known user
      if (
        transactionUsers.ORIGIN != null ||
        transactionUsers.DESTINATION != null
      ) {
        const existingTransactionCases =
          await this.caseRepository.getCasesByTransactionId(
            transaction.transactionId as string,
            'TRANSACTION'
          )
        logger.info(`Updating transaction cases`, {
          transactionId: transaction.transactionId,
        })
        const existingCase = existingTransactionCases.find(
          ({ caseStatus }) => caseStatus !== 'CLOSED'
        )
        const caseUsers = {
          origin: transactionUsers.ORIGIN,
          destination: transactionUsers.DESTINATION,
        }
        if (transactionStatus != 'ALLOW' && !existingCase) {
          const caseEntity: Case = {
            createdTimestamp: now,
            latestTransactionArrivalTimestamp: now,
            caseType: 'TRANSACTION',
            caseStatus: 'OPEN',
            caseTransactionsIds: [transaction.transactionId as string],
            caseTransactions: [transaction],
            caseUsers,
            priority: casePriority,
            falsePositiveDetails: isFalsePositive
              ? {
                  isFalsePositive: isFalsePositive,
                  confidenceScore: overallConfidenceScore,
                }
              : undefined,
          }
          result.push(caseEntity)
        }
        if (existingCase) {
          existingCase.caseUsers = caseUsers
          existingCase.priority = casePriority
          existingCase.caseTransactionsIds = [
            transaction.transactionId as string,
          ]
          existingCase.caseTransactions = [transaction]
          result.push(existingCase)
        }
      } else {
        logger.info(
          `Both users are not defined, do not update transaction cases`
        )
      }
    }

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
