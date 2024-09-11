import { migrateAllTenants } from '../utils/tenant'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SIMULATION_TASK_COLLECTION } from '@/utils/mongodb-definitions'
import { SimulationBeaconJob } from '@/@types/openapi-internal/SimulationBeaconJob'

async function migrateTenant(tenant: Tenant) {
  const { id: tenantId } = tenant
  const dynamoDb = getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })

  const existingRuleInstances =
    await ruleInstanceRepository.getAllRuleInstances()

  for (const ruleInstance of existingRuleInstances) {
    await ruleInstanceRepository.createOrUpdateRuleInstance(
      {
        ...ruleInstance,
        ruleRunMode: 'LIVE',
        ruleExecutionMode: 'SYNC',
      },
      ruleInstance.updatedAt
    )
  }

  const mongoDb = await getMongoDbClient()
  const simulationTaskCollectionName = SIMULATION_TASK_COLLECTION(tenantId)

  const db = mongoDb.db()
  const simulationTaskCollection = db.collection<SimulationBeaconJob>(
    simulationTaskCollectionName
  )

  await simulationTaskCollection.updateMany(
    { type: 'BEACON', defaultRuleInstance: { $exists: true } },
    {
      $set: {
        'defaultRuleInstance.mode': 'LIVE_SYNC',
        'iterations.$[].parameters.ruleInstance.mode': 'LIVE_SYNC',
      },
    }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
