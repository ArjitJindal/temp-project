import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { pick } from 'lodash'
import { syncRulesLibrary } from '../../../scripts/migrations/always-run/sync-rules-library'
import { logger } from '../logger'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { getUsers } from '@/core/seed/data/users'
import { UserType } from '@/@types/user/user-type'
import { data as listsData } from '@/core/seed/data/lists'
import { FEATURES } from '@/@types/openapi-internal-custom/Feature'
import { ListRepository } from '@/services/list/repositories/list-repository'
import {
  internalToPublic,
  getTransactions,
} from '@/core/seed/data/transactions'
import { DynamoDbTransactionRepository } from '@/services/rules-engine/repositories/dynamodb-transaction-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { ruleInstances } from '@/core/seed/data/rules'
import { disableLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'
import { HitRulesDetails } from '@/@types/openapi-public/HitRulesDetails'
import { getAggregatedRuleStatus } from '@/services/rules-engine/utils'
import { DYNAMO_ONLY_USER_ATTRIBUTES } from '@/services/users/utils/user-utils'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'
import { BusinessWithRulesResult } from '@/@types/openapi-internal/BusinessWithRulesResult'

export async function seedDynamo(
  dynamoDb: DynamoDBDocumentClient,
  tenantId: string
) {
  disableLocalChangeHandler()

  const userRepo = new UserRepository(tenantId, {
    dynamoDb: dynamoDb,
  })
  const listRepo = new ListRepository(tenantId, dynamoDb)
  const tenantRepo = new TenantRepository(tenantId, { dynamoDb })
  const txnRepo = new DynamoDbTransactionRepository(tenantId, dynamoDb)
  const ruleRepo = new RuleInstanceRepository(tenantId, { dynamoDb })

  logger.info('Creating rules...')
  await syncRulesLibrary()

  logger.info('Clear rule instances')
  const existingRuleInstances = await ruleRepo.getAllRuleInstances()
  for (const ruleInstance of existingRuleInstances) {
    if (ruleInstance.id) {
      await ruleRepo.deleteRuleInstance(ruleInstance.id)
    }
  }
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
    await listRepo.createList(list.listType, list.subtype, list.data)
  }
  logger.info('Creating transactions...')
  for (const txn of getTransactions()) {
    const publicTxn = internalToPublic(txn)
    await txnRepo.saveTransaction(publicTxn, {
      status: getAggregatedRuleStatus(
        publicTxn.hitRules.map((hr: HitRulesDetails) => hr.ruleAction)
      ),
      executedRules: publicTxn.executedRules,
      hitRules: publicTxn.hitRules,
    })
  }

  logger.info('Setting tenant settings...')
  await tenantRepo.createOrUpdateTenantSettings({
    features: FEATURES,
    isAiEnabled: true,
    isPaymentApprovalEnabled: true,
    aiSourcesDisabled: [],
  })
}
