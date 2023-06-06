import { migrateAllTenants } from '../utils/tenant'
import { TRANSACTIONS_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { RiskScoringService } from '@/services/risk-scoring'

// Pesawise: G7ZN1UYR9V
// ZIINA: FT398YYJMD
// Nexpay: 4PKTHPN204
// Nextpay: 85J6QJ28BY

const allowedTenants: Record<string, string[]> = {
  local: ['flagright'],
  dev: ['flagright'],
  sandbox: ['flagright'],
  prod: ['G7ZN1UYR9V', 'FT398YYJMD', '4PKTHPN204', '85J6QJ28BY', 'flagright'],
}

async function migrateTenant(tenant: Tenant) {
  const env = process.env.ENV?.startsWith('prod')
    ? 'prod'
    : process.env.ENV || ''

  if (!allowedTenants[env]?.includes(tenant.id)) {
    console.log(`Skipping tenant ${tenant.id}, ${tenant.name}`)
    return
  }

  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const db = mongoDb.db()

  const transactionsCollectionName = TRANSACTIONS_COLLECTION(tenant.id)
  const transactionsCollection = db.collection<InternalTransaction>(
    transactionsCollectionName
  )

  const transactionsWithoutArsScore = await transactionsCollection.find({
    $or: [
      { arsScore: { $exists: false } },
      { 'arsScore.arsScore': { $exists: false } },
    ],
  })

  console.log(
    `Found ${await transactionsWithoutArsScore.count()} transactions without arsScore`
  )

  const riskRepository = new RiskRepository(tenant.id, {
    mongoDb,
    dynamoDb,
  })

  const riskScoringService = new RiskScoringService(tenant.id, {
    mongoDb,
    dynamoDb,
  })

  const riskClassificationValues =
    await riskRepository.getRiskClassificationValues()

  const riskFactors = await riskRepository.getParameterRiskItems()

  for await (const transaction of transactionsWithoutArsScore) {
    const arsScore = await riskRepository.getArsScore(transaction.transactionId)

    if (arsScore) {
      await transactionsCollection.updateOne(
        { _id: transaction._id },
        { $set: { arsScore } }
      )
    } else {
      const { score, components } = await riskScoringService.calculateArsScore(
        transaction,
        riskClassificationValues,
        riskFactors || []
      )

      await riskRepository.createOrUpdateArsScore(
        transaction.transactionId,
        score,
        transaction.originUserId,
        transaction.destinationUserId,
        components
      )
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
