import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { tenantHasFeature } from '@/core/utils/context'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()

  const isRiskScoringEnabled = await tenantHasFeature(tenant.id, 'RISK_SCORING')

  if (!isRiskScoringEnabled) {
    return
  }

  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const transactionsCollection = db.collection<InternalTransaction>(
    TRANSACTIONS_COLLECTION(tenant.id)
  )

  const transactionsWithoutArsScore = transactionsCollection.find({
    arsScore: { $exists: false },
  })

  const count = await transactionsWithoutArsScore.count()

  console.info(`Found ${count} transactions without ARS score`)

  const riskRepository = new RiskRepository(tenant.id, {
    mongoDb,
    dynamoDb,
  })

  let i = 0
  for await (const transaction of transactionsWithoutArsScore) {
    const arsScore = await riskRepository.getArsValueFromMongo(
      transaction.transactionId
    )

    if (arsScore) {
      await transactionsCollection.updateOne(
        { id: transaction.transactionId },
        { $set: { arsScore } }
      )
    }

    console.info(
      `ARS Score Processed for transaction ${
        transaction.transactionId
      } (${++i} / ${count})`
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
