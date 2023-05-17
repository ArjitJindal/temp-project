import { migrateAllTenants } from '../utils/tenant'
import { tenantHasFeature } from '@/core/middlewares/tenant-has-feature'
import { Tenant } from '@/services/accounts'
import { RiskScoringService } from '@/services/risk-scoring'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongoDBUtils'

async function migrateTenant(tenant: Tenant) {
  if (!(await tenantHasFeature(tenant.id, 'PULSE'))) {
    return
  }
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
