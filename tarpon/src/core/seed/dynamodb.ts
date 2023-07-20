import _ from 'lodash'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { syncRulesLibrary } from '../../../scripts/migrations/always-run/sync-rules-library'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { init as userInit, data as usersData } from '@/core/seed/data/users'
import { UserType } from '@/@types/user/user-type'
import { init as listsInit, data as listsData } from '@/core/seed/data/lists'
import { FEATURES } from '@/@types/openapi-internal-custom/Feature'
import { ListRepository } from '@/services/list/repositories/list-repository'
import {
  internalToPublic,
  init as txnInit,
  transactions,
} from '@/core/seed/data/transactions'
import { DynamoDbTransactionRepository } from '@/services/rules-engine/repositories/dynamodb-transaction-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { ruleInstances } from '@/core/seed/data/rules'
import { disableLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'
import { HitRulesDetails } from '@/@types/openapi-public/HitRulesDetails'
import { getAggregatedRuleStatus } from '@/services/rules-engine/utils'

export async function seedDynamo(
  dynamoDb: DynamoDBDocumentClient,
  tenantId: string
) {
  disableLocalChangeHandler()
  userInit()
  listsInit()
  txnInit()
  const userRepo = new UserRepository(tenantId, {
    dynamoDb: dynamoDb,
  })
  const listRepo = new ListRepository(tenantId, dynamoDb)
  const tenantRepo = new TenantRepository(tenantId, { dynamoDb })
  const txnRepo = new DynamoDbTransactionRepository(tenantId, dynamoDb)
  const ruleRepo = new RuleInstanceRepository(tenantId, { dynamoDb })

  for (const ruleInstance of ruleInstances) {
    await ruleRepo.createOrUpdateRuleInstance(ruleInstance)
  }
  for (const user of usersData) {
    await userRepo.saveUser(_.omit(user, '_id'), (user as any).type as UserType)
  }
  for (const list of listsData) {
    await listRepo.createList(list.listType, list.subtype, list.data)
  }
  for (const txn of transactions) {
    const publicTxn = internalToPublic(txn)
    await txnRepo.saveTransaction(publicTxn, {
      status: getAggregatedRuleStatus(
        publicTxn.hitRules.map((hr: HitRulesDetails) => hr.ruleAction)
      ),
      executedRules: publicTxn.executedRules,
      hitRules: publicTxn.hitRules,
    })
  }

  await tenantRepo.createOrUpdateTenantSettings({
    features: FEATURES,
  })
  await syncRulesLibrary()
}
