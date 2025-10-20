import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/@types/tenant'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const riskRepository = new RiskRepository(tenant.id, { dynamoDb, mongoDb })
  const transactionFactors = await riskRepository.getAllRiskFactors(
    'TRANSACTION'
  )
  for (const factor of transactionFactors) {
    const riskLevelLogic = factor.riskLevelLogic
    if (
      (factor.parameter !== 'businessCreatedTimestamp' &&
        factor.parameter !== 'consumerCreatedTimestamp') ||
      !riskLevelLogic
    ) {
      continue
    }

    for (let i = 0; i < (riskLevelLogic?.length ?? 0); i++) {
      const logic = riskLevelLogic[i].logic
      const affectedOperatorVal = logic['and'][0]['<=']
      const updatedVar = (affectedOperatorVal[1]['var'] as string).replace(
        /SENDER$/,
        'BOTH'
      )
      riskLevelLogic[i].logic = {
        and: [
          {
            '<=': [
              affectedOperatorVal[0],
              {
                var: updatedVar,
              },
              affectedOperatorVal[2],
            ],
          },
        ],
      }
    }
    await riskRepository.createOrUpdateRiskFactor({
      ...factor,
      riskLevelLogic: riskLevelLogic,
    })
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
