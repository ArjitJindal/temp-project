import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { Tenant } from '@/services/accounts'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = await getDynamoDbClient()
  const riskRepository = new RiskRepository(tenant.id, { dynamoDb })
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
