import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { OngoingScreeningUserRuleBatchJobRunner } from '@/services/batch-jobs/ongoing-screening-user-rule-batch-job-runner'

async function migrateTenant(tenant: Tenant) {
  if (tenant.id !== '0cf1ffbc6d') {
    return
  }
  const dynamoDb = getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })
  const ruleInstances = (
    await ruleInstanceRepository.getActiveRuleInstances('USER')
  ).filter((ruleInstance) =>
    ['RC-6.1', 'RC-6.2', 'RC-6.3'].includes(ruleInstance.id as string)
  )
  const runner = new OngoingScreeningUserRuleBatchJobRunner('fake-job-id')
  await runner.init(tenant.id)
  await runner.verifyUsersSequentialMode(ruleInstances)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
