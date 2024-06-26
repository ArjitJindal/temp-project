import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const riskRepository = new RiskRepository(tenant.id, { dynamoDb })
  const sourceOfFundsRiskItem = await riskRepository.getParameterRiskItem(
    'sourceOfFunds',
    'CONSUMER_USER'
  )
  if (!sourceOfFundsRiskItem || !sourceOfFundsRiskItem.isActive) {
    return
  }
  await riskRepository.createOrUpdateParameterRiskItem({
    ...sourceOfFundsRiskItem,
    parameterType: 'ITERABLE',
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
