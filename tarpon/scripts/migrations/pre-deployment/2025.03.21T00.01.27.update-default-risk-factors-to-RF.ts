import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts/repository'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { CounterRepository } from '@/services/counter/repository'
import { isDefaultRiskFactor } from '@/services/risk-scoring/utils'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const riskRepository = new RiskRepository(tenant.id, { dynamoDb, mongoDb })
  const riskFactors = await riskRepository.getAllRiskFactors()
  const v2Factors = riskFactors.filter((val) => isDefaultRiskFactor(val))
  const incorrectFactors = riskFactors.filter(
    (val) => !val.parameter && !val.id.startsWith('RF')
  )
  await Promise.all(
    incorrectFactors.map(async (val) => {
      await riskRepository.deleteRiskFactor(val.id)
    })
  )
  const counterRepository = new CounterRepository(tenant.id, {
    mongoDb,
    dynamoDb,
  })
  let counter = await counterRepository.getNextCounter('RC')
  for (const factor of v2Factors) {
    const id = factor.id
    const newId = `RF-${counter.toString().padStart(3, '0')}`
    await dynamoDb.send(
      new PutCommand({
        TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(tenant.id),
        Item: {
          ...factor,
          id: newId,
          ...DynamoDbKeys.RISK_FACTOR(tenant.id, newId),
        },
      })
    )
    await riskRepository.deleteRiskFactor(id)
    await counterRepository.getNextCounterAndUpdate('RC')
    counter++
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
