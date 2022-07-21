import { RuleAction } from '@/@types/openapi-public/RuleAction'
import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import { getTestDynamoDbClient } from '@/test-utils/dynamodb-test-utils'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import { DashboardStatsRepository } from '@/lambdas/phytoplankton-internal-api-handlers/repository/dashboard-stats-repository'
import { getMongoClient } from '@/test-utils/mongo-test-utils'

export function hitRule(ruleAction: RuleAction = 'BLOCK'): ExecutedRulesResult {
  return {
    ruleName: 'Always hit rule',
    ruleAction: ruleAction,
    ruleHit: true,
    ruleId: 'R-1',
    ruleDescription: 'Test rule which always hit',
  }
}

export function notHitRule(
  ruleAction: RuleAction = 'ALLOW'
): ExecutedRulesResult {
  return {
    ruleName: 'Always not hit rule',
    ruleAction: ruleAction,
    ruleHit: false,
    ruleId: 'R-2',
    ruleDescription: 'Test rule which never hit',
  }
}

export async function getTransactionsRepo(tenantId: string) {
  const dynamoDb = getTestDynamoDbClient()
  const mongoDb = await getMongoClient()
  return new TransactionRepository(tenantId, {
    mongoDb,
    dynamoDb,
  })
}

export async function getStatsRepo(tenantId: string) {
  const mongoDb = await getMongoClient()
  return new DashboardStatsRepository(tenantId, {
    mongoDb,
  })
}
