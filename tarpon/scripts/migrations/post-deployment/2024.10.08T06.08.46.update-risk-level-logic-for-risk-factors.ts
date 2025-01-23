import { isObject } from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts/repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { RiskFactorLogic } from '@/@types/openapi-internal/RiskFactorLogic'

function updateRiskLevelLogic(oldLogicDetails: any) {
  if (!isObject(oldLogicDetails)) {
    oldLogicDetails
  }
  return Object.values(oldLogicDetails)
}

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const riskRepository = new RiskRepository(tenant.id, {
    dynamoDb,
    mongoDb,
  })
  const riskFactors = await riskRepository.getAllRiskFactors()
  for (const factor of riskFactors) {
    await riskRepository.createOrUpdateRiskFactor({
      ...factor,
      riskLevelLogic: updateRiskLevelLogic(
        factor.riskLevelLogic
      ) as RiskFactorLogic[],
    })
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
