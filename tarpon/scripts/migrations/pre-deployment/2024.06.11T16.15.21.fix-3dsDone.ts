import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const riskFactorsRepository = new RiskRepository(tenant.id, { dynamoDb })
  const riskFactors =
    (await riskFactorsRepository.getParameterRiskItems()) || []
  const targetParameter = riskFactors.find(
    (r) => (r.parameter as any) === '_3dsDone'
  )
  if (targetParameter) {
    await riskFactorsRepository.createOrUpdateParameterRiskItem({
      ...targetParameter,
      parameter: '3dsDone',
    })
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
