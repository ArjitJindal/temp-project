/* eslint-disable @typescript-eslint/no-var-requires */
import * as _ from 'lodash'
import { UserRepository } from '../users/repositories/user-repository'
import { Aggregators } from './aggregator'
import { RuleInstanceRepository } from './repositories/rule-instance-repository'
import { RuleRepository } from './repositories/rule-repository'
import { TransactionRepository } from './repositories/transaction-repository'
import { RuleError } from './rules/errors'
import { Rule as RuleImplementation } from './rules/rule'
import { TransactionMonitoringResult } from '@/@types/openapi-public/TransactionMonitoringResult'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { RuleAction } from '@/@types/openapi-public/RuleAction'
import { FailedRulesResult } from '@/@types/openapi-public/FailedRulesResult'
import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import { Rule } from '@/@types/openapi-internal/Rule'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { everyAsync } from '@/core/utils/array'

const DEFAULT_RULE_ACTION: RuleAction = 'ALLOW'

const ruleAscendingComparator = (
  rule1: ExecutedRulesResult | FailedRulesResult,
  rule2: ExecutedRulesResult | FailedRulesResult
) => (rule1.ruleId > rule2.ruleId ? 1 : -1)

function getRuleImplementation(
  ruleImplementationFilename: string,
  tenantId: string,
  transaction: Transaction,
  senderUser: User | Business | undefined,
  receiverUser: User | Business | undefined,
  ruleParameters: object,
  ruleAction: RuleAction,
  dynamoDb: AWS.DynamoDB.DocumentClient
) {
  const RuleClass = require(`${__dirname}/rules/${ruleImplementationFilename}`)
    .default as typeof RuleImplementation
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
  const ruleRepository = new RuleRepository(tenantId, {
    dynamoDb,
  })
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
    transaction.senderUserId
      ? userRepository.getUser<User | Business>(transaction.senderUserId)
      : undefined,
    transaction.receiverUserId
      ? userRepository.getUser<User | Business>(transaction.receiverUserId)
      : undefined,
    ruleInstanceRepository.getActiveRuleInstances(),
  ])
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
        const rule = getRuleImplementation(
          rulesById[ruleInstance.ruleId].ruleImplementationFilename,
          tenantId,
          transaction,
          senderUser,
          receiverUser,
          ruleInstance.parameters,
          ruleInstance.action,
          dynamoDb
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
