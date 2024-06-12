import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  ARS_SCORES_COLLECTION,
  DRS_SCORES_COLLECTION,
} from '@/utils/mongodb-definitions'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const arsCollection = db.collection<ArsScore>(
    ARS_SCORES_COLLECTION(tenant.id)
  )
  const drsCollection = db.collection<DrsScore>(
    DRS_SCORES_COLLECTION(tenant.id)
  )
  const riskFactorsRepository = new RiskRepository(tenant.id, { dynamoDb })
  const riskFactors =
    (await riskFactorsRepository.getParameterRiskItems()) || []
  const targetParameter = riskFactors.find(
    (r) => (r.parameter as any) === '_3dsDone'
  )
  if (targetParameter) {
    await riskFactorsRepository.deleteParameterRiskItem(
      '_3dsDone' as any,
      targetParameter.riskEntityType
    )
    await arsCollection.updateMany(
      { 'components.parameter': '_3dsDone' },
      { $set: { 'components.$[elem].parameter': '3dsDone' } },
      { arrayFilters: [{ 'elem.parameter': '_3dsDone' }] }
    )
    await drsCollection.updateMany(
      { 'components.parameter': '_3dsDone' },
      { $set: { 'components.$[elem].parameter': '3dsDone' } },
      { arrayFilters: [{ 'elem.parameter': '_3dsDone' }] }
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
