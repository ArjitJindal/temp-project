import cloneDeep from 'lodash/cloneDeep'
import flatten from 'lodash/flatten'
import isArray from 'lodash/isArray'
import set from 'lodash/set'
import unset from 'lodash/unset'
import { traverse } from '@flagright/lib/utils'
import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/@types/tenant'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { envIs } from '@/utils/env'

async function migrateTenant(tenant: Tenant) {
  if (envIs('sandbox:eu-1') && tenant.id === '59c6cf309a') {
    // Skipping as ran from local
    return
  }
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
      traverse(val.logic, (key, value, path) => {
        if (key === 'logic') {
          unset(newLogic, path)
        } else if (key === 'in' && isArray(value) && !path.includes('logic')) {
          const targetPath = [...path, '1']

          // Ensure previous value is removed before setting new one
          unset(newLogic, targetPath)

          set(
            newLogic,
            targetPath,
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
