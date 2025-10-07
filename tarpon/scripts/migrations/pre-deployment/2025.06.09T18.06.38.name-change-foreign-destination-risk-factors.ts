import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/@types/tenant'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const riskRepository = new RiskRepository(tenant.id, { dynamoDb, mongoDb })
  const transactionFactors = await riskRepository.getAllRiskFactors(
    'TRANSACTION'
  )

  const updatedFactors = transactionFactors.map((factor) => {
    if (factor.parameter === 'domesticOrForeignOriginCountryBusiness') {
      factor.name = 'Foreign origin country (Business)'
    } else if (factor.parameter === 'domesticOrForeignOriginCountryConsumer') {
      factor.name = 'Foreign origin country (Consumer)'
    } else if (
      factor.parameter === 'domesticOrForeignDestinationCountryBusiness'
    ) {
      factor.name = 'Foreign destination country (Business)'
    }
    return factor
  })

  await Promise.all(
    updatedFactors.map((factor) =>
      riskRepository.createOrUpdateRiskFactor(factor)
    )
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
