import { isEmpty } from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts/repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { RiskScoringService } from '@/services/risk-scoring/risk-scoring-service'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { logger } from '@/core/logger'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const tenantRepository = new TenantRepository(tenant.id, {
    dynamoDb,
  })
  const settings = await tenantRepository.getTenantSettings()
  if (settings.features?.includes('RISK_SCORING_V8')) {
    logger.info(`Tenant ${tenant.id}  has RISK_SCORING_V8`)
    return
  }
  const regressionTimeStamp = 1727308800000 // September 26, 2024 12:00:00 AM UTC
  const riskScoringService = new RiskScoringService(tenant.id, {
    dynamoDb,
    mongoDb,
  })
  const riskRepository = new RiskRepository(tenant.id, {
    dynamoDb,
    mongoDb,
  })
  const mongoDbTransactionRepository = new MongoDbTransactionRepository(
    tenant.id,
    mongoDb
  )
  let hasNextPage = true
  let start: string | undefined

  while (hasNextPage) {
    const { items, hasNext, next } =
      await mongoDbTransactionRepository.getTransactionsCursorPaginate({
        afterTimestamp: regressionTimeStamp,
        pageSize: 20,
        page: 1,
        start,
      })

    await Promise.all(
      items.map(async (tx) => {
        if (!isEmpty(tx.arsScore?.components)) {
          return
        }

        const arsScore = await riskScoringService.calculateArsScore(tx)
        await riskRepository.createOrUpdateArsScore(
          tx.transactionId,
          arsScore.score,
          tx.originUserId,
          tx.destinationUserId,
          arsScore.components
        )
        logger.info(
          `Migrated transaction ${tx.transactionId} for tenant ${tenant.id}`
        )
      })
    )

    hasNextPage = hasNext
    start = next
  }

  logger.info(`Migrated transactions for tenant ${tenant.id}`)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
