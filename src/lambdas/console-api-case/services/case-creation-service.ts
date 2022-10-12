import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { Case } from '@/@types/openapi-internal/Case'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import { CaseCaseUsers } from '@/@types/openapi-internal/CaseCaseUsers'

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

  async addCasesToMongo(
    transaction: TransactionWithRulesResult
  ): Promise<Case | null> {
    //TODO add user cases, currently implemented for transaction cases
    const transactionStatus = TransactionRepository.getAggregatedRuleStatus(
      transaction.executedRules
        .filter((rule) => rule.ruleHit)
        .map((rule) => rule.ruleAction)
    )
    const ruleInstanceIds = transaction.hitRules.map(
      (ruleInstance) => ruleInstance.ruleInstanceId
    )
    const ruleInstances =
      await this.ruleInstanceRepository.getRuleInstancesByIds(ruleInstanceIds)
    const casePriority = CaseRepository.getPriority(
      ruleInstances.map((ruleInstance) => ruleInstance.casePriority)
    )

    const existingCases = await this.caseRepository.getCasesByTransactionId(
      transaction.transactionId as string,
      'TRANSACTION'
    )
    const existingCase = existingCases ? existingCases[0] : undefined

    const caseUsers: CaseCaseUsers = {}
    if (
      (existingCase &&
        !(
          existingCase.caseUsers?.origin?.userId == transaction.originUserId &&
          existingCase.caseUsers?.destination?.userId ==
            transaction.destinationUserId
        )) ||
      !existingCase
    ) {
      const users = await this.getUsers(transaction)
      for (const user of users) {
        if (user.userId == transaction.originUserId) {
          caseUsers.origin = user
        } else if (user.userId == transaction.destinationUserId) {
          caseUsers.destination = user
        }
      }
      // in case user not in db yet
      if (!caseUsers.origin && transaction.originUserId) {
        caseUsers.origin = {
          userId: transaction.originUserId,
        }
      }
      if (!caseUsers.destination && transaction.destinationUserId) {
        caseUsers.destination = {
          userId: transaction.destinationUserId,
        }
      }
    }
    if (transactionStatus != 'ALLOW' && !existingCase) {
      const caseEntity: Case = {
        createdTimestamp: Date.now(),
        latestTransactionArrivalTimestamp: Date.now(),
        caseType: 'TRANSACTION',
        caseStatus: 'OPEN',
        caseTransactions: [transaction],
        caseUsers: caseUsers,
        priority: casePriority,
      }
      return await this.caseRepository.addCaseMongo(caseEntity)
    }
    if (existingCase) {
      if (Object.keys(caseUsers).length) {
        existingCase.caseUsers = caseUsers
      }
      existingCase.priority = casePriority
      existingCase.caseTransactions = [transaction]
      return await this.caseRepository.addCaseMongo(existingCase)
    }
    return null
  }
}
