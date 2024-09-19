import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { isEmpty, isEqual, pick } from 'lodash'
import { StackConstants } from '@lib/constants'
import { logger } from '../logger'
import { DynamoDbKeys } from '../dynamodb/dynamodb-keys'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { getUsers } from '@/core/seed/data/users'
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
import { disableLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'
import { getAggregatedRuleStatus } from '@/services/rules-engine/utils'
import { DYNAMO_ONLY_USER_ATTRIBUTES } from '@/services/users/utils/user-utils'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'
import { BusinessWithRulesResult } from '@/@types/openapi-internal/BusinessWithRulesResult'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { isDemoTenant } from '@/utils/tenant'
import { getArsScores } from '@/core/seed/data/ars_scores'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { dangerouslyDeletePartition } from '@/utils/dynamodb'

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
  for (const ruleInstance of ruleInstances()) {
    await ruleRepo.createOrUpdateRuleInstance(ruleInstance)
  }

  logger.info('Creating users...')
  const users = getUsers()
  for (const user of users) {
    const type = user.type as UserType
    const dynamoUser = pick<UserWithRulesResult | BusinessWithRulesResult>(
      user,
      DYNAMO_ONLY_USER_ATTRIBUTES
    ) as UserWithRulesResult | BusinessWithRulesResult

    await userRepo.saveUser(dynamoUser, type)
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
  }

  const riskRepo = new RiskRepository(tenantId, {
    dynamoDb,
  })
  for (const arsScore of getArsScores()) {
    await riskRepo.createOrUpdateArsScore(
      arsScore.transactionId as string,
      arsScore.arsScore,
      arsScore.originUserId,
      arsScore.destinationUserId,
      arsScore.components
    )
  }

  if (isDemoTenant(tenantId)) {
    const nonDemoTenantId = tenantId.replace(/-test$/, '')
    const nonDemoTenantRepo = new TenantRepository(nonDemoTenantId, {
      dynamoDb,
    })
    const nonDemoSettings = await nonDemoTenantRepo.getTenantSettings()
    const demoSettings = await tenantRepo.getTenantSettings()
    if (!isEmpty(nonDemoSettings) && !isEqual(demoSettings, nonDemoSettings)) {
      logger.info('Setting tenant settings...')
      await tenantRepo.createOrUpdateTenantSettings(nonDemoSettings)
    }
  }
}
