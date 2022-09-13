import { StackConstants } from '@cdk/constants'
import { migrateAllTenants } from '../utils/tenant'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { Tenant } from '@/@types/openapi-internal/Tenant'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function migrateTenant(tenant: Tenant) {
  const dynamodb = await getDynamoDbClient()
  const mongodb = await getMongoDbClient(StackConstants.MONGO_DB_DATABASE_NAME)
  const ruleInstanceRepo = new RuleInstanceRepository(tenant.id, {
    dynamoDb: dynamodb,
    mongoDb: mongodb,
  })
  const ruleInstances = await ruleInstanceRepo.getAllRuleInstances()
  for (const ruleInstance of ruleInstances) {
    console.log(`Migrate ruleInstance ${ruleInstance.id}`)
    ruleInstance.casePriority = 'P1'
    ruleInstance.caseCreationType = 'TRANSACTION'
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}

export const down = async () => {
  //skipped
}
