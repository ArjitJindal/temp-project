import { RuleAction } from '@/@types/openapi-public/RuleAction'
import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import { DashboardStatsRepository } from '@/lambdas/console-api-dashboard/repositories/dashboard-stats-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongoDBUtils'

export function hitRule(ruleAction: RuleAction = 'BLOCK'): ExecutedRulesResult {
  return {
    ruleName: 'Always hit rule',
    ruleAction: ruleAction,
    ruleHit: true,
    ruleId: 'R-1',
    ruleInstanceId: '1',
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
    ruleInstanceId: '2',
    ruleDescription: 'Test rule which never hit',
  }
}

export async function getTransactionsRepo(tenantId: string) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  return new TransactionRepository(tenantId, {
    mongoDb,
    dynamoDb,
  })
}

export async function getStatsRepo(tenantId: string) {
  const mongoDb = await getMongoDbClient()
  return new DashboardStatsRepository(tenantId, {
    mongoDb,
  })
}
