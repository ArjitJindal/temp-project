import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'

async function migrateTenant(tenant: Tenant) {
  const tenantId = tenant.id
  const dynamoDb = getDynamoDbClient()

  const riskFactorsRepository = new RiskRepository(tenantId, { dynamoDb })

  const riskFactors =
    (await riskFactorsRepository.getParameterRiskItems()) || []

  const updatedRiskFactors = riskFactors.map((riskFactor) => {
    if (riskFactor.weight === undefined) {
      riskFactor.weight = 1
    }
    return riskFactor
  })

  for (const riskFactor of updatedRiskFactors) {
    await riskFactorsRepository.createOrUpdateParameterRiskItem(riskFactor)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
