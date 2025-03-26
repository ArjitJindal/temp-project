import { cloneDeep, flatten, isArray, set } from 'lodash'
import { traverse } from '@flagright/lib/utils'
import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts/repository'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const riskRepository = new RiskRepository(tenant.id, {
    dynamoDb,
    mongoDb,
  })
  const riskFactors = await riskRepository.getAllRiskFactors()
  const affectedFactors = riskFactors.filter(
    (val) => val.parameter === 'reasonForAccountOpening'
  )
  for (const factor of affectedFactors) {
    const logicData = factor.riskLevelLogic?.map((val) => {
      const newLogic = cloneDeep(val.logic)
      traverse(val, (key, value, path) => {
        if (key === 'in') {
          if (!isArray(value)) {
            return
          }
          set(
            newLogic,
            [...path, '1'],
            isArray(value[1]) ? flatten(value[1]) : [value[1]]
          )
        }
      })
      return {
        ...val,
        logic: newLogic,
      }
    })
    await riskRepository.createOrUpdateRiskFactor({
      ...factor,
      riskLevelLogic: logicData,
    })
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
