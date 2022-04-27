/* eslint-disable @typescript-eslint/no-var-requires */
import * as _ from 'lodash'
import { UserRepository } from '../users/repositories/user-repository'
import { Aggregators } from './aggregator'
import { RuleInstanceRepository } from './repositories/rule-instance-repository'
import { RuleRepository } from './repositories/rule-repository'
import { TransactionRepository } from './repositories/transaction-repository'
import { RuleError } from './transaction-rules/errors'
import { TRANSACTION_RULES } from './transaction-rules'
import { Rule as RuleBase } from './rule'
import { USER_RULES } from './user-rules'
import { UserEventRepository } from './repositories/user-event-repository'
import { TransactionMonitoringResult } from '@/@types/openapi-public/TransactionMonitoringResult'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { RuleAction } from '@/@types/openapi-public/RuleAction'
import { FailedRulesResult } from '@/@types/openapi-public/FailedRulesResult'
import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import { Rule } from '@/@types/openapi-internal/Rule'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { everyAsync } from '@/core/utils/array'
import { UserEvent } from '@/@types/openapi-public/UserEvent'
import { UserMonitoringResult } from '@/@types/openapi-public/UserMonitoringResult'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'

const DEFAULT_RULE_ACTION: RuleAction = 'ALLOW'

const ruleAscendingComparator = (
  rule1: ExecutedRulesResult | FailedRulesResult,
  rule2: ExecutedRulesResult | FailedRulesResult
) => (rule1.ruleId > rule2.ruleId ? 1 : -1)

function getTransactionRuleImplementation(
  ruleImplementationName: string,
  tenantId: string,
  transaction: Transaction,
  senderUser: User | Business | undefined,
  receiverUser: User | Business | undefined,
  ruleParameters: object,
  ruleAction: RuleAction,
  dynamoDb: AWS.DynamoDB.DocumentClient
) {
  const RuleClass = TRANSACTION_RULES[ruleImplementationName]
  if (!RuleClass) {
    throw new Error(`${ruleImplementationName} rule implementation not found!`)
  }
  return new RuleClass(
    tenantId,
    { transaction, senderUser, receiverUser },
    { parameters: ruleParameters, action: ruleAction },
    dynamoDb
  )
}

export async function verifyTransaction(
  transaction: Transaction,
  tenantId: string,
  dynamoDb: AWS.DynamoDB.DocumentClient
): Promise<TransactionMonitoringResult> {
  const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })
  const transactionRepository = new TransactionRepository(tenantId, {
    dynamoDb,
  })
  const userRepository = new UserRepository(tenantId, {
    dynamoDb,
  })
  const [senderUser, receiverUser, ruleInstances] = await Promise.all([
    transaction.originUserId
      ? userRepository.getUser<User | Business>(transaction.originUserId)
      : undefined,
    transaction.destinationUserId
      ? userRepository.getUser<User | Business>(transaction.destinationUserId)
      : undefined,
    ruleInstanceRepository.getActiveRuleInstances('TRANSACTION'),
  ])

  const { executedRules, failedRules } = await getRulesResult(
    tenantId,
    dynamoDb,
    ruleInstances,
    (ruleImplementationName, ruleInstance) =>
      getTransactionRuleImplementation(
        ruleImplementationName,
        tenantId,
        transaction,
        senderUser,
        receiverUser,
        ruleInstance.parameters,
        ruleInstance.action,
        dynamoDb
      )
  )

  // TODO: Refactor the following logic to be event-driven
  const transactionId = await transactionRepository.saveTransaction(
    transaction,
    {
      executedRules,
      failedRules,
    }
  )
  await Promise.all(
    Aggregators.map((Aggregator) =>
      new Aggregator(tenantId, transaction, dynamoDb).aggregate()
    )
  )

  return {
    transactionId,
    executedRules: executedRules,
    failedRules: failedRules,
  }
}

