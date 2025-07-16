import { RuleAction } from '@/@types/openapi-public/RuleAction'
import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { DashboardStatsRepository } from '@/services/dashboard/repositories/dashboard-stats-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { CaseRepository } from '@/services/cases/repository'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { AlertsRepository } from '@/services/alerts/repository'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import {
  transactionEventHandler,
  transactionHandler,
} from '@/lambdas/public-api-rules-engine/app'
import { getApiGatewayPostEvent } from '@/test-utils/apigateway-test-utils'

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
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  return new MongoDbTransactionRepository(tenantId, mongoDb, dynamoDb)
}

export async function getCaseRepo(tenantId: string) {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = await getDynamoDbClient()
  return new CaseRepository(tenantId, {
    mongoDb,
    dynamoDb,
  })
}
export async function getAlertRepo(tenantId: string) {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  return new AlertsRepository(tenantId, {
    mongoDb,
    dynamoDb,
  })
}

export async function getStatsRepo(tenantId: string) {
  const mongoDb = await getMongoDbClient()
  return new DashboardStatsRepository(tenantId, {
    mongoDb,
    dynamoDb: getDynamoDbClient(),
  })
}

export async function getUserRepo(tenantId: string) {
  const mongoDb = await getMongoDbClient()
  return new UserRepository(tenantId, {
    mongoDb,
  })
}

export async function getRiskRepo(tenantId: string): Promise<RiskRepository> {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = await getDynamoDbClient()
  return new RiskRepository(tenantId, {
    mongoDb,
    dynamoDb,
  })
}

export async function createTransactionEvent(
  tenantId: string,
  transaction: Transaction,
  transactionEvent: TransactionEvent,
  params?: {
    userId: string
    email: string
  }
) {
  await transactionHandler(
    getApiGatewayPostEvent(tenantId, '/transactions', transaction, {
      queryStringParameters: {
        validateOriginUserId: 'false',
        validateDestinationUserId: 'false',
      },
    }),
    null as any,
    null as any
  )
  return transactionEventHandler(
    getApiGatewayPostEvent(tenantId, '/events/transaction', transactionEvent, {
      user: {
        tenantId,
        userId: params?.userId || 'foo',
        verifiedEmail: params?.email || 'foo@test.com',
      },
    }),
    null as any,
    null as any
  )
}
