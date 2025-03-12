import { ALL_RISK_PARAMETERS } from '@flagright/lib/utils/risk'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RiskFactorDataType } from '@/@types/openapi-internal/RiskFactorDataType'
import { v2v8IdMapper } from '@/services/risk-scoring/utils'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const riskRepo = new RiskRepository(tenant.id, {
    dynamoDb,
    mongoDb,
  })
  const riskFactors = await riskRepo.getAllRiskFactors()

  // Create counters for each risk factor type
  const typeCounters = {
    CONSUMER_USER: 1,
    BUSINESS: 1,
    TRANSACTION: 1,
    DEFAULT: 1,
  }

  for (const riskFactor of riskFactors) {
    if (riskFactor.parameter) {
      const matchingParameter = ALL_RISK_PARAMETERS.find(
        (param) =>
          param.entity === riskFactor.type &&
          param.parameter === riskFactor.parameter
      )
      const dataType = matchingParameter?.dataType
      const isDerived = matchingParameter?.isDerived

      // Get and increment the counter for this type
      const counter = typeCounters[riskFactor.type] || typeCounters.DEFAULT
      typeCounters[riskFactor.type] =
        (typeCounters[riskFactor.type] || typeCounters.DEFAULT) + 1

      const newRiskFactorId = `${v2v8IdMapper(riskFactor.type)}-${String(
        counter
      ).padStart(3, '0')}`
      const newRiskFactor = {
        ...riskFactor,
        id: newRiskFactorId,
        dataType: dataType as RiskFactorDataType,
        isDerived: isDerived,
      }
      await riskRepo.createOrUpdateRiskFactor(newRiskFactor)
      await riskRepo.deleteRiskFactor(riskFactor.id)
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}

export const down = async () => {
  // Skip rollback for this migration
}
