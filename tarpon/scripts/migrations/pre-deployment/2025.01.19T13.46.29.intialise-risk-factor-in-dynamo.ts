import { migrateAllTenants } from '../utils/tenant'
import {
  createV8FactorFromV2,
  generateV2FactorId,
  RISK_FACTORS,
} from '@/services/risk-scoring/risk-factors'
import { Tenant } from '@/services/accounts/repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { ParameterAttributeRiskValues } from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'

const getParameterMapKey = (parameter: string, type: RiskEntityType) =>
  `${parameter}:${type}`

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const riskRepository = new RiskRepository(tenant.id, { dynamoDb, mongoDb })

  const [existingParameters, riskClassification] = await Promise.all([
    riskRepository.getParameterRiskItems(),
    riskRepository.getRiskClassificationValues(),
  ])

  const parameterMap =
    existingParameters?.reduce<{
      [key: string]: ParameterAttributeRiskValues
    }>((parameterMap, newVal) => {
      parameterMap[
        getParameterMapKey(newVal.parameter, newVal.riskEntityType)
      ] = newVal
      return parameterMap
    }, {}) ?? {}

  for (const riskFactor of RISK_FACTORS) {
    const factorId = generateV2FactorId(riskFactor.parameter, riskFactor.type)
    const existingV2Factor =
      parameterMap[getParameterMapKey(riskFactor.parameter, riskFactor.type)]
    await riskRepository.createOrUpdateRiskFactor({
      id: factorId,
      ...riskFactor,
      ...(existingV2Factor &&
        createV8FactorFromV2(existingV2Factor, riskClassification)),
    })
  }
  console.log(`Initialised risk factors for tenantId: ${tenant.id}`)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
