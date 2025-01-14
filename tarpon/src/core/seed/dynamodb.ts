import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { isEmpty, isEqual, pick, uniq } from 'lodash'
import { StackConstants } from '@lib/constants'
import { logger } from '../logger'
import { DynamoDbKeys } from '../dynamodb/dynamodb-keys'
import { riskFactors } from './data/risk-factors'
import { getCases } from './data/cases'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { users } from '@/core/seed/data/users'
import { UserType } from '@/@types/user/user-type'
import { data as listsData } from '@/core/seed/data/lists'
import { ListRepository } from '@/services/list/repositories/list-repository'
import {
  internalToPublic,
  getTransactions,
} from '@/core/seed/data/transactions'
import { DynamoDbTransactionRepository } from '@/services/rules-engine/repositories/dynamodb-transaction-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { ruleInstances } from '@/core/seed/data/rules'
import {
  disableLocalChangeHandler,
  enableLocalChangeHandler,
} from '@/utils/local-dynamodb-change-handler'
import { getAggregatedRuleStatus } from '@/services/rules-engine/utils'
import { DYNAMO_ONLY_USER_ATTRIBUTES } from '@/services/users/utils/user-utils'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'
import { BusinessWithRulesResult } from '@/@types/openapi-internal/BusinessWithRulesResult'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { isDemoTenant } from '@/utils/tenant'
import {
  getArsScores,
  getDrsScores,
  getKrsScores,
} from '@/core/seed/data/ars_scores'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { dangerouslyDeletePartition } from '@/utils/dynamodb'
import { ruleStatsHandler } from '@/lambdas/tarpon-change-mongodb-consumer/app'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { DynamoAlertRepository } from '@/services/alerts/dynamo-repository'

export const DYNAMO_KEYS = ['PartitionKeyID', 'SortKeyID']

