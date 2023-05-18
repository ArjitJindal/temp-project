import { migrateAllTenants } from '../utils/tenant'
import { tenantHasFeature } from '@/core/middlewares/tenant-has-feature'
import { Tenant } from '@/services/accounts'
import { RiskScoringService } from '@/services/risk-scoring'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { USERS_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'

const getCountOfUsersWithNoRiskScore = async (tenantId: string) => {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const usersCollection = db.collection(USERS_COLLECTION(tenantId))
  return await usersCollection.countDocuments({
    krsScore: { $exists: false },
  })
}

async function migrateTenant(tenant: Tenant) {
  if (!(await tenantHasFeature(tenant.id, 'PULSE'))) {
    return
  }
  const countOfUsersWithNoRiskScore = await getCountOfUsersWithNoRiskScore(
    tenant.id
  )

  console.log(
    `Tenant ${tenant.id} has ${countOfUsersWithNoRiskScore} users with no risk score`
  )

  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const riskScoringService = new RiskScoringService(tenant.id, {
    dynamoDb,
    mongoDb,
  })

  await riskScoringService.backfillUserRiskScores()
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
