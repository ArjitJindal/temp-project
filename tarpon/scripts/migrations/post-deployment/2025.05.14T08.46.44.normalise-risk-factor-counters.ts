import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/@types/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { CounterRepository } from '@/services/counter/repository'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const counterRepository = new CounterRepository(tenant.id, {
    mongoDb,
    dynamoDb,
  })
  const riskRepository = new RiskRepository(tenant.id, {
    dynamoDb,
    mongoDb,
  })
  const riskFactors = await riskRepository.getAllRiskFactors()
  const counter = await counterRepository.getNextCounter('RiskFactor')
  if (counter - 1 < riskFactors.length) {
    await counterRepository.setCounterValue('RiskFactor', riskFactors.length)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
