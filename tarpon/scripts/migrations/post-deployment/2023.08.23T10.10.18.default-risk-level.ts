import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { DEFAULT_RISK_LEVEL } from '@/services/risk-scoring/utils'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const riskRepository = new RiskRepository(tenant.id, {
    dynamoDb,
    mongoDb,
  })

  const parameterRiskItems = await riskRepository.getParameterRiskItems()

  if (parameterRiskItems?.length) {
    await Promise.all(
      parameterRiskItems.map(async (parameterRiskItem) => {
        await riskRepository.createOrUpdateParameterRiskItem({
          ...parameterRiskItem,
          defaultRiskLevel: DEFAULT_RISK_LEVEL,
        })
      })
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
