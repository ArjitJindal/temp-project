import { migrateAllTenants } from '../utils/tenant'
import { USERS_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { RiskScoringService } from '@/services/risk-scoring'

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

  const usersCollectionName = USERS_COLLECTION(tenant.id)
  const usersCollection = db.collection<InternalUser>(usersCollectionName)

  const usersWithoutKrsScore = await usersCollection.find()

  console.log(`Found ${await usersWithoutKrsScore.count()} users`)

  const riskRepository = new RiskRepository(tenant.id, {
    mongoDb,
    dynamoDb,
  })

  const riskScoringService = new RiskScoringService(tenant.id, {
    mongoDb,
    dynamoDb,
  })

  const riskFactors = await riskRepository.getParameterRiskItems()
  const riskClassificationValues =
    await riskRepository.getRiskClassificationValues()

  for await (const user of usersWithoutKrsScore) {
    const { score, components } = await riskScoringService.calculateKrsScore(
      user,
      riskClassificationValues,
      riskFactors || []
    )

    await riskRepository.createOrUpdateKrsScore(user.userId, score, components)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