function getUserRuleImplementation(
  ruleImplementationName: string,
  tenantId: string,
  user: User | Business,
  userEvent: UserEvent,
  ruleParameters: object,
  ruleAction: RuleAction,
  dynamoDb: AWS.DynamoDB.DocumentClient
) {
  const RuleClass = USER_RULES[ruleImplementationName]
  if (!RuleClass) {
    throw new Error(`${ruleImplementationName} rule implementation not found!`)
  }
  return new RuleClass(
    tenantId,
    { user, userEvent },
    { parameters: ruleParameters, action: ruleAction },
    dynamoDb
  )
}

export async function verifyUserEvent(
  userEvent: UserEvent,
  tenantId: string,
  dynamoDb: AWS.DynamoDB.DocumentClient
): Promise<UserMonitoringResult> {
  const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })
  const userRepository = new UserRepository(tenantId, {
    dynamoDb,
  })
  const userEventRepository = new UserEventRepository(tenantId, { dynamoDb })

  const [user, ruleInstances] = await Promise.all([
    userRepository.getUser<User | Business>(userEvent.userId),
    ruleInstanceRepository.getActiveRuleInstances('USER'),
  ])
  const { executedRules, failedRules } = await getRulesResult(
    tenantId,
    dynamoDb,
    ruleInstances,
    (ruleImplementationName, ruleInstance) =>
      getUserRuleImplementation(
        ruleImplementationName,
        tenantId,
        user,
        userEvent,
        ruleInstance.parameters,
        ruleInstance.action,
        dynamoDb
      )
  )
  await userEventRepository.saveUserEvent(userEvent, {
    executedRules,
    failedRules,
  })

  return {
    userId: userEvent.userId,
    executedRules,
    failedRules,
  }
}

async function getRulesResult(
  tenantId: string,
  dynamoDb: AWS.DynamoDB.DocumentClient,
  ruleInstances: ReadonlyArray<RuleInstance>,
  getRuleImplementationCallback: (
    ruleImplementationName: string,
    ruleInstance: RuleInstance
  ) => RuleBase
) {
  const ruleRepository = new RuleRepository(tenantId, {
    dynamoDb,
  })
  const rulesById = _.keyBy(
    await ruleRepository.getRulesByIds(
      ruleInstances.map((ruleInstance) => ruleInstance.ruleId)
    ),
    'id'
  )
  const ruleResults = await Promise.all(
    ruleInstances.map(async (ruleInstance) => {
      const ruleInfo: Rule = rulesById[ruleInstance.ruleId]
      try {
        const rule = getRuleImplementationCallback(
          rulesById[ruleInstance.ruleId].ruleImplementationName,
          ruleInstance
        )
        const shouldCompute = await everyAsync(
          rule.getFilters(),
          async (ruleFilter) => ruleFilter()
        )
        const ruleResult = shouldCompute ? await rule.computeRule() : null
        return {
          ruleId: ruleInstance.ruleId,
          ruleName: ruleInfo.name,
          ruleDescription: ruleInfo.description,
          ruleAction: ruleResult?.action || DEFAULT_RULE_ACTION,
          ruleHit: ruleResult !== undefined,
        }
      } catch (e) {
        console.error(e)
        return {
          ruleId: ruleInstance.ruleId,
          ruleName: ruleInfo.name,
          ruleDescription: ruleInfo.description,
          failureException:
            e instanceof RuleError
              ? { exceptionName: e.name, exceptionDescription: e.message }
              : { exceptionName: 'Unknown', exceptionDescription: 'Unknown' },
        }
      }
    })
  )
  const executedRules = ruleResults
    .filter((result) => result.ruleAction)
    .sort(ruleAscendingComparator) as ExecutedRulesResult[]
  const failedRules = ruleResults
    .filter((result) => !result.ruleAction)
    .sort(ruleAscendingComparator) as FailedRulesResult[]

  return {
    executedRules,
    failedRules,
  }
}
