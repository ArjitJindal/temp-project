import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { Case } from '@/@types/openapi-internal/Case'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import { CaseCaseUsers } from '@/@types/openapi-internal/CaseCaseUsers'
import { RuleHitDirection } from '@/@types/openapi-public/RuleHitDirection'
import { CasePriority } from '@/@types/openapi-public-management/CasePriority'
import { CaseTransaction } from '@/@types/openapi-internal/CaseTransaction'
import { MissingUser } from '@/@types/openapi-internal/MissingUser'

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
  ): Promise<InternalConsumerUser | InternalBusinessUser | MissingUser> {
    if (userId == null) {
      return {
        userId,
      }
    }
    const user = await this.userRepository.getMongoUser(userId)
    if (user == null) {
      return {
        userId,
      }
    }
    return user
  }

  private async getCaseUsers(
    transaction: TransactionWithRulesResult
  ): Promise<CaseCaseUsers> {
    const { destinationUserId, originUserId } = transaction
    return {
      origin: await this.getUser(originUserId),
      destination: await this.getUser(destinationUserId),
    }
  }

  private getNewUserCase(
    direction: RuleHitDirection,
    caseUsers: CaseCaseUsers
  ): Case {
    const caseEntity: Case = {
      caseType: 'USER',
      caseStatus: 'OPEN',
      caseUsers: {
        origin: direction === 'ORIGIN' ? caseUsers.origin : undefined,
        destination:
          direction === 'DESTINATION' ? caseUsers.destination : undefined,
      },
    }
    return caseEntity
  }

  private async getOrCreateUserCases(
    caseUsers: CaseCaseUsers,
    ruleResultHitDirections: RuleHitDirection[],
    params: {
      createdTimestamp: number
      latestTransactionArrivalTimestamp: number
      priority: CasePriority
      transaction: CaseTransaction
    }
  ): Promise<Case[]> {
    let hitDirections: RuleHitDirection[] = []
    if (
      caseUsers.origin?.userId != null &&
      caseUsers.destination?.userId != null
    ) {
      // For now, we don't use hit direction from rule results, as
      // decided here: https://www.notion.so/flagright/Create-User-Cases-for-destination-c63393869c584279bd1f81268edd2b72
      hitDirections = ['ORIGIN', 'DESTINATION']
      // hitDirections = ruleResultHitDirections
    } else if (caseUsers.origin?.userId != null) {
      hitDirections = ['ORIGIN']
    } else if (caseUsers.destination?.userId != null) {
      hitDirections = ['DESTINATION']
    }

    const result: Case[] = []
    for (const hitDirection of hitDirections) {
      const userId =
        hitDirection === 'ORIGIN'
          ? caseUsers.origin?.userId
          : caseUsers.destination?.userId
      if (userId != null) {
        const cases = await this.caseRepository.getCasesByUserId(userId, 'USER')
        const existedCase = cases.find(
          ({ caseStatus }) => caseStatus !== 'CLOSED'
        )
        if (existedCase != null) {
          result.push({
            ...existedCase,
            latestTransactionArrivalTimestamp:
              params.latestTransactionArrivalTimestamp,
            caseTransactionsIds: [
              ...(existedCase.caseTransactionsIds ?? []),
              params.transaction.transactionId as string,
            ],
          })
        } else {
          result.push({
            ...this.getNewUserCase(hitDirection, caseUsers),
            createdTimestamp: params.createdTimestamp,
            latestTransactionArrivalTimestamp:
              params.latestTransactionArrivalTimestamp,
            caseTransactionsIds: [params.transaction.transactionId as string],
          })
        }
      }
    }
    return result
  }

  async handleTransaction(
    transaction: TransactionWithRulesResult
  ): Promise<Case[]> {
    const result: Case[] = []

    const caseUsers: CaseCaseUsers = await this.getCaseUsers(transaction)
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
      const hitDirections = new Set<RuleHitDirection>()
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
      const userCases = await this.getOrCreateUserCases(
        caseUsers,
        Array.from(hitDirections),
        {
          createdTimestamp: now,
          latestTransactionArrivalTimestamp: now,
          priority: casePriority,
          transaction: {
            ...transaction,
            // keep only user related hits
            hitRules: transaction.hitRules.filter((hit) => {
              if (
                hit.ruleHitMeta?.hitDirections != null &&
                !hit.ruleHitMeta?.hitDirections.some((x) =>
                  hitDirections.has(x)
                )
              ) {
                return false
              }
              const ruleInstance = ruleInstances.find(
                (x) => x.id === hit.ruleInstanceId
              )
              if (ruleInstance == null) {
                return false
              }
              if (ruleInstance.caseCreationType !== 'USER') {
                return false
              }
              return true
            }),
          },
        }
      )
      result.push(...userCases)
    }

    // Handle transaction cases
    if (updateTransactionCase) {
      const existingTransactionCases =
        await this.caseRepository.getCasesByTransactionId(
          transaction.transactionId as string,
          'TRANSACTION'
        )
      const existingCase = existingTransactionCases.find(
        ({ caseStatus }) => caseStatus !== 'CLOSED'
      )
      if (transactionStatus != 'ALLOW' && !existingCase) {
        const caseEntity: Case = {
          createdTimestamp: now,
          latestTransactionArrivalTimestamp: now,
          caseType: 'TRANSACTION',
          caseStatus: 'OPEN',
          caseTransactionsIds: [transaction.transactionId as string],
          caseUsers: caseUsers,
          priority: casePriority,
        }
        result.push(caseEntity)
      }
      if (existingCase) {
        if (Object.keys(caseUsers).length) {
          existingCase.caseUsers = caseUsers
        }
        existingCase.priority = casePriority
        existingCase.caseTransactionsIds = [transaction.transactionId as string]
        result.push(existingCase)
      }
    }

    const savedCases = await Promise.all(
      result.map((caseItem) => this.caseRepository.addCaseMongo(caseItem))
    )
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
