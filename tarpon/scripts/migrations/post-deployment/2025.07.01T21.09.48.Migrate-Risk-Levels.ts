import { migrateAllTenants } from '../utils/tenant'
import { RiskService } from '@/services/risk'
import { Tenant } from '@/@types/tenant'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const riskRepository = new RiskRepository(tenant.id, {
    dynamoDb: getDynamoDbClient(),
    mongoDb,
  })
  const riskService = new RiskService(tenant.id, {
    dynamoDb,
    mongoDb,
  })

  const riskClassificationValues =
    await riskRepository.getRiskClassificationValues()

  await riskService.createOrUpdateRiskClassificationConfig(
    riskClassificationValues,
    'Inital Configuration'
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