export async function seedDynamo(
  dynamoDb: DynamoDBDocumentClient,
  tenantId: string
) {
  logger.info('Seeding DynamoDB...')
  disableLocalChangeHandler()

  const userRepo = new UserRepository(tenantId, {
    dynamoDb: dynamoDb,
  })
  const listRepo = new ListRepository(tenantId, dynamoDb)
  const tenantRepo = new TenantRepository(tenantId, { dynamoDb })
  const txnRepo = new DynamoDbTransactionRepository(tenantId, dynamoDb)
  const ruleRepo = new RuleInstanceRepository(tenantId, { dynamoDb })

  logger.info('Clear rule instances')
  await dangerouslyDeletePartition(
    dynamoDb,
    tenantId,
    DynamoDbKeys.RULE_INSTANCE(tenantId).PartitionKeyID,
    StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME
  )
  logger.info('Create rule instances')
  const allRuleInstances = ruleInstances()
  for (const ruleInstance of allRuleInstances) {
    await ruleRepo.createOrUpdateRuleInstance(ruleInstance)
  }
  const riskRepo = new RiskRepository(tenantId, {
    dynamoDb,
  })
  logger.info('Creating users...')
  for (const user of users) {
    const type = user.type as UserType
    const dynamoUser = pick<UserWithRulesResult | BusinessWithRulesResult>(
      user,
      DYNAMO_ONLY_USER_ATTRIBUTES
    ) as UserWithRulesResult | BusinessWithRulesResult

    await userRepo.saveUser(dynamoUser, type)
    await ruleStatsHandler(tenantId, user?.executedRules ?? [], {
      dynamoDb,
      mongoDb: await getMongoDbClient(),
    })

    let transactionCount = 0,
      arsScoreSummation = 0
    getTransactions().forEach((tx) => {
      if (
        tx.originUserId === user.userId ||
        tx.destinationUserId === user.userId
      ) {
        if (tx.arsScore) {
          transactionCount++
          arsScoreSummation += tx.arsScore.arsScore
        }
      }
    })
    let userAvgArsScore = 0
    if (transactionCount == 0) {
      userAvgArsScore = 0
    } else {
      userAvgArsScore = arsScoreSummation / transactionCount
    }
    logger.info(`Updating average ARS score for user ${user.userId}`)
    await riskRepo.updateOrCreateAverageArsScore(user.userId, {
      userId: user.userId,
      value: userAvgArsScore,
      transactionCount: transactionCount,
      createdAt: Date.now(),
    })
  }

  logger.info('Creating lists...')
  for (const list of listsData()) {
    await listRepo.createList(
      list.listType,
      list.subtype,
      list.data,
      list.listId
    )
  }

  logger.info('Creating transactions...')
  for (const txn of getTransactions()) {
    const publicTxn = internalToPublic(txn)
    await txnRepo.saveTransaction(publicTxn, {
      status: getAggregatedRuleStatus(publicTxn.hitRules),
      executedRules: publicTxn.executedRules,
      hitRules: publicTxn.hitRules,
    })
    await ruleStatsHandler(tenantId, txn?.executedRules ?? [], {
      dynamoDb,
      mongoDb: await getMongoDbClient(),
    })
  }

  logger.info('Updating average ARS score for users...')
  const transactions = getTransactions()
  for (const user of users) {
    let transactionCount = 0,
      arsScoreSummation = 0
    transactions.forEach((tx) => {
      if (
        tx.originUserId === user.userId ||
        tx.destinationUserId === user.userId
      ) {
        if (tx.arsScore) {
          transactionCount++
          arsScoreSummation += tx.arsScore.arsScore
        }
      }
    })
    let userAvgArsScore = 0
    if (transactionCount == 0) {
      userAvgArsScore = 0
    } else {
      userAvgArsScore = arsScoreSummation / transactionCount
    }
    await riskRepo.updateOrCreateAverageArsScore(user.userId, {
      userId: user.userId,
      value: userAvgArsScore,
      transactionCount: transactionCount,
      createdAt: Date.now(),
    })
  }

  logger.info('Clear risk factors')
  await dangerouslyDeletePartition(
    dynamoDb,
    tenantId,
    DynamoDbKeys.RISK_FACTOR(tenantId).PartitionKeyID,
    StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(tenantId)
  )

  for (const arsScore of getArsScores()) {
    await riskRepo.createOrUpdateArsScore(
      arsScore.transactionId as string,
      arsScore.arsScore,
      arsScore.originUserId,
      arsScore.destinationUserId,
      arsScore.components
    )
  }

  for (const krsScore of getKrsScores()) {
    await riskRepo.createOrUpdateKrsScore(
      krsScore.userId as string,
      krsScore.krsScore,
      krsScore.components ?? [],
      krsScore.factorScoreDetails ?? [],
      krsScore.isLocked ?? false
    )
  }

  for (const drsScore of getDrsScores()) {
    await riskRepo.createOrUpdateDrsScore(
      drsScore.userId as string,
      drsScore.drsScore,
      drsScore.transactionId as string,
      drsScore.components ?? [],
      drsScore.isUpdatable,
      drsScore.factorScoreDetails
    )
  }

  console.log('Creating alerts...')
  const dynamoAlertRepository = new DynamoAlertRepository(tenantId, dynamoDb)

  for (const caseItem of getCases()) {
    enableLocalChangeHandler()
    await dynamoAlertRepository.saveAlerts(caseItem.alerts ?? [])
    disableLocalChangeHandler()
  }

  logger.info('Create risk factors')
  for (const riskFactor of riskFactors()) {
    await riskRepo.createOrUpdateRiskFactor(riskFactor)
  }
  if (isDemoTenant(tenantId)) {
    const nonDemoTenantId = tenantId.replace(/-test$/, '')
    const nonDemoTenantRepo = new TenantRepository(nonDemoTenantId, {
      dynamoDb,
    })
    const nonDemoSettings = await nonDemoTenantRepo.getTenantSettings()
    const demoSettings = await tenantRepo.getTenantSettings()
    const mergedFeatureFlags = uniq([
      ...(demoSettings.features ?? []),
      ...(nonDemoSettings.features ?? []),
    ])
    if (!isEmpty(nonDemoSettings) && !isEqual(demoSettings, nonDemoSettings)) {
      logger.info('Setting tenant settings...')
      await tenantRepo.createOrUpdateTenantSettings({
        ...nonDemoSettings,
        features: mergedFeatureFlags,
      })
    }
  }
}
