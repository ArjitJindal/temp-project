import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { Tenant } from '@/services/accounts'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = await getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const riskRepository = new RiskRepository(tenant.id, { dynamoDb, mongoDb })
  const parameters = (await riskRepository.getParameterRiskItems()) ?? []
  for (const parameterAttributeDetails of parameters) {
    await riskRepository.createOrUpdateParameterRiskItem(
      parameterAttributeDetails
    )
  }
}
export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
