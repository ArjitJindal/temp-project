import { migrateAllTenants } from '../utils/tenant'
import { envIs } from '@/utils/env'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { RiskScoringService } from '@/services/risk-scoring'
import dayjs from '@/utils/dayjs'
import { tenantHasFeature } from '@/core/utils/context'

async function migrateTenant(tenant: Tenant) {
  if (envIs('dev')) {
    return
  }
  const tenantHasRiskScoring = await tenantHasFeature(tenant.id, 'RISK_SCORING')

  if (!tenantHasRiskScoring) {
    return
  }

  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()

  const impactStartTime = dayjs('2023-09-15').valueOf() // Impact start time
  const riskScoringService = new RiskScoringService(tenant.id, {
    dynamoDb,
    mongoDb,
  })

  await riskScoringService.backfillTransactionRiskScores(
    impactStartTime,
    dayjs().valueOf()
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
